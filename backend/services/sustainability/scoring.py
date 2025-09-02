import numpy as np
from typing import Dict, Any
import logging

from shared.models.exceptions import ScoringException
from .models import (
    EnvironmentalAssessment, EconomicAssessment, SocialAssessment,
    DigitalTwinRealismLevel, FlowTrackingLevel, EnergyVisibilityLevel,
    EnvironmentalScopeLevel, SimulationPredictionLevel,
    DigitalizationBudgetLevel, SavingsLevel, PerformanceImprovementLevel,
    ROITimeframeLevel, EmployeeImpactLevel, WorkplaceSafetyLevel, RegionalBenefitsLevel
)
from .config import settings

logger = logging.getLogger(__name__)


def calculate_sustainability_score(
    environmental: EnvironmentalAssessment,
    economic: EconomicAssessment,
    social: SocialAssessment
) -> Dict[str, Any]:
    """Calculate sustainability scores from assessments"""
    
    try:
        # Environmental scoring (0-100 scale)
        environmental_score = _calculate_environmental_score(environmental)
        
        # Economic scoring (0-100 scale)
        economic_score = _calculate_economic_score(economic)
        
        # Social scoring (0-100 scale)
        social_score = _calculate_social_score(social)
        
        # Calculate weighted overall score
        overall_score = (
            environmental_score * settings.dimension_weight_environmental +
            economic_score * settings.dimension_weight_economic +
            social_score * settings.dimension_weight_social
        )
        
        dimension_scores = {
            'environmental': round(environmental_score, 1),
            'economic': round(economic_score, 1),
            'social': round(social_score, 1)
        }
        
        # Detailed metrics for analysis
        sustainability_metrics = {
            'dimension_weights': {
                'environmental': settings.dimension_weight_environmental,
                'economic': settings.dimension_weight_economic,
                'social': settings.dimension_weight_social
            },
            'environmental_details': _get_environmental_details(environmental),
            'economic_details': _get_economic_details(economic),
            'social_details': _get_social_details(social),
            'score_distribution': {
                'min': min(environmental_score, economic_score, social_score),
                'max': max(environmental_score, economic_score, social_score),
                'std': round(np.std([environmental_score, economic_score, social_score]), 2)
            }
        }
        
        result = {
            'overall_score': round(overall_score, 1),
            'dimension_scores': dimension_scores,
            'sustainability_metrics': sustainability_metrics
        }
        
        logger.info(f"Successfully calculated sustainability scores: overall={overall_score:.1f}")
        return result
        
    except Exception as e:
        logger.error(f"Unexpected error in sustainability scoring: {e}")
        raise ScoringException(f"Unexpected error during scoring calculation: {e}")


def _calculate_environmental_score(assessment: EnvironmentalAssessment) -> float:
    """Calculate environmental dimension score (0-100)"""
    
    # Score mappings for each criterion (0-5 scale, then normalized to 0-100)
    realism_scores = {
        DigitalTwinRealismLevel.STATIC_PLAN: 0,
        DigitalTwinRealismLevel.SIMPLE_3D: 1,
        DigitalTwinRealismLevel.BASIC_MOVEMENTS: 2,
        DigitalTwinRealismLevel.REPRESENTATIVE_SIMULATION: 3,
        DigitalTwinRealismLevel.HIGH_FIDELITY: 4,
        DigitalTwinRealismLevel.REAL_TIME_CONNECTION: 5
    }
    
    flow_scores = {
        FlowTrackingLevel.NOTHING_TRACKED: 0,
        FlowTrackingLevel.SINGLE_FLOW: 1,
        FlowTrackingLevel.MULTIPLE_FLOWS: 2,
        FlowTrackingLevel.GLOBAL_BALANCE: 3,
        FlowTrackingLevel.DETAILED_TRACEABILITY: 4,
        FlowTrackingLevel.COMPLETE_SUPPLY_CHAIN: 5
    }
    
    energy_scores = {
        EnergyVisibilityLevel.NO_DATA: 0,
        EnergyVisibilityLevel.ANNUAL_BILLS: 1,
        EnergyVisibilityLevel.MONTHLY_READINGS: 2,
        EnergyVisibilityLevel.CONTINUOUS_EQUIPMENT: 3,
        EnergyVisibilityLevel.REAL_TIME_MAJORITY: 4,
        EnergyVisibilityLevel.PRECISE_SUBSYSTEM_COUNTING: 5
    }
    
    scope_scores = {
        EnvironmentalScopeLevel.NO_INDICATORS: 0,
        EnvironmentalScopeLevel.ENERGY_ONLY: 1,
        EnvironmentalScopeLevel.ENERGY_CARBON: 2,
        EnvironmentalScopeLevel.ADD_WATER: 3,
        EnvironmentalScopeLevel.MULTI_INDICATORS: 4,
        EnvironmentalScopeLevel.COMPLETE_LIFECYCLE: 5
    }
    
    simulation_scores = {
        SimulationPredictionLevel.OBSERVATION_ONLY: 0,
        SimulationPredictionLevel.SIMPLE_REPORTS: 1,
        SimulationPredictionLevel.BASIC_CHANGE_TESTS: 2,
        SimulationPredictionLevel.PREDICTIVE_SCENARIOS: 3,
        SimulationPredictionLevel.ASSISTED_OPTIMIZATION: 4,
        SimulationPredictionLevel.AUTONOMOUS_OPTIMIZATION: 5
    }
    
    # Calculate weighted average (equal weights for simplicity)
    scores = [
        realism_scores[assessment.digital_twin_realism],
        flow_scores[assessment.flow_tracking],
        energy_scores[assessment.energy_visibility],
        scope_scores[assessment.environmental_scope],
        simulation_scores[assessment.simulation_prediction]
    ]
    
    # Convert to 0-100 scale
    average_score = np.mean(scores)
    return (average_score / 5) * 100


def _calculate_economic_score(assessment: EconomicAssessment) -> float:
    """Calculate economic dimension score (0-100)"""
    
    # Budget scoring (inverse - lower budget is better for sustainability)
    budget_scores = {
        DigitalizationBudgetLevel.NO_BUDGET: 0,  # No digitalization = no benefits
        DigitalizationBudgetLevel.MINIMAL_BUDGET: 4,  # Efficient investment
        DigitalizationBudgetLevel.CORRECT_BUDGET: 5,  # Optimal investment
        DigitalizationBudgetLevel.LARGE_BUDGET: 3,  # Higher investment, good returns
        DigitalizationBudgetLevel.VERY_LARGE_BUDGET: 2,  # Very high investment
        DigitalizationBudgetLevel.MAXIMUM_BUDGET: 1   # Maximum investment, sustainability concerns
    }
    
    savings_scores = {
        SavingsLevel.NO_SAVINGS: 0,
        SavingsLevel.SMALL_SAVINGS: 1,
        SavingsLevel.CORRECT_SAVINGS: 2,
        SavingsLevel.GOOD_SAVINGS: 3,
        SavingsLevel.VERY_GOOD_SAVINGS: 4,
        SavingsLevel.EXCEPTIONAL_SAVINGS: 5
    }
    
    performance_scores = {
        PerformanceImprovementLevel.NO_IMPROVEMENT: 0,
        PerformanceImprovementLevel.SMALL_IMPROVEMENT: 1,
        PerformanceImprovementLevel.CORRECT_IMPROVEMENT: 2,
        PerformanceImprovementLevel.GOOD_IMPROVEMENT: 3,
        PerformanceImprovementLevel.VERY_GOOD_IMPROVEMENT: 4,
        PerformanceImprovementLevel.EXCEPTIONAL_IMPROVEMENT: 5
    }
    
    roi_scores = {
        ROITimeframeLevel.NOT_CALCULATED_OR_OVER_5_YEARS: 0,
        ROITimeframeLevel.PROFITABLE_3_TO_5_YEARS: 1,
        ROITimeframeLevel.PROFITABLE_2_TO_3_YEARS: 2,
        ROITimeframeLevel.PROFITABLE_18_TO_24_MONTHS: 3,
        ROITimeframeLevel.PROFITABLE_12_TO_18_MONTHS: 4,
        ROITimeframeLevel.PROFITABLE_UNDER_12_MONTHS: 5
    }
    
    # Calculate weighted average
    scores = [
        budget_scores[assessment.digitalization_budget],
        savings_scores[assessment.savings_realized],
        performance_scores[assessment.performance_improvement],
        roi_scores[assessment.roi_timeframe]
    ]
    
    # Convert to 0-100 scale
    average_score = np.mean(scores)
    return (average_score / 5) * 100


def _calculate_social_score(assessment: SocialAssessment) -> float:
    """Calculate social dimension score (0-100)"""
    
    # Employee impact scoring (positive employment effects = higher scores)
    employee_scores = {
        EmployeeImpactLevel.JOB_SUPPRESSION_OVER_10_PERCENT: 0,
        EmployeeImpactLevel.SOME_SUPPRESSIONS_5_TO_10_PERCENT: 1,
        EmployeeImpactLevel.STABLE_WORKFORCE_SOME_TRAINING: 2,
        EmployeeImpactLevel.SAME_JOBS_ALL_TRAINED: 3,
        EmployeeImpactLevel.NEW_POSITIONS_5_TO_10_PERCENT: 4,
        EmployeeImpactLevel.STRONG_QUALIFIED_JOB_CREATION: 5
    }
    
    safety_scores = {
        WorkplaceSafetyLevel.NO_CHANGE: 0,
        WorkplaceSafetyLevel.SLIGHT_REDUCTION_UNDER_10: 1,
        WorkplaceSafetyLevel.MODERATE_REDUCTION_10_TO_25: 2,
        WorkplaceSafetyLevel.GOOD_IMPROVEMENT_25_TO_50: 3,
        WorkplaceSafetyLevel.STRONG_REDUCTION_50_TO_75: 4,
        WorkplaceSafetyLevel.NEAR_ELIMINATION_OVER_75: 5
    }
    
    regional_scores = {
        RegionalBenefitsLevel.NO_LOCAL_IMPACT: 0,
        RegionalBenefitsLevel.SOME_LOCAL_PURCHASES: 1,
        RegionalBenefitsLevel.PARTNERSHIP_1_2_COMPANIES: 2,
        RegionalBenefitsLevel.INSTITUTIONAL_COLLABORATION: 3,
        RegionalBenefitsLevel.NOTABLE_LOCAL_CREATION: 4,
        RegionalBenefitsLevel.MAJOR_IMPACT: 5
    }
    
    # Calculate weighted average
    scores = [
        employee_scores[assessment.employee_impact],
        safety_scores[assessment.workplace_safety],
        regional_scores[assessment.regional_benefits]
    ]
    
    # Convert to 0-100 scale
    average_score = np.mean(scores)
    return (average_score / 5) * 100


def _get_environmental_details(assessment: EnvironmentalAssessment) -> Dict[str, Any]:
    """Get detailed environmental assessment information"""
    return {
        'digital_twin_realism': {
            'level': assessment.digital_twin_realism.value,
            'description': assessment.digital_twin_realism.value.replace('_', ' ').title()
        },
        'flow_tracking': {
            'level': assessment.flow_tracking.value,
            'description': assessment.flow_tracking.value.replace('_', ' ').title()
        },
        'energy_visibility': {
            'level': assessment.energy_visibility.value,
            'description': assessment.energy_visibility.value.replace('_', ' ').title()
        },
        'environmental_scope': {
            'level': assessment.environmental_scope.value,
            'description': assessment.environmental_scope.value.replace('_', ' ').title()
        },
        'simulation_prediction': {
            'level': assessment.simulation_prediction.value,
            'description': assessment.simulation_prediction.value.replace('_', ' ').title()
        }
    }


def _get_economic_details(assessment: EconomicAssessment) -> Dict[str, Any]:
    """Get detailed economic assessment information"""
    return {
        'digitalization_budget': {
            'level': assessment.digitalization_budget.value,
            'description': assessment.digitalization_budget.value.replace('_', ' ').title()
        },
        'savings_realized': {
            'level': assessment.savings_realized.value,
            'description': assessment.savings_realized.value.replace('_', ' ').title()
        },
        'performance_improvement': {
            'level': assessment.performance_improvement.value,
            'description': assessment.performance_improvement.value.replace('_', ' ').title()
        },
        'roi_timeframe': {
            'level': assessment.roi_timeframe.value,
            'description': assessment.roi_timeframe.value.replace('_', ' ').title()
        }
    }


def _get_social_details(assessment: SocialAssessment) -> Dict[str, Any]:
    """Get detailed social assessment information"""
    return {
        'employee_impact': {
            'level': assessment.employee_impact.value,
            'description': assessment.employee_impact.value.replace('_', ' ').title()
        },
        'workplace_safety': {
            'level': assessment.workplace_safety.value,
            'description': assessment.workplace_safety.value.replace('_', ' ').title()
        },
        'regional_benefits': {
            'level': assessment.regional_benefits.value,
            'description': assessment.regional_benefits.value.replace('_', ' ').title()
        }
    }