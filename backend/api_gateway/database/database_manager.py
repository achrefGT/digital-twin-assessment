"""
Phase 2: Cache-Aside with Stampede Protection

This implements:
1. All Phase 1 features (basic cache-aside)
2. Distributed locking to prevent cache stampede
3. Wait-and-retry for requests that don't get the lock
4. Automatic lock release on success/failure
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from sqlalchemy import create_engine, and_, text, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from uuid import uuid4
import logging
import json
import asyncio

# Import shared models
from shared.models.assessment import AssessmentProgress, AssessmentStatus

from ..config import settings
from .models import Base, Assessment, UserSession, OutboxEvent
from ..auth.models import User, RefreshToken
from ..utils.exceptions import DatabaseConnectionException, AssessmentNotFoundException

# Import Redis service
from ..cache.assessment_cache_service import AssessmentCacheService

logger = logging.getLogger(__name__)


class DatabaseManager:
    def __init__(self):
        self.engine = create_engine(
            settings.database_url,
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False, 
            autoflush=False, 
            bind=self.engine, 
            expire_on_commit=False
        )
        
        # Redis Integration 
        self.redis_service: Optional[AssessmentCacheService] = None
        self.cache_enabled = getattr(settings, 'enable_assessment_caching', True)
        
        if self.cache_enabled:
            logger.info("ℹ️  Assessment caching enabled (will initialize on first use)")
        else:
            logger.info("ℹ️  Assessment caching is disabled in settings")


    async def _ensure_redis_connected(self) -> bool:
        """Ensure Redis connection is established (lazy connection)"""
        if not self.cache_enabled:
            return False
        
        try:
            if self.redis_service is None:
                # ✅ Lazy initialization with dependency injection
                from ..utils.dependencies import get_assessment_cache
                self.redis_service = get_assessment_cache()
                
                if self.redis_service:
                    logger.info("✅ Assessment cache service connected")
            
            if self.redis_service and not self.redis_service.redis_service.connected:
                await self.redis_service.redis_service.connect()
            
            return self.redis_service is not None
            
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            return False
        
    
    def create_tables(self):
        """Create database tables including auth tables"""
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database tables created successfully (including auth tables)")
        except SQLAlchemyError as e:
            logger.error(f"Failed to create database tables: {e}")
            raise DatabaseConnectionException(f"Database initialization failed: {e}")
        
    @contextmanager
    def get_session(self) -> Session:
        """Context manager for database sessions"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Database operation failed: {e}")
            raise DatabaseConnectionException(f"Database operation failed: {e}")
        finally:
            session.close()
    
    def _expunge_and_return(self, session: Session, obj):
        """Helper to safely expunge and return an object"""
        if obj:
            # Access lazy-loaded attributes before expunging
            _ = obj.__dict__
            session.expunge(obj)
        return obj
    
    def _expunge_list(self, session: Session, objects: List):
        """Helper to safely expunge a list of objects"""
        for obj in objects:
            _ = obj.__dict__
            session.expunge(obj)
        return objects
    
    def _assessment_to_cache_dict(self, assessment: Assessment) -> Dict[str, Any]:
        """Convert Assessment ORM object to cacheable dictionary"""
        return {
            'assessment_id': assessment.assessment_id,
            'user_id': assessment.user_id,
            'system_name': assessment.system_name,
            'status': assessment.status,
            'resilience_submitted': assessment.resilience_submitted,
            'sustainability_submitted': assessment.sustainability_submitted,
            'human_centricity_submitted': assessment.human_centricity_submitted,
            'domain_scores': assessment.domain_scores,
            'overall_score': assessment.overall_score,
            'meta_data': assessment.meta_data,
            'created_at': assessment.created_at.isoformat() if assessment.created_at else None,
            'updated_at': assessment.updated_at.isoformat() if assessment.updated_at else None,
            'completed_at': assessment.completed_at.isoformat() if assessment.completed_at else None
        }
    
    def _cache_dict_to_assessment(self, cache_data: Dict[str, Any]) -> Assessment:
        """Convert cached dictionary back to Assessment ORM object"""
        assessment = Assessment(
            assessment_id=cache_data['assessment_id'],
            user_id=cache_data['user_id'],
            system_name=cache_data['system_name'],
            status=cache_data['status'],
            resilience_submitted=cache_data['resilience_submitted'],
            sustainability_submitted=cache_data['sustainability_submitted'],
            human_centricity_submitted=cache_data['human_centricity_submitted'],
            domain_scores=cache_data['domain_scores'],
            overall_score=cache_data['overall_score'],
            meta_data=cache_data['meta_data']
        )
        
        # Parse ISO datetime strings
        if cache_data.get('created_at'):
            assessment.created_at = datetime.fromisoformat(cache_data['created_at'])
        if cache_data.get('updated_at'):
            assessment.updated_at = datetime.fromisoformat(cache_data['updated_at'])
        if cache_data.get('completed_at'):
            assessment.completed_at = datetime.fromisoformat(cache_data['completed_at'])
        
        return assessment
    
    # ==================== PHASE 2: Cache-Aside with Stampede Protection ====================
    async def get_assessment(
        self, 
        assessment_id: str, 
        bypass_cache: bool = False
    ) -> Assessment:
        """
        Get assessment by ID with cache-aside pattern and stampede protection.
        
        PHASE 2 FLOW:
        1. Check cache (fast path)
        2. On cache miss:
           a. Try to acquire lock
           b. If lock acquired: fetch from DB, populate cache, release lock
           c. If lock NOT acquired: wait for lock holder to populate cache, then read cache
        3. Return assessment
        
        Args:
            assessment_id: Assessment identifier
            bypass_cache: If True, skip cache and query database directly
            
        Returns:
            Assessment object
            
        Raises:
            AssessmentNotFoundException: If assessment not found
        """
        # Step 1: Try cache first (unless bypassed)
        if not bypass_cache and await self._ensure_redis_connected():
            try:
                cached_data = await self.redis_service.get_cached_assessment(assessment_id)
                
                if cached_data:
                    logger.debug(f"✅ Cache HIT for assessment {assessment_id}")
                    assessment = self._cache_dict_to_assessment(cached_data)
                    return assessment
                else:
                    logger.debug(f"❌ Cache MISS for assessment {assessment_id}")
                    
            except Exception as e:
                logger.warning(f"Cache read failed for {assessment_id}, falling back to DB: {e}")
        
        # Step 2: Cache miss - need to fetch from DB with stampede protection
        if not bypass_cache and await self._ensure_redis_connected():
            try:
                # Try to acquire lock
                lock_token = await self.redis_service.acquire_cache_lock(assessment_id)
                
                if lock_token:
                    # WE GOT THE LOCK - fetch from DB and populate cache
                    logger.debug(f"🔒 Acquired lock for {assessment_id}, fetching from DB")
                    
                    try:
                        # Fetch from database
                        assessment = await self._fetch_assessment_from_db(assessment_id)
                        
                        # Populate cache
                        cache_data = self._assessment_to_cache_dict(assessment)
                        await self.redis_service.cache_assessment(
                            assessment_id, 
                            cache_data,
                            ttl=getattr(settings, 'cache_ttl_seconds', 300)
                        )
                        logger.debug(f"📦 Cached assessment {assessment_id} from database")
                        
                        return assessment
                        
                    finally:
                        # Always release lock
                        await self.redis_service.release_cache_lock(assessment_id, lock_token)
                        logger.debug(f"🔓 Released lock for {assessment_id}")
                
                else:
                    # SOMEONE ELSE HAS THE LOCK - wait for them to populate cache
                    logger.debug(f"⏳ Waiting for cache population of {assessment_id}")
                    
                    # Wait for lock to be released
                    lock_released = await self.redis_service.wait_for_cache_lock(assessment_id)
                    
                    if lock_released:
                        # Lock released - try reading from cache again
                        cached_data = await self.redis_service.get_cached_assessment(assessment_id)
                        
                        if cached_data:
                            logger.debug(f"✅ Got cached data after waiting for {assessment_id}")
                            assessment = self._cache_dict_to_assessment(cached_data)
                            return assessment
                        else:
                            logger.warning(f"⚠️ No cache data after lock release for {assessment_id}, fetching from DB")
                    else:
                        logger.warning(f"⏱️ Lock wait timeout for {assessment_id}, fetching from DB")
                    
                    # Fallback: fetch directly from DB
                    return await self._fetch_assessment_from_db(assessment_id)
                    
            except Exception as e:
                logger.error(f"Stampede protection error for {assessment_id}: {e}")
                # Fallback to direct DB fetch
                return await self._fetch_assessment_from_db(assessment_id)
        
        # Step 3: Cache disabled or bypassed - direct DB fetch
        return await self._fetch_assessment_from_db(assessment_id)
    
    async def _fetch_assessment_from_db(self, assessment_id: str) -> Assessment:
        """
        Internal helper to fetch assessment from database.
        Separated for reuse in stampede protection flow.
        """
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
            
            # Make a copy before expunging
            result = self._expunge_and_return(session, assessment)
        
        return result
    # ==================== END PHASE 2: get_assessment() ====================
    
    def generate_assessment_id(self) -> str:
        """Generate a unique assessment ID"""
        return str(uuid4())
    
    def create_assessment(
        self, 
        user_id: Optional[str] = None, 
        system_name: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Assessment:
        """Create a new assessment"""
        with self.get_session() as session:
            assessment = Assessment(
                assessment_id=str(uuid4()),
                user_id=user_id,
                system_name=system_name,
                status="started",
                meta_data=metadata or {}
            )
            
            session.add(assessment)
            session.flush()
            
            return self._expunge_and_return(session, assessment)
        
    def delete_assessment(self, assessment_id: str) -> bool:
        """Hard delete an assessment from the database"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                return False
            
            session.delete(assessment)
            return True
    
    def create_assessment_from_progress(
        self, 
        progress: AssessmentProgress, 
        metadata: Dict[str, Any] = None
    ) -> Assessment:
        """Create assessment from shared progress model WITH cache invalidation"""
        with self.get_session() as session:
            assessment = Assessment.from_progress_model(progress)
            if metadata:
                assessment.meta_data = metadata
            
            session.add(assessment)
            session.flush()
            
            result = self._expunge_and_return(session, assessment)
        
        # Invalidate user's assessment list cache immediately
        if progress.user_id:
            asyncio.create_task(self._invalidate_user_assessments_cache(progress.user_id))
        
        return result
    
    def _update_assessment_fields(
        self, 
        assessment: Assessment, 
        progress: AssessmentProgress
    ):
        """Internal helper to update assessment fields from progress model"""
        assessment.user_id = progress.user_id
        assessment.system_name = progress.system_name
        assessment.status = progress.status.value
        assessment.resilience_submitted = progress.resilience_submitted
        assessment.sustainability_submitted = progress.sustainability_submitted
        assessment.human_centricity_submitted = progress.human_centricity_submitted
        assessment.domain_scores = progress.domain_scores
        assessment.overall_score = progress.overall_score
        assessment.updated_at = progress.updated_at
        assessment.completed_at = progress.completed_at
    
    def update_assessment_from_progress(self, progress: AssessmentProgress) -> Assessment:
        """Update assessment from shared progress model"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == progress.assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(
                    f"Assessment {progress.assessment_id} not found"
                )
            
            self._update_assessment_fields(assessment, progress)
            session.flush()
            
            return self._expunge_and_return(session, assessment)
    
    def update_assessment_domain(self, assessment_id: str, domain: str) -> Assessment:
        """Mark a domain as submitted for an assessment"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
            
            # Update domain submission flag
            domain_field_map = {
                "resilience": "resilience_submitted",
                "human_centricity": "human_centricity_submitted",
                "sustainability": "sustainability_submitted"
            }
            
            if domain in domain_field_map:
                setattr(assessment, domain_field_map[domain], True)
            
            # Update status
            if (assessment.resilience_submitted and 
                assessment.sustainability_submitted and
                assessment.human_centricity_submitted):
                assessment.status = "all_complete"
            
            assessment.updated_at = datetime.utcnow()
            session.flush()
            
            return self._expunge_and_return(session, assessment)
    
    def update_domain_score(
        self, 
        assessment_id: str, 
        domain: str, 
        score_data: Dict[str, Any]
    ) -> Assessment:
        """Update domain score for an assessment"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
            
            # Update domain scores
            domain_scores = assessment.domain_scores or {}
            domain_scores[domain] = score_data
            assessment.domain_scores = domain_scores
            assessment.updated_at = datetime.utcnow()
            
            session.flush()
            
            return self._expunge_and_return(session, assessment)
        
    async def get_user_assessments(
        self, 
        user_id: str, 
        limit: int = 10, 
        status_filter: Optional[str] = None,
        bypass_cache: bool = False
    ) -> List[Assessment]:
        """
        Get user assessments with caching.
        
        Cache key includes user_id, limit, and status_filter for proper segmentation.
        """
        # Generate cache key with query parameters
        cache_key = f"user_assessments:{user_id}:{limit}:{status_filter or 'all'}"
        
        # Try cache first
        if not bypass_cache and await self._ensure_redis_connected():
            try:
                cached_data = await self.redis_service.redis.get(cache_key)
                if cached_data:
                    logger.debug(f"✅ Cache HIT for user assessments: {user_id}")
                    # Deserialize list of assessments
                    assessments = [
                        self._cache_dict_to_assessment(item) 
                        for item in json.loads(cached_data)
                    ]
                    return assessments
            except Exception as e:
                logger.warning(f"Cache read failed for user assessments: {e}")
        
        # Cache miss - fetch from DB with stampede protection
        if not bypass_cache and await self._ensure_redis_connected():
            lock_token = await self.redis_service.acquire_cache_lock(cache_key)
            
            if lock_token:
                try:
                    assessments = self._fetch_user_assessments_from_db(
                        user_id, limit, status_filter
                    )
                    
                    # Cache the list
                    cache_data = [
                        self._assessment_to_cache_dict(a) for a in assessments
                    ]
                    await self.redis_service.redis.setex(cache_key, 300, json.dumps(cache_data))
                    
                    return assessments
                finally:
                    await self.redis_service.release_cache_lock(cache_key, lock_token)
            else:
                # Wait for lock holder
                await self.redis_service.wait_for_cache_lock(cache_key)
                cached_data = await self.redis_service.redis.get(cache_key)
                if cached_data:
                    return [
                        self._cache_dict_to_assessment(item) 
                        for item in json.loads(cached_data)
                    ]
        
        # Fallback: direct DB fetch
        return self._fetch_user_assessments_from_db(user_id, limit, status_filter)

    def _fetch_user_assessments_from_db(
        self, 
        user_id: str, 
        limit: int, 
        status_filter: Optional[str]
    ) -> List[Assessment]:
        """Internal helper to fetch from database."""
        with self.get_session() as session:
            query = session.query(Assessment).filter(Assessment.user_id == user_id)
            
            if status_filter:
                query = query.filter(Assessment.status == status_filter)
            
            assessments = query.order_by(
                Assessment.created_at.desc()
            ).limit(limit).all()
            
            return self._expunge_list(session, assessments)
    
    def create_session(
        self, 
        user_id: Optional[str] = None, 
        session_data: Dict[str, Any] = None,
        expires_in_hours: int = 24
    ) -> UserSession:
        """Create a new user session"""
        with self.get_session() as session:
            user_session = UserSession(
                session_id=str(uuid4()),
                user_id=user_id,
                session_data=session_data or {},
                expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours)
            )
            
            session.add(user_session)
            session.flush()
            
            return self._expunge_and_return(session, user_session)
    
    def get_user_session(self, session_id: str) -> Optional[UserSession]:
        """Get session by ID if not expired"""
        with self.get_session() as session:
            user_session = session.query(UserSession).filter(
                and_(
                    UserSession.session_id == session_id,
                    UserSession.expires_at > datetime.utcnow()
                )
            ).first()
            
            return self._expunge_and_return(session, user_session)
        
    def health_check(self) -> bool:
        """Check database health"""
        try:
            with self.get_session() as db:
                db.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
        
    def get_completed_assessments_for_weighting(
        self, 
        cutoff_date: datetime = None, 
        limit: int = 1000
    ) -> List[Assessment]:
        """Get completed assessments for weight calculation from database"""
        with self.get_session() as session:
            query = session.query(Assessment).filter(
                Assessment.status == "completed",
                Assessment.domain_scores.isnot(None),
                Assessment.overall_score.isnot(None)
            )
            
            if cutoff_date:
                query = query.filter(Assessment.completed_at >= cutoff_date)
            
            assessments = query.order_by(
                Assessment.completed_at.desc()
            ).limit(limit).all()
            
            # Filter assessments with all required domain scores
            required_domains = {"resilience", "sustainability", "human_centricity"}
            filtered_assessments = [
                assessment for assessment in assessments
                if (assessment.domain_scores and 
                    isinstance(assessment.domain_scores, dict) and
                    required_domains.issubset(set(assessment.domain_scores.keys())) and
                    all(assessment.domain_scores.get(d) is not None for d in required_domains))
            ]
            
            result = self._expunge_list(session, filtered_assessments)
            logger.info(
                f"Retrieved {len(result)} complete assessments for weight calculation"
            )
            return result

    def get_assessment_statistics(self) -> Dict[str, Any]:
        """Get statistics about assessments in the database for monitoring"""
        with self.get_session() as session:
            total_assessments = session.query(Assessment).count()
            completed_assessments = session.query(Assessment).filter(
                Assessment.status == "completed"
            ).count()
            assessments_with_scores = session.query(Assessment).filter(
                Assessment.domain_scores.isnot(None)
            ).count()
            
            # Get date range of completed assessments
            oldest_completed = session.query(Assessment.completed_at).filter(
                Assessment.status == "completed",
                Assessment.completed_at.isnot(None)
            ).order_by(Assessment.completed_at.asc()).first()
            
            newest_completed = session.query(Assessment.completed_at).filter(
                Assessment.status == "completed",
                Assessment.completed_at.isnot(None)
            ).order_by(Assessment.completed_at.desc()).first()
            
            return {
                "total_assessments": total_assessments,
                "completed_assessments": completed_assessments,
                "assessments_with_scores": assessments_with_scores,
                "oldest_completed": oldest_completed[0].isoformat() if oldest_completed and oldest_completed[0] else None,
                "newest_completed": newest_completed[0].isoformat() if newest_completed and newest_completed[0] else None,
                "completion_rate": (completed_assessments / total_assessments * 100) if total_assessments > 0 else 0
            }

    def create_outbox_event(
        self,
        session: Session,
        aggregate_id: str,
        event_type: str,
        event_payload: Dict[str, Any],
        kafka_topic: str,
        kafka_key: Optional[str] = None,
        aggregate_type: str = 'assessment'
    ) -> int:
        """Create outbox event within an existing transaction"""
        outbox_event = OutboxEvent(
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            event_type=event_type,
            event_payload=event_payload,
            kafka_topic=kafka_topic,
            kafka_key=kafka_key or aggregate_id,
            status='PENDING',
            retry_count=0
        )
        
        session.add(outbox_event)
        session.flush()
        
        logger.debug(
            f"Created outbox event {outbox_event.id} for {aggregate_id}/{event_type}"
        )
        return outbox_event.id

    def _create_outbox_events_for_progress(
        self,
        session: Session,
        progress: AssessmentProgress,
        previous_status: str,
        domain: Optional[str] = None,
        score_value: Optional[float] = None
    ) -> List[int]:
        """Internal helper to create appropriate outbox events based on progress changes"""
        outbox_ids = []
        timestamp = datetime.utcnow().isoformat()
        
        # Domain scored event
        if domain and score_value is not None:
            outbox_id = self.create_outbox_event(
                session=session,
                aggregate_id=progress.assessment_id,
                event_type='domain_scored',
                event_payload={
                    'assessment_id': progress.assessment_id,
                    'domain': domain,
                    'score_value': score_value,
                    'domain_scores': progress.domain_scores,
                    'user_id': progress.user_id,
                    'timestamp': timestamp
                },
                kafka_topic='assessment-status',
                kafka_key=progress.assessment_id
            )
            outbox_ids.append(outbox_id)
        
        # Status change event
        if previous_status != progress.status.value:
            outbox_id = self.create_outbox_event(
                session=session,
                aggregate_id=progress.assessment_id,
                event_type='status_updated',
                event_payload={
                    'assessment_id': progress.assessment_id,
                    'old_status': previous_status,
                    'new_status': progress.status.value,
                    'user_id': progress.user_id,
                    'timestamp': timestamp
                },
                kafka_topic='assessment-status',
                kafka_key=progress.assessment_id
            )
            outbox_ids.append(outbox_id)
        
        # Completion event
        if progress.status == AssessmentStatus.COMPLETED:
            outbox_id = self.create_outbox_event(
                session=session,
                aggregate_id=progress.assessment_id,
                event_type='assessment_completed',
                event_payload={
                    'assessment_id': progress.assessment_id,
                    'overall_score': progress.overall_score,
                    'domain_scores': progress.domain_scores,
                    'completed_at': progress.completed_at.isoformat() if progress.completed_at else None,
                    'user_id': progress.user_id,
                    'timestamp': timestamp
                },
                kafka_topic='assessment-status',
                kafka_key=progress.assessment_id
            )
            outbox_ids.append(outbox_id)
        
        return outbox_ids

    async def update_assessment_with_outbox(
        self,
        progress: AssessmentProgress,
        domain: Optional[str] = None,
        score_value: Optional[float] = None
    ) -> Assessment:
        """
        Update assessment AND create outbox events in a SINGLE TRANSACTION.
        PHASE 2: Aggressive cache invalidation BEFORE returning.
        """
        with self.get_session() as session:
            # Get assessment
            assessment = session.query(Assessment).filter_by(
                assessment_id=progress.assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(
                    f"Assessment {progress.assessment_id} not found"
                )
            
            previous_status = assessment.status
            
            # Update assessment fields
            self._update_assessment_fields(assessment, progress)
            
            # Create outbox events
            outbox_ids = self._create_outbox_events_for_progress(
                session=session,
                progress=progress,
                previous_status=previous_status,
                domain=domain,
                score_value=score_value
            )
            
            # Commit transaction (both assessment update AND outbox events)
            session.flush()
            
            logger.info(
                f"Updated assessment {progress.assessment_id} with "
                f"{len(outbox_ids)} outbox events"
            )
            
            result = self._expunge_and_return(session, assessment)
        
        # CRITICAL: Invalidate ALL caches IMMEDIATELY after database commit
        if await self._ensure_redis_connected():
            invalidation_tasks = []
            
            # 1. Invalidate the specific assessment cache
            try:
                await self.redis_service.invalidate_assessment_cache(progress.assessment_id)
                logger.debug(f"🗑️ Invalidated cache for assessment {progress.assessment_id}")
            except Exception as e:
                logger.warning(f"Cache invalidation failed for {progress.assessment_id}: {e}")
            
            # 2. Invalidate user's assessment lists
            if progress.user_id:
                try:
                    await self._invalidate_user_assessments_cache(progress.user_id)
                except Exception as e:
                    logger.warning(f"User list cache invalidation failed: {e}")
            
            # 3. If completed, warm the cache for fast subsequent reads
            if progress.status == AssessmentStatus.COMPLETED:
                try:
                    await asyncio.sleep(0.1)  # Small delay to ensure consistency
                    await self.warm_assessment_cache(progress.assessment_id)
                    if progress.user_id:
                        await self.warm_user_assessments_cache(progress.user_id, limit=10)
                except Exception as e:
                    logger.warning(f"Cache warming failed (non-critical): {e}")
        
        return result
    
    async def _invalidate_user_assessments_cache(self, user_id: str):
        """Aggressively invalidate ALL cached user assessment lists."""
        if await self._ensure_redis_connected():
            try:
                # Pattern: user_assessments:{user_id}:*
                pattern = f"user_assessments:{user_id}:*"
                
                # Scan and delete matching keys
                keys_deleted = 0
                cursor = 0
                while True:
                    cursor, keys = await self.redis_service.redis.scan(
                        cursor, match=pattern, count=100
                    )
                    if keys:
                        await self.redis_service.redis.delete(*keys)
                        keys_deleted += len(keys)
                    if cursor == 0:
                        break
                
                # ALSO invalidate the generic assessments list cache if it exists
                generic_pattern = f"assessments:list:user:{user_id}:*"
                cursor = 0
                while True:
                    cursor, keys = await self.redis_service.redis.scan(
                        cursor, match=generic_pattern, count=100
                    )
                    if keys:
                        await self.redis_service.redis.delete(*keys)
                        keys_deleted += len(keys)
                    if cursor == 0:
                        break
                        
                logger.info(f"🗑️ Invalidated {keys_deleted} user assessment cache keys for {user_id}")
            except Exception as e:
                logger.warning(f"Failed to invalidate user list cache: {e}")


    def get_pending_outbox_events(self, batch_size: int = 100) -> List[OutboxEvent]:
        """Fetch pending outbox events for publishing to Kafka"""
        with self.get_session() as session:
            events = session.query(OutboxEvent).filter(
                OutboxEvent.status == 'PENDING'
            ).order_by(
                OutboxEvent.created_at.asc()
            ).limit(batch_size).all()
            
            return self._expunge_list(session, events)

    def get_failed_outbox_events_for_retry(
        self, 
        batch_size: int = 50,
        max_retries: int = 5
    ) -> List[OutboxEvent]:
        """Fetch failed outbox events that are ready for retry"""
        with self.get_session() as session:
            now = datetime.utcnow()
            
            events = session.query(OutboxEvent).filter(
                OutboxEvent.status == 'FAILED',
                OutboxEvent.retry_count < max_retries,
                OutboxEvent.next_retry_at <= now
            ).order_by(
                OutboxEvent.next_retry_at.asc()
            ).limit(batch_size).all()
            
            return self._expunge_list(session, events)

    def mark_outbox_event_published(self, event_id: int):
        """Mark outbox event as successfully published to Kafka"""
        with self.get_session() as session:
            event = session.query(OutboxEvent).filter_by(id=event_id).first()
            if event:
                event.status = 'PUBLISHED'
                event.published_at = datetime.utcnow()
                logger.debug(f"Marked outbox event {event_id} as PUBLISHED")

    def mark_outbox_event_failed(self, event_id: int, error_message: str):
        """Mark outbox event as failed and schedule retry with exponential backoff"""
        with self.get_session() as session:
            event = session.query(OutboxEvent).filter_by(id=event_id).first()
            if event:
                event.status = 'FAILED'
                event.retry_count += 1
                event.last_error = error_message
                
                # Exponential backoff: 2^retry_count minutes
                backoff_minutes = 2 ** event.retry_count
                event.next_retry_at = datetime.utcnow() + timedelta(minutes=backoff_minutes)
                
                logger.warning(
                    f"Marked outbox event {event_id} as FAILED "
                    f"(retry {event.retry_count}/5). Next retry at {event.next_retry_at}"
                )

    def get_outbox_statistics(self) -> Dict[str, Any]:
        """Get statistics about outbox events for monitoring"""
        with self.get_session() as session:
            stats = session.query(
                OutboxEvent.status,
                func.count(OutboxEvent.id).label('count')
            ).group_by(OutboxEvent.status).all()
            
            stats_dict = {status: count for status, count in stats}
            
            # Get oldest pending event
            oldest_pending = session.query(
                func.min(OutboxEvent.created_at)
            ).filter(OutboxEvent.status == 'PENDING').scalar()
            
            return {
                'pending': stats_dict.get('PENDING', 0),
                'published': stats_dict.get('PUBLISHED', 0),
                'failed': stats_dict.get('FAILED', 0),
                'oldest_pending': oldest_pending.isoformat() if oldest_pending else None
            }
        
    async def warm_assessment_cache(self, assessment_id: str) -> bool:
        """
        Warm cache for a single assessment.
        Only warms if not already cached.
        """
        if not await self._ensure_redis_connected():
            return False
        
        try:
            # Skip if already cached
            cached = await self.redis_service.get_cached_assessment(assessment_id)
            if cached:
                return True
            
            # Fetch and cache
            assessment = await self._fetch_assessment_from_db(assessment_id)
            cache_data = self._assessment_to_cache_dict(assessment)
            await self.redis_service.cache_assessment(
                assessment_id, 
                cache_data,
                ttl=getattr(settings, 'cache_ttl_seconds', 300)
            )
            
            logger.info(f"🔥 Warmed cache for assessment {assessment_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to warm cache: {e}")
            return False
        
    async def warm_user_assessments_cache(
        self,
        user_id: str,
        limit: int = 10,
        status_filter: Optional[str] = None
    ) -> bool:
        """
        Warm cache for user's assessment list.
        Only warms if not already cached.
        """
        if not await self._ensure_redis_connected():
            return False
        
        try:
            cache_key = f"user_assessments:{user_id}:{limit}:{status_filter or 'all'}"
            
            # Skip if already cached
            cached = await self.redis_service.redis.get(cache_key)
            if cached:
                return True
            
            # Fetch and cache
            assessments = self._fetch_user_assessments_from_db(user_id, limit, status_filter)
            
            cache_data = [
                self._assessment_to_cache_dict(a) for a in assessments
            ]
            await self.redis_service.redis.setex(
                cache_key,
                300,  # 5 minute TTL
                json.dumps(cache_data)
            )
            
            logger.info(f"🔥 Warmed user assessments cache for {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to warm user assessments cache: {e}")
            return False
    
    async def warm_user_dashboard(self, user_id: str, limit: int = 5) -> bool:
        """
        Warm cache for user's recent assessments.
        Call this after login.
        """
        if not await self._ensure_redis_connected():
            return False
        
        try:
            # Warm the list (now this method exists!)
            await self.warm_user_assessments_cache(user_id, limit)
            
            # Warm individual assessments
            assessments = self._fetch_user_assessments_from_db(user_id, limit, None)
            
            for assessment in assessments[:limit]:  # Limit to avoid overload
                try:
                    await self.warm_assessment_cache(assessment.assessment_id)
                except Exception as e:
                    logger.warning(f"Failed to warm {assessment.assessment_id}: {e}")
            
            logger.info(f"🔥 Warmed dashboard for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to warm dashboard: {e}")
            return False