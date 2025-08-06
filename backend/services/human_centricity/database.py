from datetime import datetime
from typing import Optional, Dict, Any
import json
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

from shared.database import get_database_url
from shared.models.exceptions import DatabaseConnectionException, AssessmentNotFoundException
from .config import settings

logger = logging.getLogger(__name__)
Base = declarative_base()


def make_json_serializable(obj):
    """Convert Pydantic models and other objects to JSON-serializable format"""
    if obj is None:
        return None
    
    # Handle datetime objects first
    if isinstance(obj, datetime):
        return obj.isoformat()
    
    # Handle Pydantic models
    if hasattr(obj, 'dict') and callable(getattr(obj, 'dict')):
        pydantic_dict = obj.dict()
        # Recursively process to handle nested datetime objects
        return make_json_serializable(pydantic_dict)
    
    # Handle dictionaries
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    
    # Handle lists and tuples  
    if isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    
    # Handle enums
    if hasattr(obj, 'value'):
        return obj.value
    
    # Handle basic types
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    
    # Handle objects with __dict__
    if hasattr(obj, '__dict__'):
        result = {}
        for key, value in obj.__dict__.items():
            if not key.startswith('_'):
                result[key] = make_json_serializable(value)
        return result
    
    # Fallback
    try:
        return str(obj)
    except Exception:
        logger.warning(f"Could not serialize object of type {type(obj)}: {obj}")
        return None

class HumanCentricityAssessment(Base):
    __tablename__ = "human_centricity_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    
    # Scores
    overall_score = Column(Float, nullable=False)
    domain_scores = Column(JSON, nullable=False)
    detailed_metrics = Column(JSON, nullable=False)
    
    # Raw input data
    raw_assessments = Column(JSON, nullable=False)
    meta_data = Column(JSON, default={})
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DatabaseManager:
    def __init__(self):
        try:
            self.database_url = settings.database_url
            self.engine = create_engine(
                self.database_url, 
                **settings.database_engine_config
            )
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine, expire_on_commit=False)
            logger.info("Database connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            raise DatabaseConnectionException(f"Failed to connect to database: {e}")
        
    def create_tables(self):
        """Create database tables"""
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise DatabaseConnectionException(f"Failed to create tables: {e}")
        
    def get_session(self):
        """Get database session"""
        try:
            return self.SessionLocal()
        except Exception as e:
            logger.error(f"Failed to create database session: {e}")
            raise DatabaseConnectionException(f"Failed to create database session: {e}")
    
    def health_check(self) -> bool:
        """Check database health"""
        try:
            with self.get_session() as db:
                db.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    def save_assessment(self, assessment_data: Dict[str, Any]) -> HumanCentricityAssessment:
        """Save human centricity assessment to database"""
        db = self.get_session()
        try:
            # Keep original datetime objects for database fields
            original_submitted_at = assessment_data.get("submitted_at")
            
            # Use datetime object or current time if None
            if not isinstance(original_submitted_at, datetime):
                original_submitted_at = datetime.utcnow()
            
            # Convert data that goes into JSON columns to JSON-serializable format
            json_safe_domain_scores = make_json_serializable(assessment_data.get("domain_scores"))
            json_safe_detailed_metrics = make_json_serializable(assessment_data.get("detailed_metrics"))
            json_safe_raw_assessments = make_json_serializable(assessment_data.get("raw_assessments"))
            json_safe_metadata = make_json_serializable(assessment_data.get("metadata", {}))
            
            db_assessment = HumanCentricityAssessment(
                assessment_id=assessment_data["assessment_id"],
                user_id=assessment_data.get("user_id"),
                system_name=assessment_data.get("system_name"),
                overall_score=assessment_data["overall_score"],
                domain_scores=json_safe_domain_scores,
                detailed_metrics=json_safe_detailed_metrics,
                raw_assessments=json_safe_raw_assessments,
                meta_data=json_safe_metadata,
                submitted_at=original_submitted_at,  # Keep as datetime object
                processed_at=datetime.utcnow()
            )
            
            db.add(db_assessment)
            db.commit()
            db.refresh(db_assessment)
            logger.info(f"Saved assessment {assessment_data['assessment_id']} to database")
            return db_assessment
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save assessment {assessment_data.get('assessment_id')}: {e}")
            raise DatabaseConnectionException(f"Failed to save assessment: {e}")
        finally:
            db.close()

    def get_assessment(self, assessment_id: str) -> Optional[HumanCentricityAssessment]:
        """Get assessment by ID"""
        db = self.get_session()
        try:
            assessment = db.query(HumanCentricityAssessment).filter(
                HumanCentricityAssessment.assessment_id == assessment_id
            ).first()
            
            if assessment:
                logger.info(f"Retrieved assessment {assessment_id} from database")
            else:
                logger.warning(f"Assessment {assessment_id} not found in database")
                
            return assessment
            
        except Exception as e:
            logger.error(f"Failed to retrieve assessment {assessment_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve assessment: {e}")
        finally:
            db.close()