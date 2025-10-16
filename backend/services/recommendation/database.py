"""
Recommendation Service Database Manager
Stores AI-generated recommendations with full traceability
Following sustainability service database pattern
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
import json
import logging
from sqlalchemy import (
    Column, String, Float, DateTime, JSON, Integer, 
    Boolean, Text, create_engine, text, ForeignKey, Enum as SQLEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import enum

from shared.database import get_database_url
from shared.models.exceptions import DatabaseConnectionException

logger = logging.getLogger(__name__)
Base = declarative_base()


class RecommendationSource(str, enum.Enum):
    """Source of recommendation generation"""
    AI = "ai"
    RULE_BASED = "rule_based"
    HYBRID = "hybrid"
    MANUAL = "manual"


class RecommendationPriority(str, enum.Enum):
    """Priority level for recommendations"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecommendationStatus(str, enum.Enum):
    """Implementation status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"


class RecommendationSet(Base):
    """A set of recommendations generated for an assessment"""
    __tablename__ = "recommendation_sets"
    
    id = Column(Integer, primary_key=True, index=True)
    recommendation_set_id = Column(String, unique=True, index=True, nullable=False)
    assessment_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True)
    
    # Generation metadata
    source = Column(SQLEnum(RecommendationSource), nullable=False, default=RecommendationSource.AI)
    model_used = Column(String)  # e.g., "groq-llama-3.3-70b-versatile"
    generation_time_ms = Column(Float)
    
    # Assessment context (snapshot at generation time)
    overall_score = Column(Float)
    domain_scores = Column(JSON)  # {domain: score}
    detailed_metrics = Column(JSON)  # Full detailed metrics snapshot
    
    # Custom criteria tracking
    has_custom_criteria = Column(Boolean, default=False)
    custom_criteria_info = Column(JSON)  # List of custom criteria used
    
    # Statistics
    total_recommendations = Column(Integer, default=0)
    recommendations_by_priority = Column(JSON)  # {critical: X, high: Y, ...}
    recommendations_by_domain = Column(JSON)  # {sustainability: X, resilience: Y, ...}
    
    # Timestamps
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to individual recommendations
    recommendations = relationship("Recommendation", back_populates="recommendation_set", cascade="all, delete-orphan")


class Recommendation(Base):
    """Individual recommendation within a set"""
    __tablename__ = "recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(String, unique=True, index=True, nullable=False)
    recommendation_set_id = Column(String, ForeignKey("recommendation_sets.recommendation_set_id"), nullable=False)
    
    # Recommendation details
    domain = Column(String, index=True, nullable=False)
    category = Column(String, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    
    # Prioritization
    priority = Column(SQLEnum(RecommendationPriority), nullable=False, default=RecommendationPriority.MEDIUM)
    estimated_impact = Column(String)  # e.g., "+5-8 points"
    implementation_effort = Column(String)  # "low", "medium", "high"
    
    # Source tracking
    source = Column(SQLEnum(RecommendationSource), nullable=False)
    criterion_id = Column(String)  # Link to specific criterion (e.g., "ENV_05", "SOC_01")
    confidence_score = Column(Float)  # AI confidence (0.0-1.0)
    
    # Custom criteria flag
    is_custom_criterion = Column(Boolean, default=False)
    custom_criterion_details = Column(JSON)  # Full custom criterion info if applicable
    
    # Implementation tracking
    status = Column(SQLEnum(RecommendationStatus), default=RecommendationStatus.PENDING)
    implementation_notes = Column(Text)
    implemented_at = Column(DateTime)
    
    # User feedback
    user_rating = Column(Integer)  # 1-5 stars
    user_feedback = Column(Text)
    feedback_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship back to set
    recommendation_set = relationship("RecommendationSet", back_populates="recommendations")


class RecommendationFeedback(Base):
    """Detailed feedback on recommendation usefulness (for ML training)"""
    __tablename__ = "recommendation_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(String, ForeignKey("recommendations.recommendation_id"), nullable=False)
    user_id = Column(String, index=True, nullable=False)
    
    # Feedback dimensions
    relevance_score = Column(Integer)  # 1-5: How relevant was this?
    clarity_score = Column(Integer)  # 1-5: How clear was this?
    actionability_score = Column(Integer)  # 1-5: How actionable was this?
    
    # Implementation outcome (if implemented)
    was_implemented = Column(Boolean)
    actual_impact = Column(String)  # Actual score improvement if measured
    implementation_time = Column(String)  # Actual time taken
    
    # Free text
    feedback_text = Column(Text)
    
    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class RecommendationDatabaseManager:
    """Database manager for recommendation service - follows sustainability pattern"""
    
    def __init__(self, database_url: str = None):
        try:
            if database_url is None:
                from .config import settings
                database_url = settings.database_url
            
            self.database_url = database_url
            self.engine = create_engine(
                self.database_url,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
            self.SessionLocal = sessionmaker(
                autocommit=False, 
                autoflush=False, 
                bind=self.engine, 
                expire_on_commit=False
            )
            logger.info("Recommendation database connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise DatabaseConnectionException(f"Failed to connect to database: {e}")
    
    def create_tables(self):
        """Create all database tables"""
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("✅ Recommendation database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise DatabaseConnectionException(f"Failed to create tables: {e}")
    
    def get_session(self):
        """Get database session"""
        try:
            return self.SessionLocal()
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise DatabaseConnectionException(f"Failed to create session: {e}")
    
    def health_check(self) -> bool:
        """Check database health"""
        try:
            with self.get_session() as db:
                db.execute(text("SELECT 1"))
                return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    # ==================== RECOMMENDATION SET OPERATIONS ====================
    
    def save_recommendation_set(
        self,
        recommendation_set_data: Dict[str, Any],
        recommendations: List[Dict[str, Any]]
    ) -> RecommendationSet:
        """Save a complete recommendation set with all recommendations"""
        db = self.get_session()
        try:
            # Calculate statistics
            priority_counts = {}
            domain_counts = {}
            has_custom = False
            custom_info = []
            
            for rec in recommendations:
                # Priority counts
                priority = rec.get('priority', 'medium')
                priority_counts[priority] = priority_counts.get(priority, 0) + 1
                
                # Domain counts
                domain = rec.get('domain', 'general')
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
                
                # Custom criteria tracking
                if rec.get('is_custom_criterion') or rec.get('criterion_id', '').endswith('_CUSTOM'):
                    has_custom = True
                    if rec.get('custom_criterion_details'):
                        custom_info.append(rec['custom_criterion_details'])
            
            # Create recommendation set
            db_set = RecommendationSet(
                recommendation_set_id=recommendation_set_data['recommendation_set_id'],
                assessment_id=recommendation_set_data['assessment_id'],
                user_id=recommendation_set_data.get('user_id'),
                source=recommendation_set_data.get('source', 'ai'),
                model_used=recommendation_set_data.get('model_used'),
                generation_time_ms=recommendation_set_data.get('generation_time_ms'),
                overall_score=recommendation_set_data.get('overall_score'),
                domain_scores=recommendation_set_data.get('domain_scores', {}),
                detailed_metrics=recommendation_set_data.get('detailed_metrics', {}),
                has_custom_criteria=has_custom,
                custom_criteria_info=custom_info if custom_info else None,
                total_recommendations=len(recommendations),
                recommendations_by_priority=priority_counts,
                recommendations_by_domain=domain_counts,
                generated_at=recommendation_set_data.get('generated_at', datetime.utcnow())
            )
            
            db.add(db_set)
            db.flush()  # Get the ID
            
            # Create individual recommendations
            for rec_data in recommendations:
                db_rec = Recommendation(
                    recommendation_id=rec_data['recommendation_id'],
                    recommendation_set_id=db_set.recommendation_set_id,
                    domain=rec_data['domain'],
                    category=rec_data.get('category'),
                    title=rec_data['title'],
                    description=rec_data['description'],
                    priority=rec_data.get('priority', 'medium'),
                    estimated_impact=rec_data.get('estimated_impact'),
                    implementation_effort=rec_data.get('implementation_effort'),
                    source=rec_data.get('source', 'ai'),
                    criterion_id=rec_data.get('criterion_id'),
                    confidence_score=rec_data.get('confidence_score'),
                    is_custom_criterion=rec_data.get('is_custom_criterion', False),
                    custom_criterion_details=rec_data.get('custom_criterion_details')
                )
                db.add(db_rec)
            
            db.commit()
            db.refresh(db_set)
            
            logger.info(
                f"Saved recommendation set {db_set.recommendation_set_id} "
                f"with {len(recommendations)} recommendations"
            )
            return db_set
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save recommendation set: {e}")
            raise DatabaseConnectionException(f"Failed to save recommendation set: {e}")
        finally:
            db.close()
    
    def get_recommendation_set(self, recommendation_set_id: str) -> Optional[RecommendationSet]:
        """Get recommendation set by ID with all recommendations"""
        db = self.get_session()
        try:
            rec_set = db.query(RecommendationSet).filter(
                RecommendationSet.recommendation_set_id == recommendation_set_id
            ).first()
            
            if rec_set:
                # Force load recommendations
                _ = rec_set.recommendations
                logger.info(f"Retrieved recommendation set {recommendation_set_id}")
            
            return rec_set
            
        except Exception as e:
            logger.error(f"Failed to retrieve recommendation set: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve recommendation set: {e}")
        finally:
            db.close()
    
    def get_recommendations_by_assessment(
        self, 
        assessment_id: str,
        latest_only: bool = True
    ) -> List[RecommendationSet]:
        """Get recommendation sets for an assessment"""
        db = self.get_session()
        try:
            query = db.query(RecommendationSet).filter(
                RecommendationSet.assessment_id == assessment_id
            )
            
            if latest_only:
                query = query.order_by(RecommendationSet.generated_at.desc()).limit(1)
            else:
                query = query.order_by(RecommendationSet.generated_at.desc())
            
            rec_sets = query.all()
            
            # Force load recommendations
            for rec_set in rec_sets:
                _ = rec_set.recommendations
            
            logger.info(f"Retrieved {len(rec_sets)} recommendation sets for assessment {assessment_id}")
            return rec_sets
            
        except Exception as e:
            logger.error(f"Failed to retrieve recommendations for assessment: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve recommendations: {e}")
        finally:
            db.close()
    
    def get_recommendations_by_user(
        self, 
        user_id: str,
        limit: int = 10
    ) -> List[RecommendationSet]:
        """Get recent recommendation sets for a user"""
        db = self.get_session()
        try:
            rec_sets = db.query(RecommendationSet).filter(
                RecommendationSet.user_id == user_id
            ).order_by(
                RecommendationSet.generated_at.desc()
            ).limit(limit).all()
            
            # Force load recommendations
            for rec_set in rec_sets:
                _ = rec_set.recommendations
            
            logger.info(f"Retrieved {len(rec_sets)} recommendation sets for user {user_id}")
            return rec_sets
            
        except Exception as e:
            logger.error(f"Failed to retrieve user recommendations: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve user recommendations: {e}")
        finally:
            db.close()
    
    # ==================== INDIVIDUAL RECOMMENDATION OPERATIONS ====================
    
    def get_recommendation(self, recommendation_id: str) -> Optional[Recommendation]:
        """Get a single recommendation by ID"""
        db = self.get_session()
        try:
            return db.query(Recommendation).filter(
                Recommendation.recommendation_id == recommendation_id
            ).first()
        except Exception as e:
            logger.error(f"Failed to retrieve recommendation: {e}")
            raise DatabaseConnectionException(f"Failed to retrieve: {e}")
        finally:
            db.close()
    
    def update_recommendation_status(
        self,
        recommendation_id: str,
        status: RecommendationStatus,
        notes: Optional[str] = None
    ) -> Optional[Recommendation]:
        """Update implementation status of a recommendation"""
        db = self.get_session()
        try:
            rec = db.query(Recommendation).filter(
                Recommendation.recommendation_id == recommendation_id
            ).first()
            
            if rec:
                rec.status = status
                if notes:
                    rec.implementation_notes = notes
                if status == RecommendationStatus.COMPLETED:
                    rec.implemented_at = datetime.utcnow()
                
                db.commit()
                db.refresh(rec)
                logger.info(f"Updated recommendation {recommendation_id} status to {status}")
            
            return rec
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update recommendation: {e}")
            raise DatabaseConnectionException(f"Failed to update: {e}")
        finally:
            db.close()
    
    def add_recommendation_rating(
        self,
        recommendation_id: str,
        rating: int,
        feedback: Optional[str] = None
    ) -> Optional[Recommendation]:
        """Add user rating and feedback to recommendation"""
        db = self.get_session()
        try:
            rec = db.query(Recommendation).filter(
                Recommendation.recommendation_id == recommendation_id
            ).first()
            
            if rec:
                rec.user_rating = rating
                if feedback:
                    rec.user_feedback = feedback
                rec.feedback_at = datetime.utcnow()
                
                db.commit()
                db.refresh(rec)
                logger.info(f"Added rating {rating} to recommendation {recommendation_id}")
            
            return rec
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to add rating: {e}")
            raise DatabaseConnectionException(f"Failed to add rating: {e}")
        finally:
            db.close()
    
    def save_detailed_feedback(
        self,
        feedback_data: Dict[str, Any]
    ) -> RecommendationFeedback:
        """Save detailed feedback for ML training"""
        db = self.get_session()
        try:
            feedback = RecommendationFeedback(
                recommendation_id=feedback_data['recommendation_id'],
                user_id=feedback_data['user_id'],
                relevance_score=feedback_data.get('relevance_score'),
                clarity_score=feedback_data.get('clarity_score'),
                actionability_score=feedback_data.get('actionability_score'),
                was_implemented=feedback_data.get('was_implemented'),
                actual_impact=feedback_data.get('actual_impact'),
                implementation_time=feedback_data.get('implementation_time'),
                feedback_text=feedback_data.get('feedback_text')
            )
            
            db.add(feedback)
            db.commit()
            db.refresh(feedback)
            
            logger.info(f"Saved detailed feedback for recommendation {feedback_data['recommendation_id']}")
            return feedback
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save feedback: {e}")
            raise DatabaseConnectionException(f"Failed to save feedback: {e}")
        finally:
            db.close()
    
    # ==================== ANALYTICS & STATISTICS ====================
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get overall recommendation statistics"""
        db = self.get_session()
        try:
            total_sets = db.query(RecommendationSet).count()
            total_recommendations = db.query(Recommendation).count()
            
            # Status breakdown
            status_counts = {}
            for status in RecommendationStatus:
                count = db.query(Recommendation).filter(
                    Recommendation.status == status
                ).count()
                status_counts[status.value] = count
            
            # Source breakdown
            source_counts = {}
            for source in RecommendationSource:
                count = db.query(RecommendationSet).filter(
                    RecommendationSet.source == source
                ).count()
                source_counts[source.value] = count
            
            # Average ratings
            from sqlalchemy import func
            avg_rating = db.query(func.avg(Recommendation.user_rating)).scalar() or 0
            
            return {
                "total_recommendation_sets": total_sets,
                "total_recommendations": total_recommendations,
                "status_breakdown": status_counts,
                "source_breakdown": source_counts,
                "average_user_rating": float(avg_rating),
                "recommendations_with_feedback": db.query(Recommendation).filter(
                    Recommendation.user_rating.isnot(None)
                ).count()
            }
            
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            return {"error": str(e)}
        finally:
            db.close()