from datetime import datetime
from typing import Optional, Dict, Any, List
import json
import uuid
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, Boolean, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

from shared.database import get_database_url
from shared.models.exceptions import DatabaseConnectionException, AssessmentNotFoundException
from .config import settings
from .models import DEFAULT_RESILIENCE_SCENARIOS, RESILIENCE_SCENARIOS

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


class ResilienceAssessment(Base):
    __tablename__ = "resilience_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    
    # Scores
    overall_score = Column(Float, nullable=False)
    domain_scores = Column(JSON, nullable=False)
    risk_metrics = Column(JSON, nullable=False)
    
    # Raw input data
    raw_assessments = Column(JSON, nullable=False)
    meta_data = Column(JSON, default={})
    
    # Timestamps
    submitted_at = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ResilienceScenario(Base):
    __tablename__ = "resilience_scenarios"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    domain = Column(String, nullable=False, index=True)
    scenario_text = Column(String, nullable=False)
    description = Column(String)
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
            
            # Initialize default scenarios if they don't exist
            self._initialize_default_scenarios()
            
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise DatabaseConnectionException(f"Failed to create tables: {e}")
    
    def _initialize_default_scenarios(self):
        """Initialize default scenarios in database if they don't exist"""
        db = self.get_session()
        try:
            # Check if default scenarios already exist
            existing_count = db.query(ResilienceScenario).filter(
                ResilienceScenario.is_default == True
            ).count()
            
            if existing_count == 0:
                logger.info("Initializing default resilience scenarios...")
                
                for domain, domain_data in DEFAULT_RESILIENCE_SCENARIOS.items():
                    for scenario_text in domain_data['scenarios']:
                        scenario = ResilienceScenario(
                            domain=domain,
                            scenario_text=scenario_text,
                            description=domain_data['description'],
                            is_default=True
                        )
                        db.add(scenario)
                
                db.commit()
                logger.info("Default scenarios initialized successfully")
            else:
                logger.info(f"Found {existing_count} existing default scenarios")
                
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to initialize default scenarios: {e}")
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
    
    def save_assessment(self, assessment_data: Dict[str, Any]) -> ResilienceAssessment:
        """Save resilience assessment to database"""
        db = self.get_session()
        try:
            # Convert all data to JSON-serializable format
            json_safe_data = make_json_serializable(assessment_data)
            
            db_assessment = ResilienceAssessment(
                assessment_id=json_safe_data["assessment_id"],
                user_id=json_safe_data.get("user_id"),
                system_name=json_safe_data.get("system_name"),
                overall_score=json_safe_data["overall_score"],
                domain_scores=json_safe_data["domain_scores"],
                risk_metrics=json_safe_data["risk_metrics"],
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
    
    def get_assessment(self, assessment_id: str) -> Optional[ResilienceAssessment]:
        """Get assessment by ID"""
        db = self.get_session()
        try:
            assessment = db.query(ResilienceAssessment).filter(
                ResilienceAssessment.assessment_id == assessment_id
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
    
    # Scenario management methods
    def get_all_scenarios(self) -> List[ResilienceScenario]:
        """Get all scenarios from database"""
        db = self.get_session()
        try:
            scenarios = db.query(ResilienceScenario).order_by(
                ResilienceScenario.domain, ResilienceScenario.created_at
            ).all()
            return scenarios
        except Exception as e:
            logger.error(f"Failed to retrieve scenarios: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve scenarios: {e}")
        finally:
            db.close()
    
    def get_scenarios_by_domain(self, domain: str) -> List[ResilienceScenario]:
        """Get scenarios for a specific domain"""
        db = self.get_session()
        try:
            scenarios = db.query(ResilienceScenario).filter(
                ResilienceScenario.domain == domain
            ).order_by(ResilienceScenario.created_at).all()
            return scenarios
        except Exception as e:
            logger.error(f"Failed to retrieve scenarios for domain {domain}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve scenarios: {e}")
        finally:
            db.close()
    
    def create_scenario(self, scenario_data: Dict[str, Any]) -> ResilienceScenario:
        """Create a new scenario"""
        db = self.get_session()
        try:
            scenario = ResilienceScenario(
                domain=scenario_data['domain'],
                scenario_text=scenario_data['scenario_text'],
                description=scenario_data.get('description'),
                is_default=scenario_data.get('is_default', False)
            )
            
            db.add(scenario)
            db.commit()
            db.refresh(scenario)
            
            # Update in-memory scenarios
            self._refresh_scenarios_cache()
            
            logger.info(f"Created scenario {scenario.id} for domain {scenario.domain}")
            return scenario
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create scenario: {e}")
            raise DatabaseConnectionException(f"Failed to create scenario: {e}")
        finally:
            db.close()
    
    def update_scenario(self, scenario_id: str, update_data: Dict[str, Any]) -> Optional[ResilienceScenario]:
        """Update an existing scenario"""
        db = self.get_session()
        try:
            scenario = db.query(ResilienceScenario).filter(
                ResilienceScenario.id == scenario_id
            ).first()
            
            if not scenario:
                return None
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(scenario, field) and value is not None:
                    setattr(scenario, field, value)
            
            scenario.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(scenario)
            
            # Update in-memory scenarios
            self._refresh_scenarios_cache()
            
            logger.info(f"Updated scenario {scenario_id}")
            return scenario
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update scenario {scenario_id}: {e}")
            raise DatabaseConnectionException(f"Failed to update scenario: {e}")
        finally:
            db.close()
    
    def delete_scenario(self, scenario_id: str) -> bool:
        """Delete a scenario"""
        db = self.get_session()
        try:
            scenario = db.query(ResilienceScenario).filter(
                ResilienceScenario.id == scenario_id
            ).first()
            
            if not scenario:
                return False
            
            db.delete(scenario)
            db.commit()
            
            # Update in-memory scenarios
            self._refresh_scenarios_cache()
            
            logger.info(f"Deleted scenario {scenario_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete scenario {scenario_id}: {e}")
            raise DatabaseConnectionException(f"Failed to delete scenario: {e}")
        finally:
            db.close()
    
    def _refresh_scenarios_cache(self):
        """Refresh the in-memory scenarios cache from database"""
        try:
            scenarios = self.get_all_scenarios()
            
            # Rebuild RESILIENCE_SCENARIOS dict
            new_scenarios = {}
            
            for scenario in scenarios:
                if scenario.domain not in new_scenarios:
                    new_scenarios[scenario.domain] = {
                        'description': scenario.description or DEFAULT_RESILIENCE_SCENARIOS.get(scenario.domain, {}).get('description', ''),
                        'scenarios': []
                    }
                
                new_scenarios[scenario.domain]['scenarios'].append(scenario.scenario_text)
            
            # Update global variable
            global RESILIENCE_SCENARIOS
            RESILIENCE_SCENARIOS.clear()
            RESILIENCE_SCENARIOS.update(new_scenarios)
            
            logger.info("Scenarios cache refreshed successfully")
            
        except Exception as e:
            logger.error(f"Failed to refresh scenarios cache: {e}")