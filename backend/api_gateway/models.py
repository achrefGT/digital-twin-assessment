from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy import Column, String, DateTime, JSON, Integer, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field, validator

# Import shared models
from shared.models.assessment import (
    AssessmentStatus, 
    AssessmentProgress, 
    FormSubmissionRequest
)

Base = declarative_base()


class Assessment(Base):
    """Database model for tracking assessments"""
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    system_name = Column(String)
    
    # Progress tracking - using shared enum
    status = Column(String, nullable=False, default=AssessmentStatus.STARTED.value)
    resilience_submitted = Column(Boolean, default=False)
    slca_submitted = Column(Boolean, default=False)
    lcc_submitted = Column(Boolean, default=False)
    elca_submitted = Column(Boolean, default=False)
    human_centricity_submitted = Column(Boolean, default=False)
    
    # Results (populated when available)
    domain_scores = Column(JSON, default={})
    overall_score = Column(JSON)  # Will store final aggregated score
    
    # Metadata
    meta_data = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    def to_progress_model(self) -> AssessmentProgress:
        """Convert SQLAlchemy model to shared Pydantic model"""
        return AssessmentProgress(
            assessment_id=self.assessment_id,
            user_id=self.user_id,
            system_name=self.system_name,
            status=AssessmentStatus(self.status),
            resilience_submitted=self.resilience_submitted,
            slca_submitted=self.slca_submitted,
            lcc_submitted=self.lcc_submitted,
            elca_submitted=self.elca_submitted,
            human_centricity_submitted=self.human_centricity_submitted,
            created_at=self.created_at,
            updated_at=self.updated_at,
            completed_at=self.completed_at,
            domain_scores=self.domain_scores or {},
            overall_score=self.overall_score
        )
    
    @classmethod
    def from_progress_model(cls, progress: AssessmentProgress) -> 'Assessment':
        """Create SQLAlchemy model from shared Pydantic model"""
        return cls(
            assessment_id=progress.assessment_id,
            user_id=progress.user_id,
            system_name=progress.system_name,
            status=progress.status.value,
            resilience_submitted=progress.resilience_submitted,
            elca_submitted=progress.elca_submitted,
            lcc_submitted=progress.lcc_submitted,
            slca_submitted=progress.slca_submitted,
            human_centricity_submitted=progress.human_centricity_submitted,
            created_at=progress.created_at,
            updated_at=progress.updated_at,
            completed_at=progress.completed_at,
            domain_scores=progress.domain_scores,
            overall_score=progress.overall_score
        )


class UserSession(Base):
    """Database model for user sessions"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    
    # Session data
    session_data = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


# Pydantic models for API - extending shared models where appropriate
class AssessmentCreate(BaseModel):
    user_id: Optional[str] = None
    system_name: Optional[str] = Field(None, min_length=1, max_length=255)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('metadata')
    def validate_metadata(cls, v):
        # Ensure metadata doesn't contain sensitive information
        if v and len(str(v)) > 10000:  # Limit metadata size
            raise ValueError("Metadata too large")
        return v


class AssessmentResponse(BaseModel):
    """API Response model based on AssessmentProgress"""
    assessment_id: str
    user_id: Optional[str] = None
    system_name: Optional[str] = None
    status: AssessmentStatus
    
    # Domain completion flags
    resilience_submitted: bool = False
    elca_submitted: bool = False
    lcc_submitted: bool = False
    slca_submitted: bool = False
    human_centricity_submitted: bool = False
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    
    # Results when available
    domain_scores: Dict[str, float] = Field(default_factory=dict)
    overall_score: Optional[float] = None
    
    class Config:
        from_attributes = True
        extra = "allow"
    
    @classmethod
    def from_orm(cls, obj):
        """Create from SQLAlchemy model"""
        if hasattr(obj, 'to_progress_model'):
            # Convert through progress model
            progress = obj.to_progress_model()
            return cls(
                assessment_id=progress.assessment_id,
                user_id=progress.user_id,
                system_name=progress.system_name,
                status=progress.status,
                resilience_submitted=progress.resilience_submitted,
                elca_submitted=progress.elca_submitted,
                lcc_submitted=progress.lcc_submitted,
                slca_submitted=progress.slca_submitted,
                human_centricity_submitted=progress.human_centricity_submitted,
                created_at=progress.created_at,
                updated_at=progress.updated_at,
                completed_at=progress.completed_at,
                domain_scores=progress.domain_scores,
                overall_score=progress.overall_score
            )
        else:
            # Direct conversion
            return cls(**obj.__dict__)


# Use shared FormSubmissionRequest directly or extend it
class FormSubmission(FormSubmissionRequest):
    """API-specific form submission model extending shared model"""
    
    @validator('domain')
    def validate_domain(cls, v):
        valid_domains = ["resilience", "slca", "elca", "lcc", "human_centricity"]
        if v not in valid_domains:
            raise ValueError(f"Invalid domain. Must be one of: {valid_domains}")
        return v
    
    @validator('form_data')
    def validate_form_data(cls, v):
        if not v:
            raise ValueError("Form data cannot be empty")
        if len(str(v)) > 50000:  # Limit form data size
            raise ValueError("Form data too large")
        return v


# Additional API-specific models
class AssessmentStatusUpdate(BaseModel):
    """Model for updating assessment status"""
    status: AssessmentStatus
    domain_scores: Optional[Dict[str, float]] = None
    overall_score: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class BulkAssessmentQuery(BaseModel):
    """Model for querying multiple assessments"""
    user_ids: Optional[List[str]] = None
    statuses: Optional[List[AssessmentStatus]] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    limit: int = Field(default=100, le=1000)
    offset: int = Field(default=0, ge=0)


# Service layer utilities
class AssessmentService:
    """Service class to handle business logic using shared models"""
    
    @staticmethod
    def update_progress_status(progress: AssessmentProgress) -> AssessmentStatus:
        """Update status based on domain completion using shared logic"""
        if progress.resilience_submitted and progress.elca_submitted and progress.lcc_submitted and progress.slca_submitted and progress.human_centricity_submitted:
            return AssessmentStatus.ALL_COMPLETE
        elif progress.human_centricity_submitted:
            return AssessmentStatus.HUMAN_CENTRICITY_COMPLETE
        elif progress.slca_submitted:
            return AssessmentStatus.SLCA_COMPLETE
        elif progress.elca_submitted:
            return AssessmentStatus.ELCA_COMPLETE
        elif progress.lcc_submitted:
            return AssessmentStatus.LCC_COMPLETE
        elif progress.resilience_submitted:
            return AssessmentStatus.RESILIENCE_COMPLETE
        else:
            return AssessmentStatus.STARTED
    
    @staticmethod
    def can_submit_domain(progress: AssessmentProgress, domain: str) -> bool:
        """Check if a domain can be submitted based on current progress"""
        domain_map = {
            "resilience": not progress.resilience_submitted,
            "slca": not progress.slca_submitted,
            "elca": not progress.elca_submitted,
            "lcc": not progress.lcc_submitted,
            "human_centricity": not progress.human_centricity_submitted
        }
        return domain_map.get(domain, False)
    
    @staticmethod
    def mark_domain_complete(progress: AssessmentProgress, domain: str) -> AssessmentProgress:
        """Mark a domain as complete and update progress"""
        if domain == "resilience":
            progress.resilience_submitted = True
        elif domain == "slca":
            progress.slca_submitted = True
        elif domain == "elca":
            progress.elca_submitted = True
        elif domain == "lcc":
            progress.lcc_submitted = True
        elif domain == "human_centricity":
            progress.human_centricity_submitted = True
        
        # Update status
        progress.status = AssessmentService.update_progress_status(progress)
        progress.updated_at = datetime.utcnow()
        
        return progress