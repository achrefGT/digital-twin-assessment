import numpy as np
from typing import Dict, Any, List
import logging

from shared.models.exceptions import ScoringException
from .models import SLCAInput, SocialIndicators, StakeholderGroup, DEFAULT_WEIGHTINGS
from .config import settings

logger = logging.getLogger(__name__)


def compute_slca(
    years: int,
    safety_incident_reduction: List[float],  # % reduction year-over-year
    worker_satisfaction: List[float],        # satisfaction index [0-100]
    community_engagement: List[float],       # engagement index [0-100]
    job_creation: List[int],                 # number of new jobs created per year
    weightings: Dict[str, float] = None      # weights for each indicator
) -> Dict[str, Any]:
    """
    Core S-LCA computation function (from your original models.py)
    """
    # Input validation
    if not (len(safety_incident_reduction) == len(worker_satisfaction) ==
            len(community_engagement) == len(job_creation) == years):
        raise ValueError("All input lists must have length equal to `years`.")

    # Default equal weighting if not provided
    default_weights = {
        'safety': 0.25,
        'satisfaction': 0.25,
        'engagement': 0.25,
        'jobs': 0.25
    }
    w = weightings or default_weights

    # Ensure weights sum to 1
    total_w = sum(w.values())
    if abs(total_w - 1.0) > 1e-6:
        raise ValueError(f"Weightings must sum to 1. Given sum: {total_w}")

    logger.debug(f"--- S-LCA START (years={years}) ---")
    logger.debug(f"Using weightings: {w}")

    # 1) Normalize job_creation to 0-100 scale
    max_jobs = max(job_creation) if job_creation else 1
    norm_jobs_pct = [(jc / max_jobs) * 100 for jc in job_creation]
    logger.debug(f"Normalized job creation (%): {norm_jobs_pct}")

    annual_scores: List[float] = []

    # 2) Compute each year's score
    for i in range(years):
        safety_score = max(0.0, min(safety_incident_reduction[i] / 100.0, 1.0))
        satisfaction_score = max(0.0, min(worker_satisfaction[i] / 100.0, 1.0))
        engagement_score = max(0.0, min(community_engagement[i] / 100.0, 1.0))
        jobs_score = max(0.0, min(norm_jobs_pct[i] / 100.0, 1.0))

        # Weighted sum
        year_score = (
            w['safety'] * safety_score +
            w['satisfaction'] * satisfaction_score +
            w['engagement'] * engagement_score +
            w['jobs'] * jobs_score
        )
        logger.debug(
            f"Year {i+1} -> safety: {safety_score:.2f}, "
            f"satisfaction: {satisfaction_score:.2f}, engagement: {engagement_score:.2f}, "
            f"jobs: {jobs_score:.2f} => score: {year_score:.2f}"
        )
        annual_scores.append(year_score)

    # 3) Compute overall average
    overall_score = sum(annual_scores) / years if years > 0 else 0.0
    logger.debug(f"Annual social scores: {annual_scores}")
    logger.debug(f"Overall social sustainability score: {overall_score:.2f}")
    logger.debug("--- S-LCA END ---")

    return {
        'annual_scores': annual_scores,
        'overall_score': overall_score
    }


def get_sustainability_rating(score: float) -> str:
    """Convert numerical score to sustainability rating"""
    if score >= 0.8:
        return "Excellent"
    elif score >= 0.6:
        return "Good"
    elif score >= 0.4:
        return "Fair"
    elif score >= 0.2:
        return "Poor"
    else:
        return "Critical"


def get_performance_trend(annual_scores: List[float]) -> str:
    """Analyze the trend in social performance"""
    if len(annual_scores) < 2:
        return "Insufficient data"
    
    # Calculate trend
    recent_avg = np.mean(annual_scores[-3:]) if len(annual_scores) >= 3 else annual_scores[-1]
    early_avg = np.mean(annual_scores[:3]) if len(annual_scores) >= 3 else annual_scores[0]
    
    improvement = (recent_avg - early_avg) / early_avg if early_avg > 0 else 0
    
    if improvement > 0.1:
        return "Strongly Improving"
    elif improvement > 0.05:
        return "Improving"
    elif improvement > -0.05:
        return "Stable"
    elif improvement > -0.1:
        return "Declining"
    else:
        return "Strongly Declining"


def calculate_stakeholder_impact(indicators: SocialIndicators, stakeholder_group: StakeholderGroup) -> float:
    """Calculate stakeholder-specific impact score"""
    indicators_dict = indicators.dict()
    
    weights = DEFAULT_WEIGHTINGS.get(stakeholder_group.value, DEFAULT_WEIGHTINGS[StakeholderGroup.WORKERS.value])
    
    # Calculate weighted score
    total_score = 0.0
    total_weight = 0.0
    
    for indicator, weight in weights.items():
        if indicator in indicators_dict:
            values = indicators_dict[indicator]
            if values:
                if indicator == 'job_creation':
                    # Normalize job creation (using config max)
                    avg_value = sum(values) / len(values)
                    normalized_value = min(avg_value / settings.max_jobs_per_year, 1.0)
                else:
                    # For percentage indicators, normalize to 0-1
                    avg_value = sum(values) / len(values)
                    normalized_value = avg_value / 100.0
                
                total_score += weight * normalized_value
                total_weight += weight
    
    return total_score / total_weight if total_weight > 0 else 0.0


def generate_recommendations(
    slca_input: SLCAInput, 
    overall_score: float, 
    annual_scores: List[float]
) -> List[str]:
    """Generate recommendations based on S-LCA results"""
    recommendations = []
    indicators = slca_input.indicators
    
    # Performance-based recommendations
    if overall_score < 0.4:
        recommendations.append("Immediate action required: Develop comprehensive social sustainability strategy")
    elif overall_score < 0.6:
        recommendations.append("Moderate improvements needed: Focus on key social impact areas")
    else:
        recommendations.append("Maintain current performance: Continue monitoring and incremental improvements")
    
    # Trend-based recommendations
    trend = get_performance_trend(annual_scores)
    if "Declining" in trend:
        recommendations.append("Address declining social performance through stakeholder engagement initiatives")
    elif "Improving" in trend:
        recommendations.append("Capitalize on positive trends by expanding successful social programs")
    
    # Indicator-specific recommendations
    avg_safety = sum(indicators.safety_incident_reduction) / len(indicators.safety_incident_reduction)
    if avg_safety < 10:
        recommendations.append("Enhance safety programs to achieve higher incident reduction rates")
    
    avg_satisfaction = sum(indicators.worker_satisfaction) / len(indicators.worker_satisfaction)
    if avg_satisfaction < 70:
        recommendations.append("Implement worker satisfaction improvement programs and feedback mechanisms")
    
    avg_engagement = sum(indicators.community_engagement) / len(indicators.community_engagement)
    if avg_engagement < 60:
        recommendations.append("Strengthen community engagement through regular consultation and participation programs")
    
    total_jobs = sum(indicators.job_creation)
    if total_jobs < 10:
        recommendations.append("Explore opportunities for increased local job creation and skills development")
    
    avg_gender = sum(indicators.gender_equality) / len(indicators.gender_equality)
    if avg_gender < 65:
        recommendations.append("Develop targeted gender equality and diversity initiatives")
    
    # Stakeholder-specific recommendations
    if slca_input.stakeholderGroup == StakeholderGroup.WORKERS:
        recommendations.append("Focus on worker safety, satisfaction, and skills development programs")
    elif slca_input.stakeholderGroup == StakeholderGroup.COMMUNITY:
        recommendations.append("Prioritize community investment and local employment opportunities")
    elif slca_input.stakeholderGroup == StakeholderGroup.CONSUMERS:
        recommendations.append("Emphasize cultural preservation and ethical business practices")
    
    return recommendations[:6]  # Limit to top 6 recommendations


def calculate_slca_score(slca_input: SLCAInput) -> Dict[str, Any]:
    """
    Calculate comprehensive S-LCA scores from input data
    
    This is the main scoring function that integrates all S-LCA calculations
    """
    
    try:
        # Validate inputs
        if slca_input.years <= 0:
            raise ScoringException("Assessment years must be greater than 0")
        
        # Extract core indicators for compute_slca function
        safety_reduction = slca_input.indicators.safety_incident_reduction
        worker_satisfaction = slca_input.indicators.worker_satisfaction
        community_engagement = slca_input.indicators.community_engagement
        job_creation = slca_input.indicators.job_creation
        
        # Validate array lengths
        expected_length = slca_input.years
        arrays_to_check = [safety_reduction, worker_satisfaction, community_engagement, job_creation]
        
        for i, arr in enumerate(arrays_to_check):
            if len(arr) != expected_length:
                raise ScoringException(f"Indicator array {i} length ({len(arr)}) does not match years ({expected_length})")
        
        # Use custom weightings if provided, otherwise use defaults for basic computation
        weightings = None
        if slca_input.weightings:
            # Map custom weightings to basic indicators
            weightings = {
                'safety': slca_input.weightings.get('safety_incident_reduction', 0.25),
                'satisfaction': slca_input.weightings.get('worker_satisfaction', 0.25),
                'engagement': slca_input.weightings.get('community_engagement', 0.25),
                'jobs': slca_input.weightings.get('job_creation', 0.25)
            }
        
        # Call the core compute_slca function
        slca_results = compute_slca(
            years=slca_input.years,
            safety_incident_reduction=safety_reduction,
            worker_satisfaction=worker_satisfaction,
            community_engagement=community_engagement,
            job_creation=job_creation,
            weightings=weightings
        )
        
        # Extract basic results
        overall_score = slca_results['overall_score']
        annual_scores = slca_results['annual_scores']
        
        # Calculate additional enhanced metrics
        stakeholder_impact_score = calculate_stakeholder_impact(
            slca_input.indicators, 
            slca_input.stakeholderGroup
        )
        
        # Generate sustainability rating
        sustainability_rating = get_sustainability_rating(overall_score)
        
        # Analyze performance trend
        performance_trend = get_performance_trend(annual_scores)
        
        # Calculate key metrics
        key_metrics = {
            'average_annual_score': round(np.mean(annual_scores), 3),
            'score_variance': round(np.var(annual_scores), 3),
            'final_year_score': round(annual_scores[-1], 3) if annual_scores else 0.0,
            'improvement_rate': round(
                (annual_scores[-1] - annual_scores[0]) / annual_scores[0] if len(annual_scores) > 1 and annual_scores[0] > 0 else 0.0, 
                3
            ),
            'stakeholder_alignment': round(stakeholder_impact_score, 3),
            'consistency_score': round(
                1.0 - (np.std(annual_scores) / np.mean(annual_scores)) if np.mean(annual_scores) > 0 else 0.0, 
                3
            ),
            'avg_safety_reduction': round(np.mean(safety_reduction), 2),
            'avg_worker_satisfaction': round(np.mean(worker_satisfaction), 2),
            'avg_community_engagement': round(np.mean(community_engagement), 2),
            'total_jobs_created': sum(job_creation),
            'avg_skills_development': round(np.mean(slca_input.indicators.skills_development), 2),
            'avg_health_safety': round(np.mean(slca_input.indicators.health_safety_improvements), 2)
        }
        
        # Generate recommendations
        recommendations = generate_recommendations(slca_input, overall_score, annual_scores)
        
        # Compile comprehensive results
        result = {
            'annual_scores': [round(score, 3) for score in annual_scores],
            'overall_score': round(overall_score, 3),
            'social_sustainability_rating': sustainability_rating,
            'stakeholder_impact_score': round(stakeholder_impact_score, 3),
            'social_performance_trend': performance_trend,
            'key_metrics': key_metrics,
            'recommendations': recommendations,
            'stakeholder_group': slca_input.stakeholderGroup.value,
            'analysis_period_years': slca_input.years,
            'detailed_metrics': {
                'indicator_averages': {
                    'safety_incident_reduction': key_metrics['avg_safety_reduction'],
                    'worker_satisfaction': key_metrics['avg_worker_satisfaction'],
                    'community_engagement': key_metrics['avg_community_engagement'],
                    'job_creation': key_metrics['total_jobs_created'],
                    'skills_development': key_metrics['avg_skills_development'],
                    'health_safety_improvements': key_metrics['avg_health_safety'],
                    'local_employment': round(np.mean(slca_input.indicators.local_employment), 2),
                    'gender_equality': round(np.mean(slca_input.indicators.gender_equality), 2),
                    'fair_wages': round(np.mean(slca_input.indicators.fair_wages), 2),
                    'working_conditions': round(np.mean(slca_input.indicators.working_conditions), 2),
                    'community_investment': round(np.mean(slca_input.indicators.community_investment), 2),
                    'cultural_preservation': round(np.mean(slca_input.indicators.cultural_preservation), 2),
                    'stakeholder_participation': round(np.mean(slca_input.indicators.stakeholder_participation), 2)
                },
                'trend_analysis': {
                    'trend_direction': performance_trend,
                    'improvement_rate': key_metrics['improvement_rate'],
                    'consistency_score': key_metrics['consistency_score'],
                    'score_variance': key_metrics['score_variance']
                },
                'stakeholder_analysis': {
                    'primary_group': slca_input.stakeholderGroup.value,
                    'impact_score': key_metrics['stakeholder_alignment'],
                    'weighted_indicators': list(DEFAULT_WEIGHTINGS.get(slca_input.stakeholderGroup.value, {}).keys())
                }
            }
        }
        
        logger.info(f"Successfully calculated S-LCA scores: overall={overall_score:.3f}, rating={sustainability_rating}, stakeholder={slca_input.stakeholderGroup.value}")
        return result
        
    except ScoringException:
        # Re-raise scoring exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in S-LCA scoring: {e}")
        raise ScoringException(f"Unexpected error during S-LCA scoring calculation: {e}")