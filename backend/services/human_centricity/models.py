import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Set
from uuid import uuid4
from enum import Enum

from pydantic import BaseModel, ValidationError, Field


class HumanCentricityDomain(str, Enum):
    CORE_USABILITY = "Core_Usability"
    TRUST_TRANSPARENCY = "Trust_Transparency"
    WORKLOAD_COMFORT = "Workload_Comfort"
    EMOTIONAL_RESPONSE = "Emotional_Response"
    PERFORMANCE = "Performance"


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
    
    # Selected domains for assessment
    selected_domains: Set[HumanCentricityDomain] = Field(default_factory=set, description="Selected domains for assessment")
    
    # Assessment responses (all optional now based on selection)
    core_usability_responses: Optional[List[LikertResponse]] = Field(None, description="Core Usability Likert responses")
    trust_transparency_responses: Optional[List[LikertResponse]] = Field(None, description="Trust & Transparency Likert responses")
    workload_metrics: Optional[WorkloadMetrics] = Field(None, description="Mental workload metrics")
    cybersickness_responses: Optional[List[CybersicknessResponse]] = Field(None, description="Cybersickness symptom responses")
    emotional_response: Optional[EmotionalResponse] = Field(None, description="SAM emotional response")
    performance_metrics: Optional[PerformanceMetrics] = Field(None, description="Objective performance metrics")
    
    # Legacy field for backward compatibility
    ux_trust_responses: Optional[List[LikertResponse]] = Field(None, description="Legacy combined UX and Trust responses")
    
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when assessment was submitted")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


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


# Enhanced assessment statements configuration with domain separation
ASSESSMENT_DOMAINS = {
    'Core_Usability': {
        'title': 'Core Usability & User Experience',
        'description': 'Evaluate the fundamental usability and user experience aspects of the system',
        'type': 'likert',
        'scale': 'likert_7_point',
        'statements': [
            "I found the digital twin intuitive and easy to use.",
            "The system's functions feel well integrated and coherent.",
            "I would use this digital twin frequently in my work.",
            "Learning to operate the system was quick and straightforward.",
            "I feel confident and in control when using the twin.",
            "The terminology and workflows match my domain expertise.",
            "I can easily tailor views, dashboards, and alerts to my needs.",
            "I feel comfortable with how the system collects, uses, and displays my data."
        ]
    },
    'Trust_Transparency': {
        'title': 'Trust & Transparency',
        'description': 'Assess trust levels and system transparency in decision-making',
        'type': 'likert',
        'scale': 'likert_7_point',
        'statements': [
            "I understand the origins and currency of the data shown.",
            "The system explains how it generated its insights or recommendations.",
            "I trust the accuracy and reliability of the digital twin's outputs.",
            "I feel confident making operational decisions based on the twin's insights."
        ]
    },
    'Workload_Comfort': {
        'title': 'Workload & Comfort Assessment',
        'description': 'Evaluate mental workload and physical comfort while using the system',
        'type': 'combined',
        'components': {
            'workload': {
                'title': 'Mental Demand & Effort',
                'description': 'Rate each on a 0-100 scale (0 = very low, 100 = very high)',
                'type': 'slider',
                'scale': 'workload_slider',
                'metrics': [
                    "Mental Demand",
                    "Effort Required", 
                    "Frustration Level"
                ]
            },
            'cybersickness': {
                'title': 'Cybersickness Symptoms',
                'description': 'Rate each symptom (1 = None, 5 = Severe)',
                'type': 'cybersickness',
                'scale': 'cybersickness_severity',
                'symptoms': [
                    "Queasiness or nausea",
                    "Dizziness or off-balance feeling",
                    "Eye strain or visual discomfort"
                ]
            }
        }
    },
    'Emotional_Response': {
        'title': 'Emotional Response (SAM)',
        'description': 'Capture your emotional state while using the system',
        'type': 'sam',
        'components': {
            'valence': {
                'description': 'Valence (1 = Negative, 5 = Positive)',
                'scale': [1, 2, 3, 4, 5]
            },
            'arousal': {
                'description': 'Arousal (1 = Calm, 5 = Excited)', 
                'scale': [1, 2, 3, 4, 5]
            }
        }
    },
    'Performance': {
        'title': 'Objective Performance Metrics',
        'description': 'Record measured performance indicators',
        'type': 'performance',
        'scale': 'performance_metrics',
        'metrics': [
            "Task Completion Time (minutes)",
            "Error Rate (errors per task)",
            "Help Requests (occurrences)"
        ]
    }
}

# Legacy statements for backward compatibility
ASSESSMENT_STATEMENTS = {
    'Section1_Core_Usability_UX': ASSESSMENT_DOMAINS['Core_Usability']['statements'],
    'Section2_Trust_Transparency': ASSESSMENT_DOMAINS['Trust_Transparency']['statements'],
    'Section3_Workload_Metrics': {
        'description': 'Rate each on a 0-100 scale (0 = very low, 100 = very high)',
        'metrics': ASSESSMENT_DOMAINS['Workload_Comfort']['components']['workload']['metrics']
    },
    'Section3_Cybersickness_Symptoms': {
        'description': 'Rate each symptom (1 = None, 5 = Severe)',
        'symptoms': ASSESSMENT_DOMAINS['Workload_Comfort']['components']['cybersickness']['symptoms']
    },
    'Section4_Emotional_Response_SAM': ASSESSMENT_DOMAINS['Emotional_Response']['components'],
    'Section5_Objective_Performance': {
        'description': 'Enter actual measured values',
        'metrics': ASSESSMENT_DOMAINS['Performance']['metrics']
    }
}

# Scale definitions
ASSESSMENT_SCALES = {
    'likert_7_point': {
        'range': [1, 7],
        'labels': {
            1: "Strongly Disagree",
            2: "Disagree",
            3: "Somewhat Disagree", 
            4: "Neutral",
            5: "Somewhat Agree",
            6: "Agree",
            7: "Strongly Agree"
        },
        'description': 'Rate each statement on a 1–7 scale'
    },
    'workload_slider': {
        'range': [0, 100],
        'description': '0 = very low … 100 = very high'
    },
    'cybersickness_severity': {
        'range': [1, 5],
        'labels': {
            1: "None",
            2: "Slight",
            3: "Moderate",
            4: "Severe", 
            5: "Very Severe"
        },
        'description': '1 = None … 5 = Severe'
    },
    'sam_valence': {
        'range': [1, 5],
        'labels': {
            1: "Very Negative",
            2: "Negative",
            3: "Neutral",
            4: "Positive",
            5: "Very Positive"
        },
        'description': 'Select your current emotional state'
    },
    'sam_arousal': {
        'range': [1, 5], 
        'labels': {
            1: "Very Calm",
            2: "Calm",
            3: "Neutral",
            4: "Excited",
            5: "Very Excited"
        },
        'description': 'Select your current emotional state'
    },
    'performance_metrics': {
        'task_completion_time': {
            'unit': 'minutes',
            'min_value': 0.0,
            'step': 0.1
        },
        'error_rate': {
            'unit': 'errors per task',
            'min_value': 0,
            'step': 1
        },
        'help_requests': {
            'unit': 'occurrences', 
            'min_value': 0,
            'step': 1
        }
    }
}


# Assessment section structure for easy frontend generation
ASSESSMENT_STRUCTURE = {
    'sections': [
        {
            'id': 'section1',
            'title': 'Core Usability & User Experience',
            'description': 'Rate each statement on a 1–7 scale (1 = Strongly Disagree, 7 = Strongly Agree)',
            'type': 'likert',
            'scale': 'likert_7_point',
            'statements': ASSESSMENT_STATEMENTS['Section1_Core_Usability_UX']
        },
        {
            'id': 'section2', 
            'title': 'Trust & Transparency',
            'description': 'Rate each statement on a 1–7 scale (1 = Strongly Disagree, 7 = Strongly Agree)',
            'type': 'likert',
            'scale': 'likert_7_point', 
            'statements': ASSESSMENT_STATEMENTS['Section2_Trust_Transparency']
        },
        {
            'id': 'section3a',
            'title': 'Workload & Comfort - Mental Demand & Effort',
            'description': 'Use sliders to rate each aspect',
            'type': 'slider',
            'scale': 'workload_slider',
            'metrics': ASSESSMENT_STATEMENTS['Section3_Workload_Metrics']['metrics']
        },
        {
            'id': 'section3b',
            'title': 'Workload & Comfort - Cybersickness Symptoms', 
            'description': 'Rate the severity of each symptom',
            'type': 'cybersickness',
            'scale': 'cybersickness_severity',
            'symptoms': ASSESSMENT_STATEMENTS['Section3_Cybersickness_Symptoms']['symptoms']
        },
        {
            'id': 'section4',
            'title': 'Emotional Response (SAM)',
            'description': 'Select your current emotional state',
            'type': 'sam',
            'components': {
                'valence': ASSESSMENT_STATEMENTS['Section4_Emotional_Response_SAM']['valence'],
                'arousal': ASSESSMENT_STATEMENTS['Section4_Emotional_Response_SAM']['arousal']
            }
        },
        {
            'id': 'section5',
            'title': 'Objective Performance Metrics',
            'description': 'Enter the measured performance values',
            'type': 'performance',
            'scale': 'performance_metrics',
            'metrics': ASSESSMENT_STATEMENTS['Section5_Objective_Performance']['metrics']
        }
    ]
}

# Constants for normalizing objective performance
PERFORMANCE_CONSTANTS = {
    'MAX_TIME': 30.0,      # minutes (expected maximum)  
    'MAX_ERRORS': 10,      # errors per task
    'MAX_HELP': 5          # help requests
}


class DomainSelectionHelper:
    """Helper class for managing domain selection and configuration"""
    
    @staticmethod
    def get_available_domains() -> List[Dict[str, Any]]:
        """Get list of available domains with descriptions"""
        return [
            {
                'domain': domain.value,
                'enum': domain,
                'title': ASSESSMENT_DOMAINS[domain.value]['title'],
                'description': ASSESSMENT_DOMAINS[domain.value]['description'],
                'type': ASSESSMENT_DOMAINS[domain.value]['type'],
                'component_count': DomainSelectionHelper._get_component_count(domain.value)
            }
            for domain in HumanCentricityDomain
            if domain.value in ASSESSMENT_DOMAINS
        ]
    
    @staticmethod
    def _get_component_count(domain_key: str) -> int:
        """Get count of components/questions for a domain"""
        domain_config = ASSESSMENT_DOMAINS[domain_key]
        
        if domain_config['type'] == 'likert':
            return len(domain_config['statements'])
        elif domain_config['type'] == 'combined':
            total = 0
            for component in domain_config['components'].values():
                if 'metrics' in component:
                    total += len(component['metrics'])
                elif 'symptoms' in component:
                    total += len(component['symptoms'])
            return total
        elif domain_config['type'] == 'sam':
            return len(domain_config['components'])
        elif domain_config['type'] == 'performance':
            return len(domain_config['metrics'])
        else:
            return 0
    
    @staticmethod
    def get_domain_configuration(selected_domains: Set[HumanCentricityDomain]) -> Dict[str, Any]:
        """Get configuration for selected domains"""
        config = {
            'domains': {},
            'scales': ASSESSMENT_SCALES,
            'total_sections': len(selected_domains)
        }
        
        for domain in selected_domains:
            if domain.value in ASSESSMENT_DOMAINS:
                config['domains'][domain.value] = ASSESSMENT_DOMAINS[domain.value]
        
        return config
    
    @staticmethod
    def validate_domain_data(selected_domains: Set[HumanCentricityDomain], form_data: Dict[str, Any]) -> List[str]:
        """Validate that form data contains required fields for selected domains"""
        missing_fields = []
        
        for domain in selected_domains:
            if domain == HumanCentricityDomain.CORE_USABILITY:
                if 'core_usability_responses' not in form_data:
                    missing_fields.append('core_usability_responses')
            elif domain == HumanCentricityDomain.TRUST_TRANSPARENCY:
                if 'trust_transparency_responses' not in form_data:
                    missing_fields.append('trust_transparency_responses')
            elif domain == HumanCentricityDomain.WORKLOAD_COMFORT:
                if 'workload_metrics' not in form_data or 'cybersickness_responses' not in form_data:
                    missing_fields.extend(['workload_metrics', 'cybersickness_responses'])
            elif domain == HumanCentricityDomain.EMOTIONAL_RESPONSE:
                if 'emotional_response' not in form_data:
                    missing_fields.append('emotional_response')
            elif domain == HumanCentricityDomain.PERFORMANCE:
                if 'performance_metrics' not in form_data:
                    missing_fields.append('performance_metrics')
        
        return missing_fields


# Enhanced assessment structure for easy frontend generation
def get_assessment_structure_for_domains(selected_domains: Set[HumanCentricityDomain]) -> Dict[str, Any]:
    """Generate assessment structure for selected domains"""
    sections = []
    
    for domain in selected_domains:
        if domain.value in ASSESSMENT_DOMAINS:
            domain_config = ASSESSMENT_DOMAINS[domain.value]
            
            if domain == HumanCentricityDomain.CORE_USABILITY:
                sections.append({
                    'id': 'core_usability',
                    'title': domain_config['title'],
                    'description': 'Rate each statement on a 1–7 scale (1 = Strongly Disagree, 7 = Strongly Agree)',
                    'type': 'likert',
                    'scale': 'likert_7_point',
                    'statements': domain_config['statements']
                })
            
            elif domain == HumanCentricityDomain.TRUST_TRANSPARENCY:
                sections.append({
                    'id': 'trust_transparency',
                    'title': domain_config['title'],
                    'description': 'Rate each statement on a 1–7 scale (1 = Strongly Disagree, 7 = Strongly Agree)',
                    'type': 'likert',
                    'scale': 'likert_7_point',
                    'statements': domain_config['statements']
                })
            
            elif domain == HumanCentricityDomain.WORKLOAD_COMFORT:
                sections.extend([
                    {
                        'id': 'workload_metrics',
                        'title': 'Mental Demand & Effort',
                        'description': 'Use sliders to rate each aspect',
                        'type': 'slider',
                        'scale': 'workload_slider',
                        'metrics': domain_config['components']['workload']['metrics']
                    },
                    {
                        'id': 'cybersickness',
                        'title': 'Cybersickness Symptoms',
                        'description': 'Rate the severity of each symptom',
                        'type': 'cybersickness',
                        'scale': 'cybersickness_severity',
                        'symptoms': domain_config['components']['cybersickness']['symptoms']
                    }
                ])
            
            elif domain == HumanCentricityDomain.EMOTIONAL_RESPONSE:
                sections.append({
                    'id': 'emotional_response',
                    'title': domain_config['title'],
                    'description': 'Select your current emotional state',
                    'type': 'sam',
                    'components': domain_config['components']
                })
            
            elif domain == HumanCentricityDomain.PERFORMANCE:
                sections.append({
                    'id': 'performance_metrics',
                    'title': domain_config['title'],
                    'description': 'Enter the measured performance values',
                    'type': 'performance',
                    'scale': 'performance_metrics',
                    'metrics': domain_config['metrics']
                })
    
    return {
        'sections': sections,
        'selected_domains': [domain.value for domain in selected_domains]
    }