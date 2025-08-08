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


class LCCAssessment(Base):
    __tablename__ = "lcc_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    industry_type = Column(String, nullable=False)
    
    # Financial Metrics
    npv = Column(Float)
    irr = Column(Float)
    payback_period = Column(Integer)
    roi = Column(Float)
    
    # Scores
    economic_sustainability_score = Column(Float, nullable=False)
    sustainability_rating = Column(String, nullable=False)
    dt_implementation_maturity = Column(Float, nullable=False)
    benefit_cost_ratio = Column(Float, nullable=False)
    transformation_readiness = Column(Float, nullable=False)
    
    # Detailed data
    score_components = Column(JSON, nullable=False)
    input_data = Column(JSON, nullable=False)  # Original input
    detailed_results = Column(JSON, nullable=False)  # Full analysis results
    
    # Metadata
    capex = Column(Float, nullable=False)
    discount_rate = Column(Float, nullable=False)
    analysis_years = Column(Integer)
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
    
    def save_assessment(self, assessment_data: Dict[str, Any]) -> LCCAssessment:
        """Save LCC assessment to database"""
        db = self.get_session()
        try:
            # Keep original datetime objects for database fields
            original_submitted_at = assessment_data.get("submitted_at")
            
            # Use datetime object or current time if None
            if not isinstance(original_submitted_at, datetime):
                original_submitted_at = datetime.utcnow()
            
            # Convert data that goes into JSON columns to JSON-serializable format
            json_safe_score_components = make_json_serializable(assessment_data.get("score_components"))
            json_safe_input_data = make_json_serializable(assessment_data.get("input_data"))
            json_safe_detailed_results = make_json_serializable(assessment_data.get("detailed_results"))
            json_safe_metadata = make_json_serializable(assessment_data.get("metadata", {}))
            
            db_assessment = LCCAssessment(
                assessment_id=assessment_data["assessment_id"],
                user_id=assessment_data.get("user_id"),
                system_name=assessment_data.get("system_name"),
                industry_type=assessment_data["industry_type"],
                
                # Financial metrics
                npv=assessment_data.get("npv"),
                irr=assessment_data.get("irr"),
                payback_period=assessment_data.get("payback_period"),
                roi=assessment_data.get("roi"),
                
                # Scores
                economic_sustainability_score=assessment_data["economic_sustainability_score"],
                sustainability_rating=assessment_data["sustainability_rating"],
                dt_implementation_maturity=assessment_data["dt_implementation_maturity"],
                benefit_cost_ratio=assessment_data["benefit_cost_ratio"],
                transformation_readiness=assessment_data["transformation_readiness"],
                
                # Detailed data (JSON serialized)
                score_components=json_safe_score_components,
                input_data=json_safe_input_data,
                detailed_results=json_safe_detailed_results,
                
                # Metadata
                capex=assessment_data["capex"],
                discount_rate=assessment_data["discount_rate"],
                analysis_years=assessment_data.get("analysis_years"),
                meta_data=json_safe_metadata,
                
                submitted_at=original_submitted_at,  # Keep as datetime object
                processed_at=datetime.utcnow()
            )
            
            db.add(db_assessment)
            db.commit()
            db.refresh(db_assessment)
            logger.info(f"Saved LCC assessment {assessment_data['assessment_id']} to database")
            return db_assessment
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save LCC assessment {assessment_data.get('assessment_id')}: {e}")
            raise DatabaseConnectionException(f"Failed to save assessment: {e}")
        finally:
            db.close()

    def get_assessment(self, assessment_id: str) -> Optional[LCCAssessment]:
        """Get assessment by ID"""
        db = self.get_session()
        try:
            assessment = db.query(LCCAssessment).filter(
                LCCAssessment.assessment_id == assessment_id
            ).first()
            
            if assessment:
                logger.info(f"Retrieved LCC assessment {assessment_id} from database")
            else:
                logger.warning(f"LCC assessment {assessment_id} not found in database")
                
            return assessment
            
        except Exception as e:
            logger.error(f"Failed to retrieve LCC assessment {assessment_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve assessment: {e}")
        finally:
            db.close()

    def get_assessments_by_user(self, user_id: str, limit: int = 50) -> list[LCCAssessment]:
        """Get assessments by user ID"""
        db = self.get_session()
        try:
            assessments = db.query(LCCAssessment).filter(
                LCCAssessment.user_id == user_id
            ).order_by(LCCAssessment.created_at.desc()).limit(limit).all()
            
            logger.info(f"Retrieved {len(assessments)} LCC assessments for user {user_id}")
            return assessments
            
        except Exception as e:
            logger.error(f"Failed to retrieve assessments for user {user_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve assessments: {e}")
        finally:
            db.close()

    def get_assessments_by_industry(self, industry: str, limit: int = 100) -> list[LCCAssessment]:
        """Get assessments by industry type"""
        db = self.get_session()
        try:
            assessments = db.query(LCCAssessment).filter(
                LCCAssessment.industry_type == industry
            ).order_by(LCCAssessment.created_at.desc()).limit(limit).all()
            
            logger.info(f"Retrieved {len(assessments)} LCC assessments for industry {industry}")
            return assessments
            
        except Exception as e:
            logger.error(f"Failed to retrieve assessments for industry {industry}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve assessments: {e}")
        finally:
            db.close()