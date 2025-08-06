import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field


class LikelihoodLevel(str, Enum):
    RARE = "Rare"
    UNLIKELY = "Unlikely"
    POSSIBLE = "Possible"
    LIKELY = "Likely"
    ALMOST_CERTAIN = "Almost Certain"


class ImpactLevel(str, Enum):
    NEGLIGIBLE = "Negligible"
    MINOR = "Minor"
    MODERATE = "Moderate"
    MAJOR = "Major"
    CATASTROPHIC = "Catastrophic"


class ScenarioAssessment(BaseModel):
    likelihood: LikelihoodLevel
    impact: ImpactLevel


class DomainAssessment(BaseModel):
    scenarios: Dict[str, ScenarioAssessment]


class ResilienceInput(BaseModel):
    assessmentId: Optional[str] = Field(None, description="Unique identifier for the assessment")
    userId: Optional[str] = Field(None, description="User identifier")
    systemName: Optional[str] = Field(None, description="Name of the system being assessed")
    assessments: Dict[str, DomainAssessment] = Field(..., description="Resilience domain assessments")
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when assessment was submitted")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class ResilienceResult(BaseModel):
    assessmentId: str
    overallScore: float
    domainScores: Dict[str, float]
    riskMetrics: Dict[str, Any]
    timestamp: datetime
    processingTimeMs: float


class ResilienceScenarios(BaseModel):
    scenarios: Dict[str, List[str]]


# Resilience scenarios configuration
RESILIENCE_SCENARIOS = {
    'Robustness': [
        "Core model parameter drifts or becomes invalid",
        "Input data exceeds expected ranges",
        "Critical compute module crashes under load",
        "Required external service becomes unavailable"
    ],
    'Redundancy': [
        "Primary data channel fails",
        "Backup resources are offline when needed",
        "Multiple parallel processes stall simultaneously",
        "Failover logic does not trigger as designed"
    ],
    'Adaptability': [
        "System must incorporate a new asset type on‑the‑fly",
        "An unforeseen failure mode emerges",
        "Configuration parameters change unexpectedly",
        "Operational conditions shift beyond original design"
    ],
    'Rapidity': [
        "Anomaly detection delayed beyond alert threshold",
        "Recovery routines restart slower than required",
        "Operator notifications delayed by system lag",
        "Corrective actions cannot be executed in time"
    ],
    'PHM': [
        "Failure‑prediction accuracy degrades significantly",
        "Remaining‑useful‑life estimates deviate widely",
        "Maintenance recommendations cannot reach operators",
        "Health‑monitoring data streams are interrupted"
    ]
}
