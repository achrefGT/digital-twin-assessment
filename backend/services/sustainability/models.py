import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Set, Union
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field, root_validator, validator


# Environmental Assessment Levels
class DigitalTwinRealismLevel(str, Enum):
    STATIC_PLAN = "static_plan"  # Plan statique, aucun lien avec la réalité
    SIMPLE_3D = "simple_3d"  # Formes 3D simples
    BASIC_MOVEMENTS = "basic_movements"  # Modèle avec mouvements basiques
    REPRESENTATIVE_SIMULATION = "representative_simulation"  # Simulation représentative
    HIGH_FIDELITY = "high_fidelity"  # Modèle haute fidélité
    REAL_TIME_CONNECTION = "real_time_connection"  # Connexion temps réel


class FlowTrackingLevel(str, Enum):
    NOTHING_TRACKED = "nothing_tracked"  # Rien n'est suivi
    SINGLE_FLOW = "single_flow"  # Un seul flux mesuré
    MULTIPLE_FLOWS = "multiple_flows"  # Plusieurs flux mesurés séparément
    GLOBAL_BALANCE = "global_balance"  # Bilans globaux des principaux flux
    DETAILED_TRACEABILITY = "detailed_traceability"  # Traçabilité détaillée poste par poste
    COMPLETE_SUPPLY_CHAIN = "complete_supply_chain"  # Suivi complet incluant la chaîne d'approvisionnement


class EnergyVisibilityLevel(str, Enum):
    NO_DATA = "no_data"  # Aucune donnée
    ANNUAL_BILLS = "annual_bills"  # Factures annuelles
    MONTHLY_READINGS = "monthly_readings"  # Relevés mensuels
    CONTINUOUS_EQUIPMENT = "continuous_equipment"  # Suivi continu des gros équipements
    REAL_TIME_MAJORITY = "real_time_majority"  # Monitoring temps réel de la majorité des systèmes
    PRECISE_SUBSYSTEM_COUNTING = "precise_subsystem_counting"  # Comptage précis par sous-systèmes


class EnvironmentalScopeLevel(str, Enum):
    NO_INDICATORS = "no_indicators"  # Aucun indicateur suivi
    ENERGY_ONLY = "energy_only"  # Énergie uniquement
    ENERGY_CARBON = "energy_carbon"  # Énergie + émissions de carbone
    ADD_WATER = "add_water"  # Ajout de l'eau
    MULTI_INDICATORS = "multi_indicators"  # Multi-indicateurs
    COMPLETE_LIFECYCLE = "complete_lifecycle"  # Analyse du cycle de vie complet


class SimulationPredictionLevel(str, Enum):
    OBSERVATION_ONLY = "observation_only"  # Observation uniquement
    SIMPLE_REPORTS = "simple_reports"  # Rapports et alertes simples
    BASIC_CHANGE_TESTS = "basic_change_tests"  # Tests de changements de base
    PREDICTIVE_SCENARIOS = "predictive_scenarios"  # Scénarios prédictifs
    ASSISTED_OPTIMIZATION = "assisted_optimization"  # Optimisation assistée
    AUTONOMOUS_OPTIMIZATION = "autonomous_optimization"  # Optimisation autonome


# Economic Assessment Levels
class DigitalizationBudgetLevel(str, Enum):
    NO_BUDGET = "no_budget"  # Pas de budget prévu
    MINIMAL_BUDGET = "minimal_budget"  # Budget minimal
    CORRECT_BUDGET = "correct_budget"  # Budget correct
    LARGE_BUDGET = "large_budget"  # Gros budget
    VERY_LARGE_BUDGET = "very_large_budget"  # Très gros budget
    MAXIMUM_BUDGET = "maximum_budget"  # Budget maximum


class SavingsLevel(str, Enum):
    NO_SAVINGS = "no_savings"  # Aucune économie
    SMALL_SAVINGS = "small_savings"  # Petites économies
    CORRECT_SAVINGS = "correct_savings"  # Économies correctes
    GOOD_SAVINGS = "good_savings"  # Bonnes économies
    VERY_GOOD_SAVINGS = "very_good_savings"  # Très bonnes économies
    EXCEPTIONAL_SAVINGS = "exceptional_savings"  # Économies exceptionnelles


class PerformanceImprovementLevel(str, Enum):
    NO_IMPROVEMENT = "no_improvement"  # Aucune amélioration
    SMALL_IMPROVEMENT = "small_improvement"  # Petite amélioration
    CORRECT_IMPROVEMENT = "correct_improvement"  # Amélioration correcte
    GOOD_IMPROVEMENT = "good_improvement"  # Bonne amélioration
    VERY_GOOD_IMPROVEMENT = "very_good_improvement"  # Très bonne amélioration
    EXCEPTIONAL_IMPROVEMENT = "exceptional_improvement"  # Amélioration exceptionnelle


class ROITimeframeLevel(str, Enum):
    NOT_CALCULATED_OR_OVER_5_YEARS = "not_calculated_over_5y"  # Pas calculé ou plus de 5 ans
    PROFITABLE_3_TO_5_YEARS = "profitable_3_5y"  # Rentable entre 3 et 5 ans
    PROFITABLE_2_TO_3_YEARS = "profitable_2_3y"  # Rentable entre 2 et 3 ans
    PROFITABLE_18_TO_24_MONTHS = "profitable_18_24m"  # Rentable entre 18 et 24 mois
    PROFITABLE_12_TO_18_MONTHS = "profitable_12_18m"  # Rentable entre 12 et 18 mois
    PROFITABLE_UNDER_12_MONTHS = "profitable_under_12m"  # Rentable en moins de 12 mois


# Social Assessment Levels
class EmployeeImpactLevel(str, Enum):
    JOB_SUPPRESSION_OVER_10_PERCENT = "job_suppression_over_10"  # Suppression d'emplois (plus de 10%)
    SOME_SUPPRESSIONS_5_TO_10_PERCENT = "some_suppressions_5_10"  # Quelques suppressions (5-10%)
    STABLE_WORKFORCE_SOME_TRAINING = "stable_some_training"  # Effectifs stables, quelques formations
    SAME_JOBS_ALL_TRAINED = "same_jobs_all_trained"  # Même nombre d'emplois + formation de tous
    NEW_POSITIONS_5_TO_10_PERCENT = "new_positions_5_10"  # Création de nouveaux postes (5-10%)
    STRONG_QUALIFIED_JOB_CREATION = "strong_job_creation"  # Forte création d'emplois qualifiés (plus de 10%)


class WorkplaceSafetyLevel(str, Enum):
    NO_CHANGE = "no_change"  # Aucun changement des risques
    SLIGHT_REDUCTION_UNDER_10 = "slight_reduction_under_10"  # Légère réduction (<10%)
    MODERATE_REDUCTION_10_TO_25 = "moderate_reduction_10_25"  # Réduction modérée (10-25%)
    GOOD_IMPROVEMENT_25_TO_50 = "good_improvement_25_50"  # Bonne amélioration (25-50%)
    STRONG_REDUCTION_50_TO_75 = "strong_reduction_50_75"  # Forte réduction (50-75%)
    NEAR_ELIMINATION_OVER_75 = "near_elimination_over_75"  # Quasi-élimination (plus de 75%)


class RegionalBenefitsLevel(str, Enum):
    NO_LOCAL_IMPACT = "no_local_impact"  # Aucune retombée locale
    SOME_LOCAL_PURCHASES = "some_local_purchases"  # Quelques achats locaux supplémentaires
    PARTNERSHIP_1_2_COMPANIES = "partnership_1_2_companies"  # Partenariat avec 1-2 entreprises locales
    INSTITUTIONAL_COLLABORATION = "institutional_collaboration"  # Collaboration institutionnelle
    NOTABLE_LOCAL_CREATION = "notable_local_creation"  # Création locale notable
    MAJOR_IMPACT = "major_impact"  # Impact majeur


# Sustainability Domain Enum
class SustainabilityDomain(str, Enum):
    ENVIRONMENTAL = "environmental"
    ECONOMIC = "economic"
    SOCIAL = "social"


class DynamicAssessment(BaseModel):
    """Generic assessment model that accepts dynamic criterion keys"""
    
    class Config:
        extra = "allow"  # Allow additional fields
    
    def __init__(self, **data):
        # Convert any enum string values to their proper enum types if needed
        processed_data = {}
        for key, value in data.items():
            processed_data[key] = self._process_criterion_value(key, value)
        super().__init__(**processed_data)
    
    def _process_criterion_value(self, key: str, value: Any) -> Any:
        """Process criterion values, converting strings to enums if applicable"""
        return value
    
    def dict(self, **kwargs) -> Dict[str, Any]:
        """Override dict to ensure proper serialization"""
        result = super().dict(**kwargs)
        return result


# Assessment Models
class EnvironmentalAssessment(DynamicAssessment):
    digital_twin_realism: Optional[DigitalTwinRealismLevel] = None
    flow_tracking: Optional[Any] = None  
    energy_visibility: Optional[Any] = None
    environmental_scope: Optional[Any] = None
    simulation_prediction: Optional[Any] = None


class EconomicAssessment(DynamicAssessment):
    digitalization_budget: Optional[Any] = None
    savings_realized: Optional[Any] = None
    performance_improvement: Optional[Any] = None
    roi_timeframe: Optional[Any] = None


class SocialAssessment(DynamicAssessment):
    employee_impact: Optional[Any] = None
    workplace_safety: Optional[Any] = None
    regional_benefits: Optional[Any] = None


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
