from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from pydantic import BaseModel, Field, validator


class StakeholderGroup(str, Enum):
    WORKERS = "workers"
    COMMUNITY = "community"
    CONSUMERS = "consumers"
    SUPPLIERS = "suppliers"
    SOCIETY = "society"


class SocialIndicators(BaseModel):
    """Social sustainability indicators for S-LCA assessment"""
    safety_incident_reduction: List[float] = Field(..., description="Annual % reduction in safety incidents")
    worker_satisfaction: List[float] = Field(..., description="Worker satisfaction scores (0-100)")
    community_engagement: List[float] = Field(..., description="Community engagement scores (0-100)")
    job_creation: List[int] = Field(..., description="Number of new jobs created per year")
    skills_development: List[float] = Field(..., description="Skills development index (0-100)")
    health_safety_improvements: List[float] = Field(..., description="Health & safety improvements (0-100)")
    local_employment: List[float] = Field(..., description="Local employment index (0-100)")
    gender_equality: List[float] = Field(..., description="Gender equality index (0-100)")
    fair_wages: List[float] = Field(..., description="Fair wages index (0-100)")
    working_conditions: List[float] = Field(..., description="Working conditions index (0-100)")
    community_investment: List[float] = Field(..., description="Community investment index (0-100)")
    cultural_preservation: List[float] = Field(..., description="Cultural preservation index (0-100)")
    stakeholder_participation: List[float] = Field(..., description="Stakeholder participation index (0-100)")

    @validator('*', pre=True)
    def validate_positive_values(cls, v):
        if isinstance(v, list):
            for val in v:
                if val < 0:
                    raise ValueError("All indicator values must be non-negative")
        return v


class SLCAInput(BaseModel):
    """Input model for S-LCA assessment"""
    analysisId: Optional[str] = Field(None, description="Unique identifier for the analysis")
    userId: Optional[str] = Field(None, description="User identifier")
    systemName: Optional[str] = Field(None, description="Name of the system being analyzed")
    stakeholderGroup: StakeholderGroup = Field(StakeholderGroup.WORKERS, description="Primary stakeholder group")
    years: int = Field(..., description="Number of years in assessment", ge=1, le=50)
    indicators: SocialIndicators = Field(..., description="Social sustainability indicators")
    weightings: Optional[Dict[str, float]] = Field(None, description="Custom weightings for indicators")
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when analysis was submitted")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    @validator('weightings')
    def validate_weightings(cls, v):
        if v is not None:
            if abs(sum(v.values()) - 1.0) > 1e-6:
                raise ValueError("Weightings must sum to 1.0")
            for weight in v.values():
                if weight < 0 or weight > 1:
                    raise ValueError("All weights must be between 0 and 1")
        return v


class SLCAResult(BaseModel):
    """Result model for S-LCA assessment"""
    analysisId: str
    annual_scores: List[float]
    overall_score: float
    social_sustainability_rating: str
    stakeholder_impact_score: float
    social_performance_trend: str
    key_metrics: Dict[str, float]
    recommendations: List[str]
    stakeholder_group: str
    timestamp: datetime
    processingTimeMs: float


class SLCAStructure(BaseModel):
    """Structure information for S-LCA assessments"""
    stakeholder_groups: List[str]
    stakeholder_descriptions: Dict[str, str]
    indicators: List[str]
    indicator_descriptions: Dict[str, str]
    rating_scales: Dict[str, Any]
    default_weightings: Dict[str, Dict[str, float]]


# Constants and configuration
STAKEHOLDER_DESCRIPTIONS = {
    StakeholderGroup.WORKERS.value: "Direct employees and workers affected by the digital twin implementation",
    StakeholderGroup.COMMUNITY.value: "Local communities and broader societal groups impacted by operations",
    StakeholderGroup.CONSUMERS.value: "End users and customers of products/services enabled by the digital twin",
    StakeholderGroup.SUPPLIERS.value: "Supply chain partners and vendors involved in the digital twin ecosystem",
    StakeholderGroup.SOCIETY.value: "General society and future generations affected by the digital transformation"
}

INDICATOR_DESCRIPTIONS = {
    "safety_incident_reduction": "Percentage reduction in safety incidents year-over-year",
    "worker_satisfaction": "Worker satisfaction scores measured on 0-100 scale",
    "community_engagement": "Community engagement levels measured on 0-100 scale",
    "job_creation": "Number of new jobs created per year",
    "skills_development": "Skills development and training opportunities index (0-100)",
    "health_safety_improvements": "Health and safety improvements index (0-100)",
    "local_employment": "Local employment opportunities index (0-100)",
    "gender_equality": "Gender equality and diversity index (0-100)",
    "fair_wages": "Fair wages and compensation index (0-100)",
    "working_conditions": "Working conditions quality index (0-100)",
    "community_investment": "Community investment and development index (0-100)",
    "cultural_preservation": "Cultural heritage preservation index (0-100)",
    "stakeholder_participation": "Stakeholder participation in decision-making index (0-100)"
}

DEFAULT_WEIGHTINGS = {
    StakeholderGroup.WORKERS.value: {
        'safety_incident_reduction': 0.25,
        'worker_satisfaction': 0.20,
        'skills_development': 0.15,
        'health_safety_improvements': 0.15,
        'fair_wages': 0.15,
        'working_conditions': 0.10
    },
    StakeholderGroup.COMMUNITY.value: {
        'community_engagement': 0.25,
        'local_employment': 0.20,
        'community_investment': 0.20,
        'cultural_preservation': 0.15,
        'job_creation': 0.10,
        'stakeholder_participation': 0.10
    },
    StakeholderGroup.CONSUMERS.value: {
        'cultural_preservation': 0.25,
        'community_engagement': 0.20,
        'worker_satisfaction': 0.15,
        'health_safety_improvements': 0.15,
        'fair_wages': 0.15,
        'gender_equality': 0.10
    },
    StakeholderGroup.SUPPLIERS.value: {
        'fair_wages': 0.25,
        'working_conditions': 0.20,
        'skills_development': 0.15,
        'local_employment': 0.15,
        'gender_equality': 0.15,
        'stakeholder_participation': 0.10
    },
    StakeholderGroup.SOCIETY.value: {
        'community_investment': 0.20,
        'cultural_preservation': 0.20,
        'gender_equality': 0.15,
        'local_employment': 0.15,
        'job_creation': 0.15,
        'stakeholder_participation': 0.15
    }
}