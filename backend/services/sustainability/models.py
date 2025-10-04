import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Set, Union
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field, root_validator, validator


# Sustainability Domain Enum
class SustainabilityDomain(str, Enum):
    ENVIRONMENTAL = "environmental"
    ECONOMIC = "economic"
    SOCIAL = "social"


class DynamicAssessment(BaseModel):
    """Generic assessment model that accepts any criterion keys with numeric levels"""
    
    class Config:
        extra = "allow"  # Allow additional fields
    
    def dict(self, **kwargs) -> Dict[str, Any]:
        """Override dict to ensure proper serialization"""
        return super().dict(**kwargs)


class EnvironmentalAssessment(DynamicAssessment):
    """Environmental assessment - accepts criterion keys with numeric level values (0-5)"""
    pass


class EconomicAssessment(DynamicAssessment):
    """Economic assessment - accepts criterion keys with numeric level values (0-5)"""
    pass


class SocialAssessment(DynamicAssessment):
    """Social assessment - accepts criterion keys with numeric level values (0-5)"""
    pass

# Updated SustainabilityInput to support selective domain assessment
class SustainabilityInput(BaseModel):
    assessmentId: Optional[str] = Field(None, description="Unique identifier for the assessment")
    userId: Optional[str] = Field(None, description="User identifier")
    systemName: Optional[str] = Field(None, description="Name of the system being assessed")
    # Accept dynamic assessment instances
    assessments: Dict[str, DynamicAssessment] = Field(
        ..., description="Selected sustainability domain assessments"
    )
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when assessment was submitted")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class SustainabilityResult(BaseModel):
    assessmentId: str
    overallScore: float
    dimensionScores: Dict[str, float]
    sustainabilityMetrics: Dict[str, Any]
    timestamp: datetime
    processingTimeMs: float



class CriterionCreate(BaseModel):
    criterion_key: Optional[str] = Field(None, description="Unique key for the criterion (e.g., 'digital_twin_realism')")
    name: str = Field(..., description="Display name for the criterion")
    description: str = Field(..., description="Description of what this criterion measures")
    domain: str = Field(..., description="Domain this criterion belongs to")
    level_count: int = Field(default=6, description="Number of levels for this criterion")
    custom_levels: Optional[List[str]] = Field(None, description="Custom level descriptions")
    is_default: bool = Field(default=False, description="Whether this is a default criterion")

    @validator('domain')
    def validate_domain(cls, v):
        if v not in [domain.value for domain in SustainabilityDomain]:
            raise ValueError(f"Domain must be one of: {[d.value for d in SustainabilityDomain]}")
        return v

    @root_validator(pre=True)
    def ensure_criterion_key(cls, values):
        # if criterion_key already present, do nothing
        if values.get('criterion_key'):
            return values

        domain = values.get('domain')
        # domain must be present to generate a key
        if not domain:
            raise ValueError("domain is required to generate a criterion_key automatically")

        # generate the key using current in-memory scenarios
        generated_key = DomainSelectionHelper.generate_criterion_key(domain)
        values['criterion_key'] = generated_key
        return values



class CriterionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    custom_levels: Optional[List[str]] = None
    level_count: Optional[int] = None
    
    @validator('level_count')
    def validate_level_count(cls, v):
        if v is not None and (v < 2 or v > 10):
            raise ValueError("Level count must be between 2 and 10")
        return v


class CriterionResponse(BaseModel):
    id: str
    criterion_key: str
    name: str
    description: str
    domain: str
    level_count: int
    custom_levels: Optional[List[str]] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime


class SustainabilityScenarios(BaseModel):
    scenarios: Dict[str, Dict[str, Any]]


# Enhanced sustainability scenarios configuration - now will be dynamically updated
DEFAULT_SUSTAINABILITY_SCENARIOS = {
    'environmental': {
        'description': 'Environmental impact and resource management assessment',
        'criteria': {
            'ENV_01': {
                'name': 'Digital Twin Realism',
                'description': 'Level of digital model accuracy and real-world connection',
                'levels': [
                    "Static plan, no link with reality",
                    "Simple 3D shapes",
                    "Model with basic movements",
                    "Representative simulation: processes realistically simulated",
                    "High-fidelity model: detailed physical model, very close to reality",
                    "Real-time connection: complete digital replica, synchronized in real time"
                ]
            },
            'ENV_02': {
                'name': 'Flow Tracking',
                'description': 'Material and energy flow monitoring capabilities',
                'levels': [
                    "Nothing is tracked",
                    "A single flow measured (e.g., electricity)",
                    "Multiple flows measured separately (e.g., water + energy)",
                    "Global balances of main flows (total inputs/outputs)",
                    "Detailed traceability workstation by workstation, inside the plant",
                    "Complete tracking including supply chain (upstream/downstream)"
                ]
            },
            'ENV_03': {
                'name': 'Energy Visibility',
                'description': 'Level of energy consumption monitoring and visibility',
                'levels': [
                    "No data",
                    "Annual bills",
                    "Monthly readings",
                    "Continuous monitoring of major equipment",
                    "Real-time monitoring of most systems",
                    "Precise subsystem and equipment-level metering"
                ]
            },
            'ENV_04': {
                'name': 'Environmental Scope',
                'description': 'Breadth of environmental indicators tracked',
                'levels': [
                    "No indicators tracked",
                    "Energy only",
                    "Energy + carbon emissions",
                    "Add water (consumption, discharges)",
                    "Multi-indicators: energy, carbon, water, waste, materials",
                    "Full lifecycle analysis (production → use → end of life)"
                ]
            },
            'ENV_05': {
                'name': 'Simulation & Prediction',
                'description': 'Predictive and optimization capabilities',
                'levels': [
                    "Observation only",
                    "Simple reports and alerts",
                    "Basic change tests (e.g., rate, schedules)",
                    "Predictive scenarios with comparisons",
                    "Assisted optimization: system proposes several optimal solutions",
                    "Autonomous optimization: twin automatically adjusts parameters"
                ]
            }
        }
    },
    'economic': {
        'description': 'Economic viability and financial impact assessment',
        'criteria': {
            'ECO_01': {
                'name': 'Digitalization Budget',
                'description': 'Investment level in digital transformation',
                'levels': [
                    "No budget allocated for digitizing the system",
                    "Minimal budget - Basic modeling of the physical system",
                    "Correct budget - Faithful reproduction of main equipment",
                    "Large budget - Complete digital copy of the system",
                    "Very large budget - Ultra-precise twin with advanced sensors",
                    "Maximum budget - Perfect real-time connected replica"
                ]
            },
            'ECO_02': {
                'name': 'Savings Realized',
                'description': 'Actual cost savings achieved',
                'levels': [
                    "No savings",
                    "Small savings",
                    "Correct savings",
                    "Good savings",
                    "Very good savings",
                    "Exceptional savings"
                ]
            },
            'ECO_03': {
                'name': 'Performance Improvement',
                'description': 'Operational performance gains',
                'levels': [
                    "No improvement",
                    "Small improvement",
                    "Correct improvement",
                    "Good improvement",
                    "Very good improvement",
                    "Exceptional improvement"
                ]
            },
            'ECO_04': {
                'name': 'ROI Timeframe',
                'description': 'Return on investment timeline',
                'levels': [
                    "Not calculated or more than 5 years",
                    "Profitable between 3 and 5 years",
                    "Profitable between 2 and 3 years",
                    "Profitable between 18 and 24 months",
                    "Profitable between 12 and 18 months",
                    "Profitable in less than 12 months"
                ]
            }
        }
    },
    'social': {
        'description': 'Social impact and stakeholder benefits assessment',
        'criteria': {
            'SOC_01': {
                'name': 'Employee Impact',
                'description': 'Effects on workforce and employment',
                'levels': [
                    "Job cuts (over 10% of workforce affected)",
                    "Some job cuts (5–10% of workforce)",
                    "Stable workforce, some training",
                    "Same number of jobs + training for all concerned",
                    "New positions created (5–10% more jobs)",
                    "Strong creation of qualified jobs (over 10% increase)"
                ]
            },
            'SOC_02': {
                'name': 'Workplace Safety',
                'description': 'Impact on worker safety and risk reduction',
                'levels': [
                    "No change in risks",
                    "Slight reduction of incidents (<10%)",
                    "Moderate risk reduction (10–25%)",
                    "Good improvement in safety (25–50%)",
                    "Strong reduction in accidents (50–75%)",
                    "Near elimination of risks (>75% reduction)"
                ]
            },
            'SOC_03': {
                'name': 'Regional Benefits',
                'description': 'Local economic and social benefits',
                'levels': [
                    "No local impact: no local purchases/partnerships identified",
                    "Some additional local purchases",
                    "Partnership with 1–2 local companies",
                    "Institutional collaboration: active collaboration with local universities/schools",
                    "Notable local creation: new local jobs linked to the project",
                    "Major impact: new local jobs or significant financial benefits"
                ]
            }
        }
    }
}

SUSTAINABILITY_SCENARIOS = DEFAULT_SUSTAINABILITY_SCENARIOS.copy()

class DomainSelectionHelper:
    """Helper class for managing domain selection and configuration"""
    
    @staticmethod
    def get_available_domains() -> List[Dict[str, Any]]:
        """Get list of available domains with descriptions"""
        return [
            {
                'domain': domain.value,
                'enum': domain,
                'description': SUSTAINABILITY_SCENARIOS[domain.value]['description'],
                'criteria_count': len(SUSTAINABILITY_SCENARIOS[domain.value]['criteria'])
            }
            for domain in SustainabilityDomain
            if domain.value in SUSTAINABILITY_SCENARIOS
        ]
    
    @staticmethod
    def get_criteria_for_domains(selected_domains: Set[SustainabilityDomain]) -> Dict[str, Dict[str, Any]]:
        """Get criteria for selected domains"""
        return {
            domain.value: SUSTAINABILITY_SCENARIOS[domain.value]['criteria']
            for domain in selected_domains
            if domain.value in SUSTAINABILITY_SCENARIOS
        }
    
    @staticmethod
    def generate_criterion_key(domain: Union[str, SustainabilityDomain]) -> str:
        """Generate a new unique criterion key for the given domain, e.g. "ENV_06"."""
        domain_str = domain.value if isinstance(domain, SustainabilityDomain) else str(domain)
        existing_scenarios = SUSTAINABILITY_SCENARIOS
        prefix_map = {
            'environmental': 'ENV',
            'economic': 'ECO',
            'social': 'SOC'
        }

        if domain_str not in prefix_map:
            raise ValueError(f"Unknown domain for key generation: {domain_str}")

        prefix = prefix_map[domain_str]

        existing_keys = []
        try:
            existing_keys = list(existing_scenarios[domain_str]['criteria'].keys())
        except Exception:
            existing_keys = []

        max_num = 0
        for k in existing_keys:
            if k.startswith(prefix + '_'):
                suffix = k.split('_', 1)[1]
                try:
                    num = int(suffix)
                    if num > max_num:
                        max_num = num
                except ValueError:
                    continue

        next_num = max_num + 1
        return f"{prefix}_{next_num:02d}"

    @staticmethod
    def create_assessment_from_data(domain: str, data: Dict[str, Any]) -> DynamicAssessment:
        """Create appropriate assessment object from data"""
        if domain == 'environmental':
            return EnvironmentalAssessment(**data)
        elif domain == 'economic':
            return EconomicAssessment(**data)
        elif domain == 'social':
            return SocialAssessment(**data)
        else:
            # Fallback to generic dynamic assessment
            return DynamicAssessment(**data)
