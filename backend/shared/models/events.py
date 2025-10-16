from datetime import datetime
from typing import Dict, Any, Optional, List
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
    RECOMMENDATION_REQUESTED = "recommendation_requested"
    RECOMMENDATION_COMPLETED = "recommendation_completed"


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



class CustomCriteriaInfo(BaseModel):
    """Information about custom criteria in an assessment"""
    domain: str  # sustainability, resilience, human_centricity
    criterion_id: str
    criterion_name: str
    is_custom: bool = True


class RecommendationRequestEvent(BaseEvent):
    """
    Event requesting AI-generated recommendations for a completed assessment.
    Contains all context needed for the recommendation service.
    """
    event_type: EventType = EventType.RECOMMENDATION_REQUESTED
    
    # Core assessment data
    system_name: Optional[str] = None
    overall_score: float
    domain_scores: Dict[str, float]  # e.g., {"sustainability": 56.5, "resilience": 66.7}
    
    # Detailed metrics from each domain scorer
    detailed_metrics: Dict[str, Any]  # Full output from each domain
    
    # Custom criteria detection
    has_custom_criteria: bool = False
    custom_criteria: List[CustomCriteriaInfo] = Field(default_factory=list)
    
    # Priority areas for focused recommendations
    low_scoring_domains: List[str] = Field(default_factory=list)  # Domains < 60
    priority_areas: Dict[str, List[str]] = Field(default_factory=dict)
    
    # Assessment configuration
    domains_assessed: List[str] = Field(default_factory=list)
    assessment_type: str = "full"  # full, quick, custom
    
    # Weighting information (if applicable)
    domain_weights: Optional[Dict[str, float]] = None


class Recommendation(BaseModel):
    """Single recommendation item"""
    domain: str  # sustainability, resilience, human_centricity
    category: str  # e.g., "economic", "Adaptability", "Core_Usability"
    title: str
    description: str
    priority: str = "medium"  # low, medium, high, critical
    estimated_impact: Optional[str] = None  # Expected score improvement
    implementation_effort: Optional[str] = None  # low, medium, high
    
    # Source tracking
    source: str = "ai"  # ai, rule_based, hybrid
    criterion_id: Optional[str] = None  # Reference to specific criterion
    
    # Metadata
    confidence_score: Optional[float] = None  # AI confidence 0-1


class RecommendationCompletedEvent(BaseEvent):
    """Event when recommendations have been generated"""
    event_type: EventType = EventType.RECOMMENDATION_COMPLETED
    
    recommendations: List[Recommendation]
    
    # Generation metadata
    source: str = "ai"  # ai, cache, fallback
    generation_time_ms: Optional[float] = None
    model_used: Optional[str] = None  # e.g., "groq-llama3-70b"
    
    # Cache info
    cache_hit: bool = False
    cache_key: Optional[str] = None
    
    # Feedback tracking
    feedback_id: Optional[str] = None  # For user feedback collection


# ============================================================================
# Event Factory Extensions
# ============================================================================

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
    
    @staticmethod
    def create_recommendation_request_event(
        assessment_id: str,
        user_id: Optional[str],
        system_name: Optional[str],
        overall_score: float,
        domain_scores: Dict[str, float],
        detailed_metrics: Dict[str, Any],
        custom_criteria: List[CustomCriteriaInfo] = None,
        **kwargs
    ) -> RecommendationRequestEvent:
        """
        Create recommendation request from assessment completion data.
        Automatically detects low-scoring areas and priority domains.
        """
        # Detect low scoring domains (< 60)
        low_scoring = [domain for domain, score in domain_scores.items() if score < 60]
        
        # Extract priority areas from detailed metrics
        priority_areas = EventFactory._extract_priority_areas(detailed_metrics)
        
        return RecommendationRequestEvent(
            assessment_id=assessment_id,
            user_id=user_id,
            system_name=system_name,
            overall_score=overall_score,
            domain_scores=domain_scores,
            detailed_metrics=detailed_metrics,
            has_custom_criteria=bool(custom_criteria),
            custom_criteria=custom_criteria or [],
            low_scoring_domains=low_scoring,
            priority_areas=priority_areas,
            domains_assessed=list(domain_scores.keys()),
            **kwargs
        )
    
    @staticmethod
    def create_recommendation_completed_event(
        assessment_id: str,
        user_id: Optional[str],
        recommendations: List[Recommendation],
        source: str = "ai",
        generation_time_ms: Optional[float] = None,
        **kwargs
    ) -> RecommendationCompletedEvent:
        return RecommendationCompletedEvent(
            assessment_id=assessment_id,
            user_id=user_id,
            recommendations=recommendations,
            source=source,
            generation_time_ms=generation_time_ms,
            **kwargs
        )
    
    @staticmethod
    def _extract_priority_areas(detailed_metrics: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Extract specific low-performing criteria from detailed metrics.
        Returns dict of {domain: [list of low-scoring criterion names]}
        """
        priority_areas = {}
        
        # Sustainability
        if "sustainability" in detailed_metrics:
            sus_metrics = detailed_metrics["sustainability"]
            low_criteria = []
            
            if "detailed_metrics" in sus_metrics:
                for dimension, criteria in sus_metrics["detailed_metrics"].items():
                    for crit_id, crit_data in criteria.items():
                        if crit_data.get("level_index", 5) <= 2:  # Level 1-2 out of 5
                            low_criteria.append(crit_data.get("criterion_name", crit_id))
            
            if low_criteria:
                priority_areas["sustainability"] = low_criteria
        
        # Resilience - high risk scenarios
        if "resilience" in detailed_metrics:
            res_metrics = detailed_metrics["resilience"]
            high_risk_scenarios = []
            
            if "risk_metrics" in res_metrics and "detailed_metrics" in res_metrics["risk_metrics"]:
                for domain, data in res_metrics["risk_metrics"]["detailed_metrics"].items():
                    if data.get("mean_risk_score", 0) > 10:  # High risk
                        high_risk_scenarios.append(domain)
            
            if high_risk_scenarios:
                priority_areas["resilience"] = high_risk_scenarios
        
        # Human Centricity - low scoring domains
        if "human_centricity" in detailed_metrics:
            hc_metrics = detailed_metrics["human_centricity"]
            low_domains = []
            
            if "domain_scores" in hc_metrics:
                for domain, score in hc_metrics["domain_scores"].items():
                    if score < 55:  # Below average
                        low_domains.append(domain)
            
            if low_domains:
                priority_areas["human_centricity"] = low_domains
        
        return priority_areas