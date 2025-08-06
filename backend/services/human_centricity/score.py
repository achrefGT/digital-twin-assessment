import numpy as np
from typing import Dict, Any, List
import logging

from shared.models.exceptions import ScoringException
from .models import (
    LikertResponse, WorkloadMetrics, CybersicknessResponse, 
    EmotionalResponse, PerformanceMetrics, ASSESSMENT_STATEMENTS
)
from .config import settings

logger = logging.getLogger(__name__)


def calculate_human_centricity_score(
    ux_trust_responses: List[LikertResponse],
    workload_metrics: WorkloadMetrics,
    cybersickness_responses: List[CybersicknessResponse],
    emotional_response: EmotionalResponse,
    performance_metrics: PerformanceMetrics
) -> Dict[str, Any]:
    """Calculate human-centricity scores from assessment responses"""
    
    try:
        # Validate inputs
        if not ux_trust_responses:
            raise ScoringException("No UX/Trust responses provided")
        
        if not cybersickness_responses:
            raise ScoringException("No cybersickness responses provided")
        
        # Validate expected response counts
        expected_ux_trust = len(ASSESSMENT_STATEMENTS['UX_Trust'])
        expected_cybersickness = len(ASSESSMENT_STATEMENTS['Cybersickness'])
        
        if len(ux_trust_responses) != expected_ux_trust:
            raise ScoringException(f"Expected {expected_ux_trust} UX/Trust responses, got {len(ux_trust_responses)}")
        
        if len(cybersickness_responses) != expected_cybersickness:
            raise ScoringException(f"Expected {expected_cybersickness} cybersickness responses, got {len(cybersickness_responses)}")
        
        # 1. UX & Trust Score (Likert items, 1-7 scale)
        try:
            likert_ratings = [response.rating for response in ux_trust_responses]
            if not all(1 <= rating <= 7 for rating in likert_ratings):
                raise ScoringException("Invalid Likert ratings - must be between 1 and 7")
            
            mean_likert = np.mean(likert_ratings)
            score_ux_trust = (mean_likert - 1) / 6 * 100
            
        except Exception as e:
            raise ScoringException(f"Error calculating UX/Trust score: {e}")
        
        # 2. Workload Score (inverted - lower workload is better)
        try:
            workload_values = [
                workload_metrics.mental_demand,
                workload_metrics.effort_required,
                workload_metrics.frustration_level
            ]
            if not all(0 <= val <= 100 for val in workload_values):
                raise ScoringException("Invalid workload values - must be between 0 and 100")
            
            mean_workload = np.mean(workload_values)
            score_workload = 100 - mean_workload
            
        except Exception as e:
            raise ScoringException(f"Error calculating workload score: {e}")
        
        # 3. Cybersickness Score (inverted - lower symptoms is better)
        try:
            cybersickness_ratings = [response.severity for response in cybersickness_responses]
            if not all(1 <= rating <= 5 for rating in cybersickness_ratings):
                raise ScoringException("Invalid cybersickness ratings - must be between 1 and 5")
            
            mean_cybersickness = np.mean(cybersickness_ratings)
            # Normalize cybersickness severity from 1-5 scale to 0-1 scale (where 1 is worst)
            normalized_cybersickness = (mean_cybersickness - 1) / (5 - 1)
            # Convert to 0-100 score where 100 is best (invert the normalized value)
            score_cybersickness = (1 - normalized_cybersickness) * 100
            
        except Exception as e:
            raise ScoringException(f"Error calculating cybersickness score: {e}")
        
        # 4. Emotional Response Score (combined valence and arousal)
        try:
            if not (1 <= emotional_response.valence <= 5 and 1 <= emotional_response.arousal <= 5):
                raise ScoringException("Invalid emotional response values - must be between 1 and 5")
            
            valence_norm = (emotional_response.valence - 1) / 4  # 0-1 scale
            arousal_norm = (emotional_response.arousal - 1) / 4  # 0-1 scale
            score_emotion = (valence_norm + arousal_norm) / 2 * 100
            
        except Exception as e:
            raise ScoringException(f"Error calculating emotional response score: {e}")
        
        # 5. Performance Score (lower time, errors, help requests is better)
        try:
            if performance_metrics.task_completion_time_min < 0:
                raise ScoringException("Task completion time cannot be negative")
            if performance_metrics.error_rate < 0:
                raise ScoringException("Error rate cannot be negative")
            if performance_metrics.help_requests < 0:
                raise ScoringException("Help requests cannot be negative")
            
            time_capped = min(performance_metrics.task_completion_time_min, settings.max_time_minutes)
            score_time = (settings.max_time_minutes - time_capped) / settings.max_time_minutes * 100
            
            errors_capped = min(performance_metrics.error_rate, settings.max_errors)
            score_errors = (settings.max_errors - errors_capped) / settings.max_errors * 100
            
            help_capped = min(performance_metrics.help_requests, settings.max_help_requests)
            score_help = (settings.max_help_requests - help_capped) / settings.max_help_requests * 100
            
            score_performance = np.mean([score_time, score_errors, score_help])
            
        except Exception as e:
            raise ScoringException(f"Error calculating performance score: {e}")
        
        # Overall Composite Score
        domain_scores = {
            'UX_Trust': round(score_ux_trust, 1),
            'Workload': round(score_workload, 1),
            'Cybersickness': round(score_cybersickness, 1),
            'Emotion': round(score_emotion, 1),
            'Performance': round(score_performance, 1)
        }
        
        overall_score = np.mean(list(domain_scores.values()))
        
        # Detailed metrics for analysis
        detailed_metrics = {
            'ux_trust': {
                'mean_rating': round(mean_likert, 2),
                'score': round(score_ux_trust, 1),
                'response_count': len(likert_ratings),
                'rating_distribution': {
                    'min': min(likert_ratings),
                    'max': max(likert_ratings),
                    'std': round(np.std(likert_ratings), 2)
                }
            },
            'workload': {
                'mental_demand': workload_metrics.mental_demand,
                'effort_required': workload_metrics.effort_required,
                'frustration_level': workload_metrics.frustration_level,
                'mean_workload': round(mean_workload, 2),
                'score': round(score_workload, 1)
            },
            'cybersickness': {
                'mean_severity': round(mean_cybersickness, 2),
                'score': round(score_cybersickness, 1),
                'symptoms': {
                    response.symptom: response.severity 
                    for response in cybersickness_responses
                }
            },
            'emotion': {
                'valence': emotional_response.valence,
                'arousal': emotional_response.arousal,
                'valence_normalized': round(valence_norm, 2),
                'arousal_normalized': round(arousal_norm, 2),
                'score': round(score_emotion, 1)
            },
            'performance': {
                'task_completion_time_min': performance_metrics.task_completion_time_min,
                'error_rate': performance_metrics.error_rate,
                'help_requests': performance_metrics.help_requests,
                'time_score': round(score_time, 1),
                'errors_score': round(score_errors, 1),
                'help_score': round(score_help, 1),
                'combined_score': round(score_performance, 1)
            }
        }
        
        result = {
            'overall_score': round(overall_score, 1),
            'domain_scores': domain_scores,
            'detailed_metrics': detailed_metrics
        }
        
        logger.info(f"Successfully calculated human centricity scores: overall={overall_score:.1f}, domains={len(domain_scores)}")
        return result
        
    except ScoringException:
        # Re-raise scoring exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in human centricity scoring: {e}")
        raise ScoringException(f"Unexpected error during scoring calculation: {e}")