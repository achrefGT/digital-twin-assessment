import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Set
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field, validator


class HumanCentricityDomain(str, Enum):
    CORE_USABILITY = "Core_Usability"
    TRUST_TRANSPARENCY = "Trust_Transparency"
    WORKLOAD_COMFORT = "Workload_Comfort"
    CYBERSICKNESS = "Cybersickness"
    EMOTIONAL_RESPONSE = "Emotional_Response"
    PERFORMANCE = "Performance"


class StatementType(str, Enum):
    SCALE = "scale"         # ordinal/likert/sam-like
    NUMERIC = "numeric"     # continuous or slider (e.g. 0-100)
    PERFORMANCE = "performance"  # objective metrics (time/errors)
    TEXT = "text"           # free text
    COMPOSITE = "composite" # contains multiple sub-fields
    CUSTOM = "custom"       # extension / plugin type


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


# Statement Management Models (Simplified for fixed domains)

class StatementCreate(BaseModel):
    domain_key: HumanCentricityDomain = Field(..., description="Domain this statement belongs to")
    statement_text: str = Field(..., min_length=1, max_length=500, description="Statement text")
    widget: Optional[str] = Field(None, description="UI widget, e.g. 'likert', 'slider', 'radio', 'text'")
    widget_config: Optional[Dict[str, Any]] = Field(None, description="Widget config (e.g. {'min':0,'max':100,'step':1})")
    display_order: Optional[int] = Field(default=0, description="Display order within domain")
    is_required: Optional[bool] = Field(default=True, description="Whether this statement is required")
    is_active: Optional[bool] = Field(default=True, description="Whether this statement is currently active")
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    @validator('widget', pre=True, always=True)
    def set_default_widget(cls, v, values):
        """Set default widget based on domain if not provided."""
        if v is not None:
            return v
            
        domain = values.get('domain_key')
        if not domain:
            return 'likert'
            
        # Set default widget based on domain
        domain_widgets = {
            HumanCentricityDomain.CORE_USABILITY: 'likert',
            HumanCentricityDomain.TRUST_TRANSPARENCY: 'likert',
            HumanCentricityDomain.WORKLOAD_COMFORT: 'slider',
            HumanCentricityDomain.CYBERSICKNESS: 'likert',
            HumanCentricityDomain.EMOTIONAL_RESPONSE: 'sam',
            HumanCentricityDomain.PERFORMANCE: 'numeric'
        }
        return domain_widgets.get(domain, 'likert')


class StatementUpdate(BaseModel):
    statement_text: Optional[str] = Field(None, min_length=1, max_length=500)
    widget: Optional[str] = None
    widget_config: Optional[Dict[str, Any]] = None
    display_order: Optional[int] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    meta_data: Optional[Dict[str, Any]] = None


class StatementResponse(BaseModel):
    id: str
    domain_key: HumanCentricityDomain
    statement_text: str
    statement_type: StatementType 
    widget: Optional[str]
    widget_config: Optional[Dict[str, Any]] = None
    display_order: Optional[int]
    is_required: Optional[bool]
    is_active: Optional[bool]
    is_default: bool  
    meta_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class HumanCentricityInput(BaseModel):
    assessmentId: Optional[str] = Field(None, description="Unique identifier for the assessment")
    userId: Optional[str] = Field(None, description="User identifier")
    systemName: Optional[str] = Field(None, description="Name of the system being assessed")
    
    # Selected domains for assessment
    selected_domains: Set[HumanCentricityDomain] = Field(default_factory=set, description="Selected domains for assessment")
    
    # Assessment responses (all optional now based on selection)
    core_usability_responses: Optional[List[LikertResponse]] = Field(None, description="Core Usability Likert responses")
    trust_transparency_responses: Optional[List[LikertResponse]] = Field(None, description="Trust & Transparency Likert responses")
    workload_metrics: Optional[WorkloadMetrics] = Field(None, description="Mental workload metrics")
    cybersickness_responses: Optional[List[CybersicknessResponse]] = Field(None, description="Cybersickness symptom responses")
    emotional_response: Optional[EmotionalResponse] = Field(None, description="SAM emotional response")
    performance_metrics: Optional[PerformanceMetrics] = Field(None, description="Objective performance metrics")
    
    # Dynamic responses for custom statements within domains
    custom_responses: Optional[Dict[str, List[Dict[str, Any]]]] = Field(None, description="Custom statement responses by domain")
    
    # Legacy field for backward compatibility
    ux_trust_responses: Optional[List[LikertResponse]] = Field(None, description="Legacy combined UX and Trust responses")
    
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when assessment was submitted")
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class HumanCentricityResult(BaseModel):
    assessmentId: str
    overallScore: float
    domainScores: Dict[str, float]
    selectedDomains: List[str]  # Track which domains were assessed
    detailedMetrics: Dict[str, Any]
    timestamp: datetime
    processingTimeMs: float


class HumanCentricityStructure(BaseModel):
    domains: Dict[str, Dict[str, Any]]
    scales: Dict[str, Dict[str, Any]]


# Domain scale configuration - each domain has ONE fixed scale
DOMAIN_SCALES = {
    HumanCentricityDomain.CORE_USABILITY: {
        'type': 'likert',
        'min': 1,
        'max': 7,
        'labels': {
            1: 'Strongly Disagree',
            2: 'Disagree', 
            3: 'Somewhat Disagree',
            4: 'Neutral',
            5: 'Somewhat Agree',
            6: 'Agree',
            7: 'Strongly Agree'
        }
    },
    HumanCentricityDomain.TRUST_TRANSPARENCY: {
        'type': 'likert',
        'min': 1,
        'max': 7,
        'labels': {
            1: 'Strongly Disagree',
            2: 'Disagree', 
            3: 'Somewhat Disagree',
            4: 'Neutral',
            5: 'Somewhat Agree',
            6: 'Agree',
            7: 'Strongly Agree'
        }
    },
    HumanCentricityDomain.WORKLOAD_COMFORT: {
        'type': 'slider',
        'min': 0,
        'max': 100,
        'step': 1,
        'labels': {
            0: 'Very Low',
            25: 'Low',
            50: 'Moderate', 
            75: 'High',
            100: 'Very High'
        }
    },
    HumanCentricityDomain.CYBERSICKNESS: {
        'type': 'likert',
        'min': 1,
        'max': 5,
        'labels': {
            1: 'None',
            2: 'Slight',
            3: 'Moderate',
            4: 'Severe',
            5: 'Very Severe'
        }
    },
    HumanCentricityDomain.EMOTIONAL_RESPONSE: {
        'type': 'sam',
        'min': 1,
        'max': 5,
        'dimensions': {
            'valence': {
                'labels': {
                    1: 'Very Unhappy',
                    2: 'Unhappy',
                    3: 'Neutral',
                    4: 'Happy', 
                    5: 'Very Happy'
                }
            },
            'arousal': {
                'labels': {
                    1: 'Very Calm',
                    2: 'Calm',
                    3: 'Neutral',
                    4: 'Excited',
                    5: 'Very Excited'
                }
            }
        }
    },
    HumanCentricityDomain.PERFORMANCE: {
        'type': 'numeric',
        'metrics': {
            'time': {'unit': 'minutes', 'min': 0, 'description': 'Task completion time'},
            'errors': {'unit': 'count', 'min': 0, 'description': 'Number of errors'},
            'help': {'unit': 'count', 'min': 0, 'description': 'Help requests'}
        }
    }
}


# Fixed domain configurations - These cannot be modified, only statements within them
FIXED_DOMAINS = {
    HumanCentricityDomain.CORE_USABILITY: {
        'title': 'Core Usability & User Experience',
        'description': 'Evaluate the fundamental usability and user experience aspects of the system',
        'statement_type': StatementType.SCALE,
        'default_widget': 'likert',
        'display_order': 1,
        'is_composite': False,
        'icon': 'user-check',
        'color': '#3B82F6'
    },
    HumanCentricityDomain.TRUST_TRANSPARENCY: {
        'title': 'Trust & Transparency',
        'description': 'Assess trust levels and system transparency in decision-making',
        'statement_type': StatementType.SCALE,
        'default_widget': 'likert',
        'display_order': 2,
        'is_composite': False,
        'icon': 'shield-check',
        'color': '#10B981'
    },
    HumanCentricityDomain.WORKLOAD_COMFORT: {
        'title': 'Workload & Comfort Assessment',
        'description': 'Evaluate mental workload and physical comfort while using the system',
        'statement_type': StatementType.COMPOSITE,
        'default_widget': 'slider',
        'display_order': 3,
        'is_composite': True,
        'icon': 'brain',
        'color': '#F59E0B'
    },
    HumanCentricityDomain.CYBERSICKNESS: {
        'title': 'Cybersickness / Comfort',
        'description': 'Evaluate physical discomfort or cybersickness symptoms while using the system',
        'statement_type': StatementType.SCALE,
        'default_widget': 'likert',
        'display_order': 4,
        'is_composite': False,
        'icon': 'heart-pulse',
        'color': '#EF4444'
    },
    HumanCentricityDomain.EMOTIONAL_RESPONSE: {
        'title': 'Emotional Response (SAM)',
        'description': 'Capture your emotional state while using the system',
        'statement_type': StatementType.SCALE,
        'default_widget': 'sam',
        'display_order': 5,
        'is_composite': True,
        'icon': 'smile',
        'color': '#8B5CF6'
    },
    HumanCentricityDomain.PERFORMANCE: {
        'title': 'Objective Performance Metrics',
        'description': 'Record measured performance indicators',
        'statement_type': StatementType.PERFORMANCE,
        'default_widget': 'numeric',
        'display_order': 6,
        'is_composite': True,
        'icon': 'bar-chart',
        'color': '#06B6D4'
    }
}

# Default statements for each domain - these will be created as "default" statements
DEFAULT_STATEMENTS = {
    HumanCentricityDomain.CORE_USABILITY: [
        {
            'text': "I found the digital twin intuitive and easy to use.",
            'display_order': 1,
            'is_default': True
        },
        {
            'text': "The system's functions feel well integrated and coherent.",
            'display_order': 2,
            'is_default': True
        },
        {
            'text': "I would use this digital twin frequently in my work.",
            'display_order': 3,
            'is_default': True
        },
        {
            'text': "Learning to operate the system was quick and straightforward.",
            'display_order': 4,
            'is_default': True
        },
        {
            'text': "I feel confident and in control when using the twin.",
            'display_order': 5,
            'is_default': True
        },
        {
            'text': "The terminology and workflows match my domain expertise.",
            'display_order': 6,
            'is_default': True
        },
        {
            'text': "I can easily tailor views, dashboards, and alerts to my needs.",
            'display_order': 7,
            'is_default': True
        },
        {
            'text': "I feel comfortable with how the system collects, uses, and displays my data.",
            'display_order': 8,
            'is_default': True
        }
    ],
    HumanCentricityDomain.TRUST_TRANSPARENCY: [
        {
            'text': "I understand the origins and currency of the data shown.",
            'display_order': 1,
            'is_default': True
        },
        {
            'text': "The system explains how it generated its insights or recommendations.",
            'display_order': 2,
            'is_default': True
        },
        {
            'text': "I trust the accuracy and reliability of the digital twin's outputs.",
            'display_order': 3,
            'is_default': True
        },
        {
            'text': "I feel confident making operational decisions based on the twin's insights.",
            'display_order': 4,
            'is_default': True
        }
    ],
    HumanCentricityDomain.WORKLOAD_COMFORT: [
        {
            'text': "Mental Demand",
            'display_order': 1,
            'is_default': True,
            'widget': 'slider'
        },
        {
            'text': "Effort Required",
            'display_order': 2,
            'is_default': True,
            'widget': 'slider'
        },
        {
            'text': "Frustration Level",
            'display_order': 3,
            'is_default': True,
            'widget': 'slider'
        }
    ],
    HumanCentricityDomain.CYBERSICKNESS: [
        {
            'text': "Queasiness or nausea",
            'display_order': 1,
            'is_default': True
        },
        {
            'text': "Dizziness or off-balance feeling",
            'display_order': 2,
            'is_default': True
        },
        {
            'text': "Eye strain or visual discomfort",
            'display_order': 3,
            'is_default': True
        }
    ],
    HumanCentricityDomain.EMOTIONAL_RESPONSE: [
        {
            'text': "Valence (1 = Negative, 5 = Positive)",
            'display_order': 1,
            'is_default': True,
            'widget': 'sam'
        },
        {
            'text': "Arousal (1 = Calm, 5 = Excited)",
            'display_order': 2,
            'is_default': True,
            'widget': 'sam'
        }
    ],
    HumanCentricityDomain.PERFORMANCE: [
        {
            'text': "Task Completion Time (minutes)",
            'display_order': 1,
            'is_default': True,
            'widget': 'numeric',
            'widget_config': {'min': 0, 'step': 0.1, 'unit': 'minutes'}
        },
        {
            'text': "Error Rate (errors per task)",
            'display_order': 2,
            'is_default': True,
            'widget': 'numeric',
            'widget_config': {'min': 0, 'step': 1, 'unit': 'errors'}
        },
        {
            'text': "Help Requests (occurrences)",
            'display_order': 3,
            'is_default': True,
            'widget': 'numeric',
            'widget_config': {'min': 0, 'step': 1, 'unit': 'requests'}
        }
    ]
}

# Performance constants for scoring
PERFORMANCE_CONSTANTS = {
    'MAX_TIME': 30,  # Maximum task time in minutes
    'MAX_ERRORS': 10,  # Maximum error count
    'MAX_HELP': 5   # Maximum help requests
}


class StatementManager:
    """Helper class for statement management within fixed domains"""
    
    @staticmethod
    def get_domain_info(domain: HumanCentricityDomain) -> Dict[str, Any]:
        """Get information about a fixed domain"""
        return FIXED_DOMAINS.get(domain, {})
    
    @staticmethod
    def get_domain_scale(domain: HumanCentricityDomain) -> Dict[str, Any]:
        """Get the fixed scale configuration for a domain"""
        return DOMAIN_SCALES.get(domain, {})
    
    @staticmethod
    def get_all_domains() -> Dict[HumanCentricityDomain, Dict[str, Any]]:
        """Get all fixed domains"""
        return FIXED_DOMAINS
    
    @staticmethod
    def get_default_statements_for_domain(domain: HumanCentricityDomain) -> List[Dict[str, Any]]:
        """Get default statements for a domain"""
        return DEFAULT_STATEMENTS.get(domain, [])
    
    @staticmethod
    def validate_statement_for_domain(domain: HumanCentricityDomain, statement_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a statement against domain constraints"""
        domain_info = FIXED_DOMAINS.get(domain)
        if not domain_info:
            return {'valid': False, 'errors': ['Invalid domain']}
        
        validation_result = {'valid': True, 'errors': [], 'warnings': []}
        
        # Check widget compatibility
        widget = statement_data.get('widget')
        if widget and widget not in StatementManager._get_compatible_widgets(domain):
            validation_result['warnings'].append(
                f"Widget '{widget}' may not be optimal for {domain.value} domain"
            )
        
        return validation_result
    
    @staticmethod
    def _get_compatible_widgets(domain: HumanCentricityDomain) -> List[str]:
        """Get compatible widgets for a domain"""
        widget_compatibility = {
            HumanCentricityDomain.CORE_USABILITY: ['likert', 'radio', 'text'],
            HumanCentricityDomain.TRUST_TRANSPARENCY: ['likert', 'radio', 'text'],
            HumanCentricityDomain.WORKLOAD_COMFORT: ['slider', 'likert', 'numeric'],
            HumanCentricityDomain.CYBERSICKNESS: ['likert', 'radio'],
            HumanCentricityDomain.EMOTIONAL_RESPONSE: ['sam', 'likert'],
            HumanCentricityDomain.PERFORMANCE: ['numeric', 'slider']
        }
        return widget_compatibility.get(domain, ['likert'])
    
    @staticmethod
    def get_statement_template(domain: HumanCentricityDomain) -> Dict[str, Any]:
        """Get a template for creating new statements in a domain"""
        domain_info = FIXED_DOMAINS.get(domain, {})
        return {
            'domain_key': domain,
            'statement_text': '',
            'widget': domain_info.get('default_widget', 'likert'),
            'widget_config': None,
            'display_order': 0,
            'is_required': True,
            'is_active': True,
            'meta_data': {}
        }


class DomainSelectionHelper:
    """Helper class for domain selection and validation (simplified for fixed domains)"""
    
    @staticmethod
    def get_required_fields_for_domain(domain: HumanCentricityDomain) -> List[str]:
        """Get required form fields for a specific domain"""
        field_mapping = {
            HumanCentricityDomain.CORE_USABILITY: ['core_usability_responses'],
            HumanCentricityDomain.TRUST_TRANSPARENCY: ['trust_transparency_responses'],
            HumanCentricityDomain.WORKLOAD_COMFORT: ['workload_metrics'],
            HumanCentricityDomain.CYBERSICKNESS: ['cybersickness_responses'],
            HumanCentricityDomain.EMOTIONAL_RESPONSE: ['emotional_response'],
            HumanCentricityDomain.PERFORMANCE: ['performance_metrics']
        }
        return field_mapping.get(domain, [])
    
    @staticmethod
    def validate_domain_data(selected_domains: Set[HumanCentricityDomain], 
                           form_data: Dict[str, Any]) -> List[str]:
        """Validate that form data contains required fields for selected domains"""
        missing_fields = []
        
        for domain in selected_domains:
            required_fields = DomainSelectionHelper.get_required_fields_for_domain(domain)
            for field in required_fields:
                if field not in form_data or form_data[field] is None:
                    missing_fields.append(f"{domain.value}: {field}")
        
        return missing_fields
    
    @staticmethod
    def get_default_domain_selection() -> Set[HumanCentricityDomain]:
        """Get default domain selection"""
        return {
            HumanCentricityDomain.CORE_USABILITY,
            HumanCentricityDomain.TRUST_TRANSPARENCY,
            HumanCentricityDomain.WORKLOAD_COMFORT,
            HumanCentricityDomain.CYBERSICKNESS,
            HumanCentricityDomain.EMOTIONAL_RESPONSE,
            HumanCentricityDomain.PERFORMANCE
        }
    
    @staticmethod
    def get_minimal_domain_selection() -> Set[HumanCentricityDomain]:
        """Get minimal domain selection for quick assessments"""
        return {
            HumanCentricityDomain.CORE_USABILITY,
            HumanCentricityDomain.TRUST_TRANSPARENCY
        }


# Assessment structure metadata
ASSESSMENT_STRUCTURE = {
    'version': '2.2.0',
    'description': 'Human Centricity Assessment Framework - Fixed Domain Scales',
    'features': [
        'fixed_domains',
        'fixed_domain_scales',
        'statement_management',
        'custom_statements',
        'statement_ordering',
        'backward_compatibility'
    ],
    'scoring_method': 'weighted_domain_average',
    'validation_rules': {
        'min_domains': 1,
        'max_domains': 6,  # Fixed to the 6 predefined domains
        'min_statements_per_domain': 1,
        'max_statements_per_domain': 20,
        'max_total_statements': 100
    }
}