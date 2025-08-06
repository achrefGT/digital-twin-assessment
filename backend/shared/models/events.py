from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum

# Import existing shared models
from .assessment import FormSubmissionRequest, AssessmentProgress


class EventType(str, Enum):
    FORM_SUBMITTED = "form_submitted"
    DOMAIN_SCORED = "domain_scored"
    ASSESSMENT_COMPLETED = "assessment_completed"
    ASSESSMENT_STATUS_UPDATED = "assessment_status_updated"
    ERROR_OCCURRED = "error_occurred"


class BaseEvent(BaseModel):
    """Base event model for Kafka messages"""
    event_type: EventType
    assessment_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        use_enum_values = True


class FormSubmissionEvent(BaseEvent):
    """Event for form submissions using shared FormSubmissionRequest"""
    event_type: EventType = EventType.FORM_SUBMITTED
    submission: FormSubmissionRequest
    
    def __init__(self, submission: FormSubmissionRequest, **kwargs):
        # Auto-populate fields from submission
        super().__init__(
            assessment_id=submission.assessment_id,
            user_id=submission.user_id,
            submission=submission,
            **kwargs
        )


class DomainScoredEvent(BaseEvent):
    """Event when a domain has been scored"""
    event_type: EventType = EventType.DOMAIN_SCORED
    domain: str
    scores: Dict[str, Any]
    processing_time_ms: Optional[float] = None
    score_value: float


class AssessmentCompletedEvent(BaseEvent):
    """Event when full assessment is completed"""
    event_type: EventType = EventType.ASSESSMENT_COMPLETED
    overall_score: float
    domain_scores: Dict[str, float]
    final_results: Dict[str, Any]
    progress: AssessmentProgress


class AssessmentStatusUpdatedEvent(BaseEvent):
    """Event when assessment status is updated"""
    event_type: EventType = EventType.ASSESSMENT_STATUS_UPDATED
    progress: AssessmentProgress
    previous_status: Optional[str] = None
    
    def __init__(self, progress: AssessmentProgress, previous_status: Optional[str] = None, **kwargs):
        # Auto-populate fields from progress
        super().__init__(
            assessment_id=progress.assessment_id,
            user_id=progress.user_id,
            progress=progress,
            previous_status=previous_status,
            **kwargs
        )


class ErrorEvent(BaseEvent):
    """Event for error conditions"""
    event_type: EventType = EventType.ERROR_OCCURRED
    error_type: str
    error_message: str
    error_details: Dict[str, Any] = Field(default_factory=dict)
    domain: Optional[str] = None


# Event factory for easy creation
class EventFactory:
    """Factory for creating events from shared models"""
    
    @staticmethod
    def create_form_submission_event(submission: FormSubmissionRequest, **kwargs) -> FormSubmissionEvent:
        return FormSubmissionEvent(submission=submission, **kwargs)
    
    @staticmethod
    def create_status_update_event(progress: AssessmentProgress, previous_status: Optional[str] = None, **kwargs) -> AssessmentStatusUpdatedEvent:
        return AssessmentStatusUpdatedEvent(progress=progress, previous_status=previous_status, **kwargs)
    
    @staticmethod
    def create_domain_scored_event(assessment_id: str, domain: str, scores: Dict[str, Any], 
                                 score_value: float, user_id: Optional[str] = None, **kwargs) -> DomainScoredEvent:
        return DomainScoredEvent(
            assessment_id=assessment_id,
            user_id=user_id,
            domain=domain,
            scores=scores,
            score_value=score_value,
            **kwargs
        )
    
    @staticmethod
    def create_assessment_completed_event(progress: AssessmentProgress, overall_score: float,
                                        domain_scores: Dict[str, float], final_results: Dict[str, Any], **kwargs) -> AssessmentCompletedEvent:
        return AssessmentCompletedEvent(
            assessment_id=progress.assessment_id,
            user_id=progress.user_id,
            overall_score=overall_score,
            domain_scores=domain_scores,
            final_results=final_results,
            progress=progress,
            **kwargs
        )
    
    @staticmethod
    def create_error_event(assessment_id: str, error_type: str, error_message: str,
                          error_details: Dict[str, Any] = None, user_id: Optional[str] = None,
                          domain: Optional[str] = None, **kwargs) -> ErrorEvent:
        return ErrorEvent(
            assessment_id=assessment_id,
            user_id=user_id,
            error_type=error_type,
            error_message=error_message,
            error_details=error_details or {},
            domain=domain,
            **kwargs
        )