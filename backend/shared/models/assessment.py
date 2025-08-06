from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class AssessmentStatus(str, Enum):
    STARTED = "started"
    RESILIENCE_COMPLETE = "resilience_complete"
    SUSTAINABILITY_COMPLETE = "sustainability_complete" 
    HUMAN_CENTRICITY_COMPLETE = "human_centricity_complete"
    ALL_COMPLETE = "all_complete"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AssessmentProgress(BaseModel):
    """Track assessment progress across domains"""
    assessment_id: str
    user_id: Optional[str] = None
    system_name: Optional[str] = None
    status: AssessmentStatus = AssessmentStatus.STARTED
    
    # Domain completion flags
    resilience_submitted: bool = False
    sustainability_submitted: bool = False
    human_centricity_submitted: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    # Results when available
    domain_scores: Dict[str, float] = Field(default_factory=dict)
    overall_score: Optional[float] = None


class FormSubmissionRequest(BaseModel):
    """Generic form submission request"""
    assessment_id: Optional[str] = None
    user_id: Optional[str] = None
    system_name: Optional[str] = None
    domain: str  # resilience, sustainability, human_centricity
    form_data: Dict[str, Any]
    metadata: Dict[str, Any] = Field(default_factory=dict)
