from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from sqlalchemy import create_engine, and_, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from uuid import uuid4
import logging

# Import shared models
from shared.models.assessment import AssessmentProgress

from .config import settings
from .models import Base, Assessment, UserSession
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
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine, expire_on_commit=False)
        
    def create_tables(self):
        """Create database tables including auth tables"""
        try:
            # This will create all tables including User and RefreshToken
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
    
    def generate_assessment_id(self) -> str:
        """Generate a unique assessment ID"""
        return str(uuid4())
    
    def create_assessment(self, user_id: Optional[str] = None, 
                         system_name: Optional[str] = None,
                         metadata: Dict[str, Any] = None) -> Assessment:
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
            session.commit()  # Commit to get DB-generated values
            
            # Now query fresh to get the complete object
            fresh_assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment.assessment_id
            ).first()
            
            session.expunge(fresh_assessment)
            return fresh_assessment
        
    def delete_assessment(self, assessment_id: str) -> bool:
        """Hard delete an assessment from the database"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                return False
            
            # Delete the assessment record
            session.delete(assessment)
            session.commit()
            
            return True
    
    def create_assessment_from_progress(self, progress: AssessmentProgress, 
                                      metadata: Dict[str, Any] = None) -> Assessment:
        """Create assessment from shared progress model"""
        with self.get_session() as session:
            assessment = Assessment.from_progress_model(progress)
            if metadata:
                assessment.meta_data = metadata
            
            session.add(assessment)
            session.flush()
            # Ensure all attributes are loaded before expunging
            assessment_id = assessment.assessment_id
            created_at = assessment.created_at
            session.expunge(assessment)
            return assessment
    
    def get_assessment(self, assessment_id: str) -> Assessment:
        """Get assessment by ID"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
            
            # Detach from session to avoid issues with lazy loading
            session.expunge(assessment)
            return assessment
    
    def update_assessment_from_progress(self, progress: AssessmentProgress) -> Assessment:
        """Update assessment from shared progress model"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == progress.assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {progress.assessment_id} not found")
            
            # Update fields from progress model
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
            
            session.flush()
            # Access attributes before expunging to ensure they're loaded
            assessment_id = assessment.assessment_id
            updated_at = assessment.updated_at
            session.expunge(assessment)
            return assessment
    
    def update_assessment_domain(self, assessment_id: str, domain: str) -> Assessment:
        """Mark a domain as submitted for an assessment"""
        with self.get_session() as session:
            assessment = session.query(Assessment).filter(
                Assessment.assessment_id == assessment_id
            ).first()
            
            if not assessment:
                raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
            
            # Update domain submission flag
            if domain == "resilience":
                assessment.resilience_submitted = True
            elif domain == "human_centricity":
                assessment.human_centricity_submitted = True
            elif domain == "sustainability":
                assessment.sustainability_submitted = True
            
            # Update status
            if (assessment.resilience_submitted and 
                assessment.sustainability_submitted and
                assessment.human_centricity_submitted):
                assessment.status = "all_complete"
            
            assessment.updated_at = datetime.utcnow()
            session.flush()
            # Access attributes before expunging
            assessment_id = assessment.assessment_id
            updated_at = assessment.updated_at
            session.expunge(assessment)
            return assessment
    
    def update_domain_score(self, assessment_id: str, domain: str, score_data: Dict[str, Any]) -> Assessment:
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
            # Access attributes before expunging
            assessment_id = assessment.assessment_id
            updated_at = assessment.updated_at
            session.expunge(assessment)
            return assessment
    
    def get_user_assessments(self, user_id: str, limit: int = 10, 
                           status_filter: Optional[str] = None) -> List[Assessment]:
        """Get assessments for a user"""
        with self.get_session() as session:
            query = session.query(Assessment).filter(Assessment.user_id == user_id)
            
            if status_filter:
                query = query.filter(Assessment.status == status_filter)
            
            assessments = query.order_by(Assessment.created_at.desc()).limit(limit).all()
            
            # Detach from session
            for assessment in assessments:
                session.expunge(assessment)
            
            return assessments
    
    def create_session(self, user_id: Optional[str] = None, 
                      session_data: Dict[str, Any] = None,
                      expires_in_hours: int = 24) -> UserSession:
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
            # Access attributes before expunging
            session_id = user_session.session_id
            created_at = user_session.created_at
            session.expunge(user_session)
            return user_session
    
    def get_user_session(self, session_id: str) -> Optional[UserSession]:
        """Get session by ID if not expired"""
        with self.get_session() as session:
            user_session = session.query(UserSession).filter(
                and_(
                    UserSession.session_id == session_id,
                    UserSession.expires_at > datetime.utcnow()
                )
            ).first()
            
            if user_session:
                session.expunge(user_session)
            
            return user_session
        
    def health_check(self) -> bool:
        """Check database health"""
        try:
            with self.get_session() as db:
                # Fixed: Use text() wrapper for raw SQL
                db.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False