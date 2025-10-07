from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from sqlalchemy import create_engine, and_, text, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from uuid import uuid4
import logging

# Import shared models
from shared.models.assessment import AssessmentProgress, AssessmentStatus

from .config import settings
from .models import Base, Assessment, UserSession, OutboxEvent
# Import auth models
from .auth.models import User, RefreshToken
from .exceptions import DatabaseConnectionException, AssessmentNotFoundException

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
        """Create assessment from shared progress model"""
        with self.get_session() as session:
            assessment = Assessment.from_progress_model(progress)
            if metadata:
                assessment.meta_data = metadata
            
            session.add(assessment)
            session.flush()
            
            return self._expunge_and_return(session, assessment)
    
    def get_assessment(self, assessment_id: str) -> Assessment:
        """Get assessment by ID"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
            
            return self._expunge_and_return(session, assessment)
    
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
    
    def get_user_assessments(
        self, 
        user_id: str, 
        limit: int = 10, 
        status_filter: Optional[str] = None
    ) -> List[Assessment]:
        """Get assessments for a user"""
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
        """
        Get completed assessments for weight calculation from database
        
        Parameters:
        -----------
        cutoff_date : datetime, optional
            Only fetch assessments completed after this date
        limit : int, default=1000
            Maximum number of assessments to fetch
            
        Returns:
        --------
        List[Assessment]
            List of completed assessments with domain scores
        """
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
        """
        Create outbox event within an existing transaction.
        
        Returns:
            outbox_event_id: The ID of the created outbox event
        """
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
        """
        Internal helper to create appropriate outbox events based on progress changes.
        
        Returns list of created outbox event IDs.
        """
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

    def update_assessment_with_outbox(
        self,
        progress: AssessmentProgress,
        domain: Optional[str] = None,
        score_value: Optional[float] = None
    ) -> Assessment:
        """
        Update assessment AND create outbox events in a SINGLE TRANSACTION.
        
        This replaces direct Kafka publishing with transactional outbox pattern,
        guaranteeing no event loss.
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
            
            # Reuse the existing field update logic
            self._update_assessment_fields(assessment, progress)
            
            # Create outbox events using helper
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
            
            return self._expunge_and_return(session, assessment)

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