import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Set
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field, validator


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


class ResilienceDomain(str, Enum):
    ROBUSTNESS = "Robustness"
    REDUNDANCY = "Redundancy"
    ADAPTABILITY = "Adaptability"
    RAPIDITY = "Rapidity"
    PHM = "PHM"


class ScenarioAssessment(BaseModel):
    likelihood: LikelihoodLevel
    impact: ImpactLevel


class DomainAssessment(BaseModel):
    scenarios: Dict[str, ScenarioAssessment]
    custom_scenarios: Optional[Dict[str, str]] = Field(default_factory=dict, description="User-defined scenarios")


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
    recommendations: Optional[List[str]] = Field(default_factory=list)


class ResilienceScenarios(BaseModel):
    scenarios: Dict[str, List[str]]
    domain_descriptions: Dict[str, str]
    scenario_categories: Dict[str, List[str]]

class ScenarioCreate(BaseModel):
    domain: str
    scenario_text: str
    description: Optional[str] = None
    is_default: bool = False

    @validator('domain')
    def validate_domain(cls, v):
        if v not in [domain.value for domain in ResilienceDomain]:
            raise ValueError(f"Domain must be one of: {[d.value for d in ResilienceDomain]}")
        return v


class ScenarioUpdate(BaseModel):
    scenario_text: Optional[str] = None
    domain: Optional[str] = None

    @validator('domain')
    def validate_domain(cls, v):
        if v and v not in [domain.value for domain in ResilienceDomain]:
            raise ValueError(f"Domain must be one of: {[d.value for d in ResilienceDomain]}")
        return v


class ScenarioResponse(BaseModel):
    id: str
    domain: str
    scenario_text: str
    description: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime


# Enhanced resilience scenarios configuration with original domains only
DEFAULT_RESILIENCE_SCENARIOS = {
    'Robustness': {
        'description': 'System ability to withstand stresses and continue operating',
        'scenarios': [
            "Core model parameter drifts or becomes invalid",
            "Input data exceeds expected ranges",
            "Critical compute module crashes under load",
            "Required external service becomes unavailable"
        ]
    },
    'Redundancy': {
        'description': 'System ability to maintain operations through backup resources',
        'scenarios': [
            "Primary data channel fails",
            "Backup resources are offline when needed",
            "Multiple parallel processes stall simultaneously",
            "Failover logic does not trigger as designed"
        ]
    },
    'Adaptability': {
        'description': 'System ability to adjust to changing conditions and requirements',
        'scenarios': [
            "System must incorporate a new asset type on-the-fly",
            "An unforeseen failure mode emerges",
            "Configuration parameters change unexpectedly",
            "Operational conditions shift beyond original design"
        ]
    },
    'Rapidity': {
        'description': 'System ability to respond quickly to disruptions',
        'scenarios': [
            "Anomaly detection delayed beyond alert threshold",
            "Recovery routines restart slower than required",
            "Operator notifications delayed by system lag",
            "Corrective actions cannot be executed in time"
        ]
    },
    'PHM': {
        'description': 'Prognostics and Health Management capabilities',
        'scenarios': [
            "Failure-prediction accuracy degrades significantly",
            "Remaining-useful-life estimates deviate widely",
            "Maintenance recommendations cannot reach operators",
            "Health-monitoring data streams are interrupted"
        ]
    }
}

DEFAULT_RESILIENCE_SCENARIOS_FR = {
    'Robustness': {
        'description': "Capacité du système à résister aux contraintes et à continuer de fonctionner",
        'scenarios': [
            "Les paramètres du modèle central dérivent ou deviennent invalides",
            "Les données d'entrée dépassent les plages prévues",
            "Un module de calcul critique plante sous charge",
            "Un service externe requis devient indisponible"
        ]
    },
    'Redundancy': {
        'description': "Capacité du système à maintenir les opérations grâce à des ressources de secours",
        'scenarios': [
            "Le canal de données principal tombe en panne",
            "Les ressources de secours sont hors ligne lorsqu'elles sont nécessaires",
            "Plusieurs processus parallèles se bloquent simultanément",
            "La logique de basculement ne se déclenche pas comme prévu"
        ]
    },
    'Adaptability': {
        'description': "Capacité du système à s'ajuster aux conditions et exigences changeantes",
        'scenarios': [
            "Le système doit intégrer un nouveau type d'actif à la volée",
            "Un mode de défaillance imprévu apparaît",
            "Les paramètres de configuration changent de façon inattendue",
            "Les conditions opérationnelles évoluent au-delà de la conception initiale"
        ]
    },
    'Rapidity': {
        'description': "Capacité du système à répondre rapidement aux perturbations",
        'scenarios': [
            "La détection d'anomalies est retardée au-delà du seuil d'alerte",
            "Les routines de récupération redémarrent plus lentement que requis",
            "Les notifications aux opérateurs sont retardées par la latence du système",
            "Les actions correctives ne peuvent pas être exécutées à temps"
        ]
    },
    'PHM': {
        'description': "Capacités de prognostics et de gestion de la santé (PHM)",
        'scenarios': [
            "La précision des prédictions de défaillance se dégrade significativement",
            "Les estimations de durée de vie restante s'écartent fortement",
            "Les recommandations de maintenance n'atteignent pas les opérateurs",
            "Les flux de données de surveillance de l'état sont interrompus"
        ]
    }
}

# This will be dynamically updated
RESILIENCE_SCENARIOS = DEFAULT_RESILIENCE_SCENARIOS_FR.copy()


class DomainSelectionHelper:
    """Helper class for managing domain selection and configuration"""
    
    @staticmethod
    def get_available_domains() -> List[Dict[str, Any]]:
        """Get list of available domains with descriptions"""
        return [
            {
                'domain': domain.value,
                'enum': domain,
                'description': RESILIENCE_SCENARIOS[domain.value]['description'],
                'scenario_count': len(RESILIENCE_SCENARIOS[domain.value]['scenarios'])
            }
            for domain in ResilienceDomain
            if domain.value in RESILIENCE_SCENARIOS
        ]
    
    @staticmethod
    def get_scenarios_for_domains(selected_domains: Set[ResilienceDomain]) -> Dict[str, List[str]]:
        """Get scenarios for selected domains"""
        return {
            domain.value: RESILIENCE_SCENARIOS[domain.value]['scenarios']
            for domain in selected_domains
            if domain.value in RESILIENCE_SCENARIOS
        }