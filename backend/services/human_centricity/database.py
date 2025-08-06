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
    if hasattr(obj, 'dict'):
        # Pydantic model - use .dict() method
        return obj.dict()
    elif hasattr(obj, '__dict__'):
        # Regular object with __dict__ - convert to dict
        result = {}
        for key, value in obj.__dict__.items():
            if not key.startswith('_'):  # Skip private attributes
                result[key] = make_json_serializable(value)
        return result
    elif isinstance(obj, dict):
        # Recursively handle nested dictionaries
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        # Recursively handle lists and tuples
        return [make_json_serializable(item) for item in obj]
    elif hasattr(obj, 'value'):
        # Enum objects - use .value attribute
        return obj.value
    elif isinstance(obj, (str, int, float, bool, type(None))):
        # Basic JSON-serializable types
        return obj
    elif isinstance(obj, datetime):
        # Convert datetime to ISO string
        return obj.isoformat()
    else:
        # Fallback: try to convert to string
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
            # Convert all data to JSON-serializable format
            json_safe_data = make_json_serializable(assessment_data)
            
            db_assessment = HumanCentricityAssessment(
                assessment_id=json_safe_data["assessment_id"],
                user_id=json_safe_data.get("user_id"),
                system_name=json_safe_data.get("system_name"),
                overall_score=json_safe_data["overall_score"],
                domain_scores=json_safe_data["domain_scores"],
                detailed_metrics=json_safe_data["detailed_metrics"],
                raw_assessments=json_safe_data["raw_assessments"],
                meta_data=json_safe_data.get("metadata", {}),
                submitted_at=json_safe_data["submitted_at"],
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