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


# Complete assessment statements configuration matching your Streamlit app
ASSESSMENT_STATEMENTS = {
    'Section1_Core_Usability_UX': [
        "I found the digital twin intuitive and easy to use.",
        "The system's functions feel well integrated and coherent.",
        "I would use this digital twin frequently in my work.",
        "Learning to operate the system was quick and straightforward.",
        "I feel confident and in control when using the twin.",
        "The terminology and workflows match my domain expertise.",
        "I can easily tailor views, dashboards, and alerts to my needs.",
        "I feel comfortable with how the system collects, uses, and displays my data."
    ],
    'Section2_Trust_Transparency': [
        "I understand the origins and currency of the data shown.",
        "The system explains how it generated its insights or recommendations.",
        "I trust the accuracy and reliability of the digital twin's outputs.",
        "I feel confident making operational decisions based on the twin's insights."
    ],
    'Section3_Workload_Metrics': {
        'description': 'Rate each on a 0-100 scale (0 = very low, 100 = very high)',
        'metrics': [
            "Mental Demand",
            "Effort Required", 
            "Frustration Level"
        ]
    },
    'Section3_Cybersickness_Symptoms': {
        'description': 'Rate each symptom (1 = None, 5 = Severe)',
        'symptoms': [
            "Queasiness or nausea",
            "Dizziness or off-balance feeling",
            "Eye strain or visual discomfort"
        ]
    },
    'Section4_Emotional_Response_SAM': {
        'valence': {
            'description': 'Valence (1 = Negative, 5 = Positive)',
            'scale': [1, 2, 3, 4, 5]
        },
        'arousal': {
            'description': 'Arousal (1 = Calm, 5 = Excited)', 
            'scale': [1, 2, 3, 4, 5]
        }
    },
    'Section5_Objective_Performance': {
        'description': 'Enter actual measured values',
        'metrics': [
            "Task Completion Time (minutes)",
            "Error Rate (errors per task)",
            "Help Requests (occurrences)"
        ]
    }
}

# Scale definitions matching your Streamlit app
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

# Constants for normalizing objective performance (matching your Streamlit app)
PERFORMANCE_CONSTANTS = {
    'MAX_TIME': 30.0,      # minutes (expected maximum)  
    'MAX_ERRORS': 10,      # errors per task
    'MAX_HELP': 5          # help requests
}