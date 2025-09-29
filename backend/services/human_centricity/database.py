from datetime import datetime
from typing import List, Optional, Dict, Any
import json
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, Boolean, create_engine, text
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


class DynamicStatement(Base):
    """Table for managing custom statements within fixed domains"""
    __tablename__ = "dynamic_statements"
    
    id = Column(String, primary_key=True)
    domain_key = Column(String, index=True, nullable=False)  # HumanCentricityDomain enum value
    statement_text = Column(String, nullable=False)
    widget = Column(String, default="likert")  # UI widget type
    scale_key = Column(String, default="likert_7_point")  # Scale configuration key
    widget_config = Column(JSON, default={})  # Widget-specific configuration
    display_order = Column(Integer, default=0)
    is_required = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)  # Enable/disable without deletion
    is_default = Column(Boolean, default=False)  # Original default statement
    meta_data = Column(JSON, default={})
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

    def get_assessments_by_user(self, user_id: str) -> List[HumanCentricityAssessment]:
        """Get all assessments for a specific user"""
        db = self.get_session()
        try:
            assessments = db.query(HumanCentricityAssessment).filter(
                HumanCentricityAssessment.user_id == user_id
            ).order_by(HumanCentricityAssessment.created_at.desc()).all()
            
            logger.info(f"Retrieved {len(assessments)} assessments for user {user_id}")
            return assessments
            
        except Exception as e:
            logger.error(f"Failed to retrieve assessments for user {user_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve user assessments: {e}")
        finally:
            db.close()

    # Statement Management Methods

    def save_statement(self, statement_data: Dict[str, Any]) -> DynamicStatement:
        """Save a dynamic statement to database"""
        db = self.get_session()
        try:
            # Generate ID if not provided
            if 'id' not in statement_data or not statement_data['id']:
                from uuid import uuid4
                statement_data['id'] = str(uuid4())
            
            db_statement = DynamicStatement(
                id=statement_data['id'],
                domain_key=statement_data['domain_key'],
                statement_text=statement_data['statement_text'],
                widget=statement_data.get('widget', 'likert'),
                scale_key=statement_data.get('scale_key', 'likert_7_point'),
                widget_config=make_json_serializable(statement_data.get('widget_config', {})),
                display_order=statement_data.get('display_order', 0),
                is_required=statement_data.get('is_required', True),
                is_active=statement_data.get('is_active', True),
                is_default=statement_data.get('is_default', False),
                meta_data=make_json_serializable(statement_data.get('meta_data', {}))
            )
            
            db.add(db_statement)
            db.commit()
            db.refresh(db_statement)
            logger.info(f"Saved statement {statement_data['id']} to database")
            return db_statement
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save statement {statement_data.get('id')}: {e}")
            raise DatabaseConnectionException(f"Failed to save statement: {e}")
        finally:
            db.close()

    def get_statement(self, statement_id: str) -> Optional[DynamicStatement]:
        """Get statement by ID"""
        db = self.get_session()
        try:
            statement = db.query(DynamicStatement).filter(
                DynamicStatement.id == statement_id
            ).first()
            
            if statement:
                logger.info(f"Retrieved statement {statement_id} from database")
            else:
                logger.warning(f"Statement {statement_id} not found in database")
                
            return statement
            
        except Exception as e:
            logger.error(f"Failed to retrieve statement {statement_id}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve statement: {e}")
        finally:
            db.close()

    def get_statements_by_domain(self, domain_key: str, active_only: bool = True) -> List[DynamicStatement]:
        """Get all statements for a specific domain"""
        db = self.get_session()
        try:
            query = db.query(DynamicStatement).filter(
                DynamicStatement.domain_key == domain_key
            )
            
            if active_only:
                query = query.filter(DynamicStatement.is_active == True)
            
            statements = query.order_by(DynamicStatement.display_order).all()
            
            logger.info(f"Retrieved {len(statements)} statements for domain {domain_key}")
            return statements
            
        except Exception as e:
            logger.error(f"Failed to retrieve statements for domain {domain_key}: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve domain statements: {e}")
        finally:
            db.close()

    def get_all_active_statements(self) -> List[DynamicStatement]:
        """Get all active statements grouped by domain"""
        db = self.get_session()
        try:
            statements = db.query(DynamicStatement).filter(
                DynamicStatement.is_active == True
            ).order_by(DynamicStatement.domain_key, DynamicStatement.display_order).all()
            
            logger.info(f"Retrieved {len(statements)} active statements")
            return statements
            
        except Exception as e:
            logger.error(f"Failed to retrieve active statements: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve active statements: {e}")
        finally:
            db.close()

    def update_statement(self, statement_id: str, update_data: Dict[str, Any]) -> Optional[DynamicStatement]:
        """Update an existing statement"""
        db = self.get_session()
        try:
            statement = db.query(DynamicStatement).filter(
                DynamicStatement.id == statement_id
            ).first()
            
            if not statement:
                logger.warning(f"Statement {statement_id} not found for update")
                return None
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(statement, field):
                    if field in ['widget_config', 'meta_data']:
                        setattr(statement, field, make_json_serializable(value))
                    else:
                        setattr(statement, field, value)
            
            statement.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(statement)
            logger.info(f"Updated statement {statement_id}")
            return statement
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update statement {statement_id}: {e}")
            raise DatabaseConnectionException(f"Failed to update statement: {e}")
        finally:
            db.close()

    def delete_statement(self, statement_id: str) -> bool:
        """Delete a statement"""
        db = self.get_session()
        try:
            deleted_count = db.query(DynamicStatement).filter(
                DynamicStatement.id == statement_id
            ).delete()
            
            db.commit()
            success = deleted_count > 0
            
            if success:
                logger.info(f"Deleted statement {statement_id}")
            else:
                logger.warning(f"Statement {statement_id} not found for deletion")
            
            return success
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete statement {statement_id}: {e}")
            raise DatabaseConnectionException(f"Failed to delete statement: {e}")
        finally:
            db.close()

    def bulk_create_default_statements(self, statements_data: List[Dict[str, Any]]) -> List[DynamicStatement]:
        """Bulk create default statements for initialization"""
        db = self.get_session()
        try:
            created_statements = []
            
            for stmt_data in statements_data:
                # Generate ID if not provided
                if 'id' not in stmt_data or not stmt_data['id']:
                    from uuid import uuid4
                    stmt_data['id'] = str(uuid4())
                
                db_statement = DynamicStatement(
                    id=stmt_data['id'],
                    domain_key=stmt_data['domain_key'],
                    statement_text=stmt_data['statement_text'],
                    widget=stmt_data.get('widget', 'likert'),
                    scale_key=stmt_data.get('scale_key', 'likert_7_point'),
                    widget_config=make_json_serializable(stmt_data.get('widget_config', {})),
                    display_order=stmt_data.get('display_order', 0),
                    is_required=stmt_data.get('is_required', True),
                    is_active=stmt_data.get('is_active', True),
                    is_default=stmt_data.get('is_default', True),
                    meta_data=make_json_serializable(stmt_data.get('meta_data', {}))
                )
                
                db.add(db_statement)
                created_statements.append(db_statement)
            
            db.commit()
            
            # Refresh all statements
            for statement in created_statements:
                db.refresh(statement)
            
            logger.info(f"Bulk created {len(created_statements)} default statements")
            return created_statements
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to bulk create statements: {e}")
            raise DatabaseConnectionException(f"Failed to bulk create statements: {e}")
        finally:
            db.close()

    def reset_domain_statements(self, domain_key: str) -> bool:
        """Delete all statements for a domain (used before resetting to defaults)"""
        db = self.get_session()
        try:
            deleted_count = db.query(DynamicStatement).filter(
                DynamicStatement.domain_key == domain_key
            ).delete()
            
            db.commit()
            logger.info(f"Deleted {deleted_count} statements for domain {domain_key}")
            return True
        
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to reset statements for domain {domain_key}: {e}")
            raise DatabaseConnectionException(f"Failed to reset domain statements: {e}")
        finally:
            db.close()

    def get_statement_count_by_domain(self) -> Dict[str, int]:
        """Get statement counts grouped by domain"""
        db = self.get_session()
        try:
            from sqlalchemy import func
            
            results = db.query(
                DynamicStatement.domain_key,
                func.count(DynamicStatement.id).label('count')
            ).filter(
                DynamicStatement.is_active == True
            ).group_by(DynamicStatement.domain_key).all()
            
            return {result.domain_key: result.count for result in results}
        
        except Exception as e:
            logger.error(f"Failed to get statement counts by domain: {e}")
            raise DatabaseConnectionException(f"Failed to get statement counts: {e}")
        finally:
            db.close()