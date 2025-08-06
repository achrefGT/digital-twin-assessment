import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field


class LikertResponse(BaseModel):
    statement: str
    rating: int = Field(..., ge=1, le=7, description="1-7 Likert scale rating")


class CybersicknessResponse(BaseModel):
    symptom: str
    severity: int = Field(..., ge=1, le=5, description="1-5 severity scale")


class WorkloadMetrics(BaseModel):
    mental_demand: int = Field(..., ge=0, le=100, description="Mental demand (0-100)")
    effort_required: int = Field(..., ge=0, le=100, description="Effort required (0-100)")
    frustration_level: int = Field(..., ge=0, le=100, description="Frustration level (0-100)")


class EmotionalResponse(BaseModel):
    valence: int = Field(..., ge=1, le=5, description="Valence: 1=Negative, 5=Positive")
    arousal: int = Field(..., ge=1, le=5, description="Arousal: 1=Calm, 5=Excited")


class PerformanceMetrics(BaseModel):
    task_completion_time_min: float = Field(..., ge=0, description="Task completion time in minutes")
    error_rate: int = Field(..., ge=0, description="Number of errors per task")
    help_requests: int = Field(..., ge=0, description="Number of help requests")


class HumanCentricityInput(BaseModel):
    assessmentId: Optional[str] = Field(None, description="Unique identifier for the assessment")
    userId: Optional[str] = Field(None, description="User identifier")
    systemName: Optional[str] = Field(None, description="Name of the system being assessed")
    
    # Assessment responses
    ux_trust_responses: List[LikertResponse] = Field(..., description="UX and Trust Likert responses")
    workload_metrics: WorkloadMetrics = Field(..., description="Mental workload metrics")
    cybersickness_responses: List[CybersicknessResponse] = Field(..., description="Cybersickness symptom responses")
    emotional_response: EmotionalResponse = Field(..., description="SAM emotional response")
    performance_metrics: PerformanceMetrics = Field(..., description="Objective performance metrics")
    
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when assessment was submitted")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class HumanCentricityResult(BaseModel):
    assessmentId: str
    overallScore: float
    domainScores: Dict[str, float]
    detailedMetrics: Dict[str, Any]
    timestamp: datetime
    processingTimeMs: float


class HumanCentricityStructure(BaseModel):
    statements: Dict[str, List[str]]
    scales: Dict[str, Dict[str, Any]]


# Assessment statements configuration
ASSESSMENT_STATEMENTS = {
    'UX_Trust': [
        "I found the digital twin intuitive and easy to use.",
        "The system's functions feel well integrated and coherent.",
        "I would use this digital twin frequently in my work.",
        "Learning to operate the system was quick and straightforward.",
        "I feel confident and in control when using the twin.",
        "The terminology and workflows match my domain expertise.",
        "I can easily tailor views, dashboards, and alerts to my needs.",
        "I feel comfortable with how the system collects, uses, and displays my data.",
        "I understand the origins and currency of the data shown.",
        "The system explains how it generated its insights or recommendations.",
        "I trust the accuracy and reliability of the digital twin's outputs.",
        "I feel confident making operational decisions based on the twin's insights."
    ],
    'Cybersickness': [
        "Queasiness or nausea",
        "Dizziness or off-balance feeling",  
        "Eye strain or visual discomfort"
    ]
}