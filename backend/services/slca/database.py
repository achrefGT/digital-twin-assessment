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


class SLCAAssessment(Base):
    __tablename__ = "slca_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    
    # Core results
    overall_score = Column(Float, nullable=False)
    annual_scores = Column(JSON, nullable=False)
    stakeholder_group = Column(String, nullable=False)
    social_sustainability_rating = Column(String, nullable=False)
    
    # Enhanced metrics
    stakeholder_impact_score = Column(Float)
    social_performance_trend = Column(String)
    key_metrics = Column(JSON)
    recommendations = Column(JSON)
    detailed_metrics = Column(JSON)
    
    # Raw input data
    raw_inputs = Column(JSON, nullable=False)
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
    
    def save_assessment(self, assessment_data: Dict[str, Any]) -> SLCAAssessment:
        """Save S-LCA assessment to database"""
        db = self.get_session()
        try:
            # Keep original datetime objects for database fields
            original_submitted_at = assessment_data.get("submitted_at")
            
            # Use datetime object or current time if None
            if not isinstance(original_submitted_at, datetime):
                original_submitted_at = datetime.utcnow()
            
            # Convert data that goes into JSON columns to JSON-serializable format
            json_safe_annual_scores = make_json_serializable(assessment_data.get("annual_scores"))
            json_safe_key_metrics = make_json_serializable(assessment_data.get("key_metrics"))
            json_safe_recommendations = make_json_serializable(assessment_data.get("recommendations"))
            json_safe_detailed_metrics = make_json_serializable(assessment_data.get("detailed_metrics"))
            json_safe_raw_inputs = make_json_serializable(assessment_data.get("raw_inputs"))
            json_safe_metadata = make_json_serializable(assessment_data.get("metadata", {}))
            
            db_assessment = SLCAAssessment(
                assessment_id=assessment_data["assessment_id"],
                user_id=assessment_data.get("user_id"),
                system_name=assessment_data.get("system_name"),
                overall_score=assessment_data["overall_score"],
                annual_scores=json_safe_annual_scores,
                stakeholder_group=assessment_data["stakeholder_group"],
                social_sustainability_rating=assessment_data["social_sustainability_rating"],
                stakeholder_impact_score=assessment_data.get("stakeholder_impact_score"),
                social_performance_trend=assessment_data.get("social_performance_trend"),
                key_metrics=json_safe_key_metrics,
                recommendations=json_safe_recommendations,
                detailed_metrics=json_safe_detailed_metrics,
                raw_inputs=json_safe_raw_inputs,
                meta_data=json_safe_metadata,
                submitted_at=original_submitted_at,
                processed_at=datetime.utcnow()
            )
            
            db.add(db_assessment)
            db.commit()
            db.refresh(db_assessment)
            logger.info(f"Saved S-LCA assessment {assessment_data['assessment_id']} to database")
            return db_assessment
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save S-LCA assessment {assessment_data.get('assessment_id')}: {e}")
            raise DatabaseConnectionException(f"Failed to save S-LCA assessment: {e}")
        finally:
            db.close()

    def get_assessment(self, assessment_id: str) -> Optional[SLCAAssessment]:
        """Get S-LCA assessment by ID"""
        db = self.get_session()
        try:
            assessment = db.query(SLCAAssessment).filter(
                SLCAAssessment.assessment_id == assessment_id
            ).first()
            
            if assessment:
                logger.info(f"Retrieved S-LCA assessment {assessment_id} from database")
            else:
                logger.warning(f"S-LCA assessment {assessment_id} not found in database")
                
            return assessment
            
        except Exception as e:
            logger.error(f"Failed to retrieve S-LCA assessment {assessment_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve S-LCA assessment: {e}")
        finally:
            db.close()