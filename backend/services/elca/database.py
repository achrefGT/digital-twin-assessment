from datetime import datetime
from typing import Optional, Dict, Any
import json
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, Text, create_engine, text
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


class ELCAAssessment(Base):
    __tablename__ = "elca_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    
    # ELCA Scores
    elca_score = Column(Float, nullable=False)
    environmental_rating = Column(String, nullable=False)
    rating_description = Column(Text)
    
    # Score breakdowns
    category_breakdown = Column(JSON, nullable=False)
    performance_analysis = Column(JSON, nullable=False)
    weighting_scheme = Column(String, default="recipe_2016")
    
    # LCA Results
    detailed_impacts = Column(JSON, nullable=False)
    key_performance_indicators = Column(JSON, nullable=False)
    sustainability_insights = Column(JSON, nullable=False)
    
    # Configuration data
    configuration_summary = Column(JSON, nullable=False)
    raw_configuration = Column(JSON, nullable=False)
    
    # Processing metadata
    processing_time_ms = Column(Float)
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
            logger.info("ELCA database connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize ELCA database connection: {e}")
            raise DatabaseConnectionException(f"Failed to connect to database: {e}")
        
    def create_tables(self):
        """Create database tables"""
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("ELCA database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create ELCA tables: {e}")
            raise DatabaseConnectionException(f"Failed to create tables: {e}")
        
    def get_session(self):
        """Get database session"""
        try:
            return self.SessionLocal()
        except Exception as e:
            logger.error(f"Failed to create ELCA database session: {e}")
            raise DatabaseConnectionException(f"Failed to create database session: {e}")
    
    def health_check(self) -> bool:
        """Check database health"""
        try:
            with self.get_session() as db:
                db.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"ELCA database health check failed: {e}")
            return False
    
    def save_assessment(self, assessment_data: Dict[str, Any]) -> ELCAAssessment:
        """Save ELCA assessment to database"""
        db = self.get_session()
        try:
            # Convert all data to JSON-serializable format
            json_safe_data = make_json_serializable(assessment_data)
            
            # Extract ELCA score details
            elca_result = json_safe_data.get("elca_scores", {}).get("recipe_2016", {})
            
            assessment_id = json_safe_data.get("assessment_id")
            
            # Fallback validation - if no assessment_id at root, check other locations
            if not assessment_id:
                # Try to get from user_id context or other sources
                assessment_id = json_safe_data.get("user_id", "unknown")
                logger.warning(f"No assessment_id found in data, using fallback: {assessment_id}")
            
            db_assessment = ELCAAssessment(
                assessment_id=assessment_id,
                user_id=json_safe_data.get("user_id"),
                # System name goes in the system_name field, not assessment_id
                system_name=json_safe_data["configuration_summary"].get("name"),
                
                # ELCA scores
                elca_score=elca_result.get("elca_score", 0.0),
                environmental_rating=elca_result.get("rating", "Unknown"),
                rating_description=elca_result.get("rating_description", ""),
                
                # Score details
                category_breakdown=elca_result.get("category_breakdown", {}),
                performance_analysis=elca_result.get("performance_analysis", {}),
                weighting_scheme=elca_result.get("weighting_scheme", "recipe_2016"),
                
                # LCA results
                detailed_impacts=json_safe_data.get("detailed_impacts", {}),
                key_performance_indicators=json_safe_data.get("key_performance_indicators", {}),
                sustainability_insights=json_safe_data.get("sustainability_insights", {}),
                
                # Configuration
                configuration_summary=json_safe_data.get("configuration_summary", {}),
                raw_configuration=json_safe_data.get("raw_configuration", {}),
                
                # Processing metadata
                processing_time_ms=json_safe_data.get("processing_time_ms", 0.0),
                meta_data=json_safe_data.get("metadata", {}),
                
                # Timestamps
                submitted_at=datetime.fromisoformat(json_safe_data["submitted_at"]) if json_safe_data.get("submitted_at") else datetime.utcnow(),
                processed_at=datetime.utcnow()
            )
            
            db.add(db_assessment)
            db.commit()
            db.refresh(db_assessment)
            logger.info(f"Saved ELCA assessment {assessment_id} to database with system name: {json_safe_data.get('configuration_summary', {}).get('name', 'unknown')}")
            return db_assessment
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save ELCA assessment {assessment_data.get('assessment_id', 'unknown')}: {e}")
            raise DatabaseConnectionException(f"Failed to save ELCA assessment: {e}")
        finally:
            db.close()
    
    def get_assessment(self, assessment_id: str) -> Optional[ELCAAssessment]:
        """Get ELCA assessment by ID"""
        db = self.get_session()
        try:
            assessment = db.query(ELCAAssessment).filter(
                ELCAAssessment.assessment_id == assessment_id
            ).first()
            
            if assessment:
                logger.info(f"Retrieved ELCA assessment {assessment_id} from database")
            else:
                logger.warning(f"ELCA assessment {assessment_id} not found in database")
                
            return assessment
            
        except Exception as e:
            logger.error(f"Failed to retrieve ELCA assessment {assessment_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve ELCA assessment: {e}")
        finally:
            db.close()
    
    def get_assessments_by_user(self, user_id: str, limit: int = 10) -> list[ELCAAssessment]:
        """Get ELCA assessments by user ID"""
        db = self.get_session()
        try:
            assessments = db.query(ELCAAssessment).filter(
                ELCAAssessment.user_id == user_id
            ).order_by(ELCAAssessment.created_at.desc()).limit(limit).all()
            
            logger.info(f"Retrieved {len(assessments)} ELCA assessments for user {user_id}")
            return assessments
            
        except Exception as e:
            logger.error(f"Failed to retrieve ELCA assessments for user {user_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve ELCA assessments: {e}")
        finally:
            db.close()
    
    def get_recent_assessments(self, limit: int = 10) -> list[ELCAAssessment]:
        """Get most recent ELCA assessments"""
        db = self.get_session()
        try:
            assessments = db.query(ELCAAssessment).order_by(
                ELCAAssessment.created_at.desc()
            ).limit(limit).all()
            
            logger.info(f"Retrieved {len(assessments)} recent ELCA assessments")
            return assessments
            
        except Exception as e:
            logger.error(f"Failed to retrieve recent ELCA assessments: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve recent ELCA assessments: {e}")
        finally:
            db.close()
    
    def get_assessment_statistics(self) -> Dict[str, Any]:
        """Get ELCA assessment statistics"""
        db = self.get_session()
        try:
            from sqlalchemy import func
            
            stats = db.query(
                func.count(ELCAAssessment.id).label('total_assessments'),
                func.avg(ELCAAssessment.elca_score).label('average_score'),
                func.min(ELCAAssessment.elca_score).label('min_score'),
                func.max(ELCAAssessment.elca_score).label('max_score'),
                func.avg(ELCAAssessment.processing_time_ms).label('avg_processing_time_ms')
            ).first()
            
            rating_counts = db.query(
                ELCAAssessment.environmental_rating,
                func.count(ELCAAssessment.id).label('count')
            ).group_by(ELCAAssessment.environmental_rating).all()
            
            return {
                'total_assessments': stats.total_assessments or 0,
                'average_score': float(stats.average_score or 0),
                'min_score': float(stats.min_score or 0),
                'max_score': float(stats.max_score or 0),
                'avg_processing_time_ms': float(stats.avg_processing_time_ms or 0),
                'rating_distribution': {rating: count for rating, count in rating_counts}
            }
            
        except Exception as e:
            logger.error(f"Failed to retrieve ELCA assessment statistics: {e}")
            return {}
        finally:
            db.close()