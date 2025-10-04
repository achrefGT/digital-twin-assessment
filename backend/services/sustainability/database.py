from datetime import datetime
from typing import Optional, Dict, Any, List
import json
import uuid
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, Boolean, Text, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

from shared.database import get_database_url
from shared.models.exceptions import DatabaseConnectionException, AssessmentNotFoundException
from .config import settings
from .models import DEFAULT_SUSTAINABILITY_SCENARIOS, SUSTAINABILITY_SCENARIOS

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


class SustainabilityAssessment(Base):
    __tablename__ = "sustainability_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    
    # Scores
    overall_score = Column(Float, nullable=False)
    dimension_scores = Column(JSON, nullable=False)  # environmental, economic, social
    sustainability_metrics = Column(JSON, nullable=False)
    
    # Raw input data
    raw_assessments = Column(JSON, nullable=False)
    meta_data = Column(JSON, default={})
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SustainabilityCriterion(Base):
    __tablename__ = "sustainability_criteria"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    criterion_key = Column(String, nullable=False, index=True)  # e.g., 'digital_twin_realism'
    name = Column(String, nullable=False)
    description = Column(Text)
    domain = Column(String, nullable=False, index=True)  # environmental, economic, social
    level_count = Column(Integer, default=6)
    custom_levels = Column(JSON)  # Array of level descriptions
    is_default = Column(Boolean, default=False)
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
            
            # Initialize default criteria if they don't exist
            self._initialize_default_criteria()
            
            # CRITICAL: Refresh criteria cache from database after initialization
            # This ensures SUSTAINABILITY_SCENARIOS is up-to-date with database state
            self._refresh_criteria_cache()
            
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise DatabaseConnectionException(f"Failed to create tables: {e}")
    
    def _initialize_default_criteria(self):
        """Initialize default criteria in database if they don't exist"""
        db = self.get_session()
        try:
            # Check if default criteria already exist
            existing_count = db.query(SustainabilityCriterion).filter(
                SustainabilityCriterion.is_default == True
            ).count()
            
            if existing_count == 0:
                logger.info("Initializing default sustainability criteria...")
                
                for domain, domain_data in DEFAULT_SUSTAINABILITY_SCENARIOS.items():
                    for criterion_key, criterion_data in domain_data['criteria'].items():
                        criterion = SustainabilityCriterion(
                            criterion_key=criterion_key,
                            name=criterion_data['name'],
                            description=criterion_data['description'],
                            domain=domain,
                            level_count=len(criterion_data['levels']),
                            custom_levels=criterion_data['levels'],
                            is_default=True
                        )
                        db.add(criterion)
                
                db.commit()
                logger.info("Default criteria initialized successfully")
            else:
                logger.info(f"Found {existing_count} existing default criteria")
                
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to initialize default criteria: {e}")
        finally:
            db.close()
        
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
    
    def save_assessment(self, assessment_data: Dict[str, Any]) -> SustainabilityAssessment:
        """Save sustainability assessment to database"""
        db = self.get_session()
        try:
            # Convert all data to JSON-serializable format
            json_safe_data = make_json_serializable(assessment_data)
            
            db_assessment = SustainabilityAssessment(
                assessment_id=json_safe_data["assessment_id"],
                user_id=json_safe_data.get("user_id"),
                system_name=json_safe_data.get("system_name"),
                overall_score=json_safe_data["overall_score"],
                dimension_scores=json_safe_data["dimension_scores"],
                sustainability_metrics=json_safe_data["sustainability_metrics"],
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
    
    def get_assessment(self, assessment_id: str) -> Optional[SustainabilityAssessment]:
        """Get assessment by ID"""
        db = self.get_session()
        try:
            assessment = db.query(SustainabilityAssessment).filter(
                SustainabilityAssessment.assessment_id == assessment_id
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
    
    # Criterion management methods
    def get_all_criteria(self) -> List[SustainabilityCriterion]:
        """Get all criteria from database"""
        db = self.get_session()
        try:
            criteria = db.query(SustainabilityCriterion).order_by(
                SustainabilityCriterion.domain, SustainabilityCriterion.created_at
            ).all()
            return criteria
        except Exception as e:
            logger.error(f"Failed to retrieve criteria: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve criteria: {e}")
        finally:
            db.close()
    
    def get_criteria_by_domain(self, domain: str) -> List[SustainabilityCriterion]:
        """Get criteria for a specific domain"""
        db = self.get_session()
        try:
            criteria = db.query(SustainabilityCriterion).filter(
                SustainabilityCriterion.domain == domain
            ).order_by(SustainabilityCriterion.created_at).all()
            return criteria
        except Exception as e:
            logger.error(f"Failed to retrieve criteria for domain {domain}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve criteria: {e}")
        finally:
            db.close()
    
    def create_criterion(self, criterion_data: Dict[str, Any]) -> SustainabilityCriterion:
        """Create a new criterion"""
        db = self.get_session()
        try:
            criterion = SustainabilityCriterion(
                criterion_key=criterion_data['criterion_key'],
                name=criterion_data['name'],
                description=criterion_data.get('description'),
                domain=criterion_data['domain'],
                level_count=criterion_data.get('level_count', 6),
                custom_levels=criterion_data.get('custom_levels'),
                is_default=criterion_data.get('is_default', False)
            )
            
            db.add(criterion)
            db.commit()
            db.refresh(criterion)
            
            # Update in-memory scenarios
            self._refresh_criteria_cache()
            
            logger.info(f"Created criterion {criterion.id} for domain {criterion.domain}")
            return criterion
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create criterion: {e}")
            raise DatabaseConnectionException(f"Failed to create criterion: {e}")
        finally:
            db.close()
    
    def update_criterion(self, criterion_id: str, update_data: Dict[str, Any]) -> Optional[SustainabilityCriterion]:
        """Update an existing criterion"""
        db = self.get_session()
        try:
            criterion = db.query(SustainabilityCriterion).filter(
                SustainabilityCriterion.id == criterion_id
            ).first()
            
            if not criterion:
                return None
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(criterion, field) and value is not None:
                    setattr(criterion, field, value)
            
            criterion.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(criterion)
            
            # Update in-memory scenarios
            self._refresh_criteria_cache()
            
            logger.info(f"Updated criterion {criterion_id}")
            return criterion
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update criterion {criterion_id}: {e}")
            raise DatabaseConnectionException(f"Failed to update criterion: {e}")
        finally:
            db.close()
    
    def delete_criterion(self, criterion_id: str) -> bool:
        """Delete a criterion"""
        db = self.get_session()
        try:
            criterion = db.query(SustainabilityCriterion).filter(
                SustainabilityCriterion.id == criterion_id
            ).first()
            
            if not criterion:
                return False
            
            db.delete(criterion)
            db.commit()
            
            # Update in-memory scenarios
            self._refresh_criteria_cache()
            
            logger.info(f"Deleted criterion {criterion_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete criterion {criterion_id}: {e}")
            raise DatabaseConnectionException(f"Failed to delete criterion: {e}")
        finally:
            db.close()
    
    def _refresh_criteria_cache(self):
        """Refresh the in-memory criteria cache from database"""
        try:
            criteria = self.get_all_criteria()
            
            # Rebuild SUSTAINABILITY_SCENARIOS dict
            new_scenarios = {}
            
            for criterion in criteria:
                if criterion.domain not in new_scenarios:
                    new_scenarios[criterion.domain] = {
                        'description': DEFAULT_SUSTAINABILITY_SCENARIOS.get(criterion.domain, {}).get('description', ''),
                        'criteria': {}
                    }
                
                new_scenarios[criterion.domain]['criteria'][criterion.criterion_key] = {
                    'name': criterion.name,
                    'description': criterion.description or '',
                    'levels': criterion.custom_levels or []
                }
            
            # Update global variable
            global SUSTAINABILITY_SCENARIOS
            SUSTAINABILITY_SCENARIOS.clear()
            SUSTAINABILITY_SCENARIOS.update(new_scenarios)
            
            logger.info(f"Criteria cache refreshed successfully - {len(criteria)} criteria loaded")
            
        except Exception as e:
            logger.error(f"Failed to refresh criteria cache: {e}")