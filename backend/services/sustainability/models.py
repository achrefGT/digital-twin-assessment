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

DEFAULT_SUSTAINABILITY_SCENARIOS_FR = {
    'environmental': {
        'description': "Évaluation de l'impact environnemental et de la gestion des ressources",
        'criteria': {
            'ENV_01': {
                'name': 'Réalité du jumeau numérique',
                'description': "Degré de précision du modèle numérique et de sa connexion au monde réel",
                'levels': [
                    "Plan statique, sans lien avec la réalité",
                    "Formes 3D simples",
                    "Modèle avec mouvements basiques",
                    "Simulation représentative : processus simulés de façon réaliste",
                    "Modèle haute fidélité : modèle physique détaillé, très proche de la réalité",
                    "Connexion en temps réel : réplique numérique complète, synchronisée en temps réel"
                ]
            },
            'ENV_02': {
                'name': 'Suivi des flux',
                'description': "Capacités de surveillance des flux de matières et d'énergie",
                'levels': [
                    "Rien n'est suivi",
                    "Un seul flux mesuré (ex. : électricité)",
                    "Plusieurs flux mesurés séparément (ex. : eau + énergie)",
                    "Bilans globaux des flux principaux (entrées/sorties totales)",
                    "Traçabilité détaillée poste par poste, à l'intérieur de l'usine",
                    "Suivi complet incluant la chaîne d'approvisionnement (amont/aval)"
                ]
            },
            'ENV_03': {
                'name': "Visibilité énergétique",
                'description': "Niveau de surveillance et de visibilité de la consommation d'énergie",
                'levels': [
                    "Pas de données",
                    "Factures annuelles",
                    "Relevés mensuels",
                    "Surveillance continue des équipements majeurs",
                    "Surveillance en temps réel de la plupart des systèmes",
                    "Mesurage précis au niveau des sous-systèmes et équipements"
                ]
            },
            'ENV_04': {
                'name': "Périmètre environnemental",
                'description': "Étendue des indicateurs environnementaux suivis",
                'levels': [
                    "Aucun indicateur suivi",
                    "Énergie uniquement",
                    "Énergie + émissions de carbone",
                    "Ajout de l'eau (consommation, rejets)",
                    "Multi-indicateurs : énergie, carbone, eau, déchets, matériaux",
                    "Analyse complète du cycle de vie (production → usage → fin de vie)"
                ]
            },
            'ENV_05': {
                'name': "Simulation et prédiction",
                'description': "Capacités prédictives et d'optimisation",
                'levels': [
                    "Observation uniquement",
                    "Rapports simples et alertes",
                    "Tests de changement basiques (ex. : cadence, plannings)",
                    "Scénarios prédictifs avec comparaisons",
                    "Optimisation assistée : le système propose plusieurs solutions optimales",
                    "Optimisation autonome : le jumeau ajuste automatiquement les paramètres"
                ]
            }
        }
    },
    'economic': {
        'description': "Évaluation de la viabilité économique et de l'impact financier",
        'criteria': {
            'ECO_01': {
                'name': "Budget de numérisation",
                'description': "Niveau d'investissement dans la transformation numérique",
                'levels': [
                    "Aucun budget alloué à la numérisation du système",
                    "Budget minimal - Modélisation basique du système physique",
                    "Budget correct - Reproduction fidèle des équipements principaux",
                    "Gros budget - Copie numérique complète du système",
                    "Très gros budget - Jumeau ultra-précis avec capteurs avancés",
                    "Budget maximal - Réplique parfaite connectée en temps réel"
                ]
            },
            'ECO_02': {
                'name': "Économies réalisées",
                'description': "Économies de coûts réelles obtenues",
                'levels': [
                    "Aucune économie",
                    "Petites économies",
                    "Économies correctes",
                    "Bonnes économies",
                    "Très bonnes économies",
                    "Économies exceptionnelles"
                ]
            },
            'ECO_03': {
                'name': "Amélioration des performances",
                'description': "Gains de performance opérationnelle",
                'levels': [
                    "Aucune amélioration",
                    "Légère amélioration",
                    "Amélioration correcte",
                    "Bonne amélioration",
                    "Très bonne amélioration",
                    "Amélioration exceptionnelle"
                ]
            },
            'ECO_04': {
                'name': "Délai de retour sur investissement",
                'description': "Horizon temporel du retour sur investissement",
                'levels': [
                    "Non calculé ou plus de 5 ans",
                    "Rentable entre 3 et 5 ans",
                    "Rentable entre 2 et 3 ans",
                    "Rentable entre 18 et 24 mois",
                    "Rentable entre 12 et 18 mois",
                    "Rentable en moins de 12 mois"
                ]
            }
        }
    },
    'social': {
        'description': "Évaluation de l'impact social et des bénéfices pour les parties prenantes",
        'criteria': {
            'SOC_01': {
                'name': "Impact sur les employés",
                'description': "Effets sur la main-d'œuvre et l'emploi",
                'levels': [
                    "Suppressions d'emplois (plus de 10% de la main-d'œuvre concernée)",
                    "Quelques suppressions d'emplois (5–10% de la main-d'œuvre)",
                    "Main-d'œuvre stable, quelques formations",
                    "Même nombre d'emplois + formations pour tous les concernés",
                    "Création de nouveaux postes (5–10% d'emplois en plus)",
                    "Forte création d'emplois qualifiés (augmentation de plus de 10%)"
                ]
            },
            'SOC_02': {
                'name': "Sécurité au travail",
                'description': "Impact sur la sécurité des travailleurs et réduction des risques",
                'levels': [
                    "Aucun changement des risques",
                    "Légère réduction des incidents (<10%)",
                    "Réduction modérée des risques (10–25%)",
                    "Bonne amélioration de la sécurité (25–50%)",
                    "Forte réduction des accidents (50–75%)",
                    "Quasi-élimination des risques (>75% de réduction)"
                ]
            },
            'SOC_03': {
                'name': "Bénéfices régionaux",
                'description': "Bénéfices économiques et sociaux locaux",
                'levels': [
                    "Aucun impact local : aucun achat/partenariat local identifié",
                    "Quelques achats locaux supplémentaires",
                    "Partenariat avec 1–2 entreprises locales",
                    "Collaboration institutionnelle : collaboration active avec des universités/écoles locales",
                    "Création locale notable : nouveaux emplois locaux liés au projet",
                    "Impact majeur : nouveaux emplois locaux ou bénéfices financiers significatifs"
                ]
            }
        }
    }
}


SUSTAINABILITY_SCENARIOS = DEFAULT_SUSTAINABILITY_SCENARIOS_FR.copy()

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
