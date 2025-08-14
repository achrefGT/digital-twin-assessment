from datetime import datetime, timedelta
import numpy as np
from typing import Dict, Any, List
import logging

from shared.models.exceptions import ScoringException
from .models import (
    LikertResponse, WorkloadMetrics, CybersicknessResponse, 
    EmotionalResponse, PerformanceMetrics, ASSESSMENT_STATEMENTS,
    PERFORMANCE_CONSTANTS
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
        
        # Validate expected response counts based on the updated statement structure
        expected_section1 = len(ASSESSMENT_STATEMENTS['Section1_Core_Usability_UX'])
        expected_section2 = len(ASSESSMENT_STATEMENTS['Section2_Trust_Transparency'])
        expected_total_ux_trust = expected_section1 + expected_section2
        expected_cybersickness = len(ASSESSMENT_STATEMENTS['Section3_Cybersickness_Symptoms']['symptoms'])
        
        if len(ux_trust_responses) != expected_total_ux_trust:
            logger.warning(f"Expected {expected_total_ux_trust} UX/Trust responses (Section 1: {expected_section1}, Section 2: {expected_section2}), got {len(ux_trust_responses)}")
            # Continue processing but log the discrepancy
        
        if len(cybersickness_responses) != expected_cybersickness:
            logger.warning(f"Expected {expected_cybersickness} cybersickness responses, got {len(cybersickness_responses)}")
            # Continue processing but log the discrepancy
        
        # 1. UX & Trust Score (Combined Section 1 & 2 Likert items, 1-7 scale)
        try:
            likert_ratings = [response.rating for response in ux_trust_responses]
            if not all(1 <= rating <= 7 for rating in likert_ratings):
                raise ScoringException("Invalid Likert ratings - must be between 1 and 7")
            
            mean_likert = np.mean(likert_ratings)
            score_ux_trust = (mean_likert - 1) / 6 * 100
            
            # Separate scoring for Section 1 and Section 2 if we have the expected number of responses
            section1_score = None
            section2_score = None
            
            if len(ux_trust_responses) == expected_total_ux_trust:
                section1_ratings = likert_ratings[:expected_section1]
                section2_ratings = likert_ratings[expected_section1:]
                
                if section1_ratings:
                    section1_mean = np.mean(section1_ratings)
                    section1_score = (section1_mean - 1) / 6 * 100
                
                if section2_ratings:
                    section2_mean = np.mean(section2_ratings)
                    section2_score = (section2_mean - 1) / 6 * 100
            
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
        # Use constants from the models instead of settings
        try:
            if performance_metrics.task_completion_time_min < 0:
                raise ScoringException("Task completion time cannot be negative")
            if performance_metrics.error_rate < 0:
                raise ScoringException("Error rate cannot be negative")
            if performance_metrics.help_requests < 0:
                raise ScoringException("Help requests cannot be negative")
            
            max_time = PERFORMANCE_CONSTANTS['MAX_TIME']
            max_errors = PERFORMANCE_CONSTANTS['MAX_ERRORS']
            max_help = PERFORMANCE_CONSTANTS['MAX_HELP']
            
            time_capped = min(performance_metrics.task_completion_time_min, max_time)
            score_time = (max_time - time_capped) / max_time * 100
            
            errors_capped = min(performance_metrics.error_rate, max_errors)
            score_errors = (max_errors - errors_capped) / max_errors * 100
            
            help_capped = min(performance_metrics.help_requests, max_help)
            score_help = (max_help - help_capped) / max_help * 100
            
            score_performance = np.mean([score_time, score_errors, score_help])
            
        except Exception as e:
            raise ScoringException(f"Error calculating performance score: {e}")
        
        # Overall Composite Score with domain scores
        domain_scores = {
            'UX_Trust': round(score_ux_trust, 1),
            'Workload': round(score_workload, 1),
            'Cybersickness': round(score_cybersickness, 1),
            'Emotion': round(score_emotion, 1),
            'Performance': round(score_performance, 1)
        }
        
        # Add section-specific scores if available
        if section1_score is not None:
            domain_scores['Core_Usability'] = round(section1_score, 1)
        if section2_score is not None:
            domain_scores['Trust_Transparency'] = round(section2_score, 1)
        
        overall_score = np.mean([v for k, v in domain_scores.items() if k in ['UX_Trust', 'Workload', 'Cybersickness', 'Emotion', 'Performance']])
        
        # Detailed metrics for analysis (matching your Streamlit app structure)
        detailed_metrics = {
            'section1_core_usability': {
                'score': round(section1_score, 1) if section1_score is not None else None,
                'statement_count': expected_section1,
                'statements': ASSESSMENT_STATEMENTS['Section1_Core_Usability_UX']
            },
            'section2_trust_transparency': {
                'score': round(section2_score, 1) if section2_score is not None else None,
                'statement_count': expected_section2,
                'statements': ASSESSMENT_STATEMENTS['Section2_Trust_Transparency']
            },
            'ux_trust_combined': {
                'mean_rating': round(mean_likert, 2),
                'score': round(score_ux_trust, 1),
                'response_count': len(likert_ratings),
                'rating_distribution': {
                    'min': min(likert_ratings),
                    'max': max(likert_ratings),
                    'std': round(np.std(likert_ratings), 2),
                    'ratings': likert_ratings
                },
                'section_breakdown': {
                    'section1_ratings': likert_ratings[:expected_section1] if len(likert_ratings) == expected_total_ux_trust else None,
                    'section2_ratings': likert_ratings[expected_section1:] if len(likert_ratings) == expected_total_ux_trust else None
                }
            },
            'section3_workload': {
                'mental_demand': workload_metrics.mental_demand,
                'effort_required': workload_metrics.effort_required,
                'frustration_level': workload_metrics.frustration_level,
                'mean_workload': round(mean_workload, 2),
                'score': round(score_workload, 1),
                'metrics': ASSESSMENT_STATEMENTS['Section3_Workload_Metrics']['metrics']
            },
            'section3_cybersickness': {
                'mean_severity': round(mean_cybersickness, 2),
                'score': round(score_cybersickness, 1),
                'symptoms': {
                    response.symptom: response.severity 
                    for response in cybersickness_responses
                },
                'severity_distribution': {
                    'min': min(cybersickness_ratings),
                    'max': max(cybersickness_ratings),
                    'std': round(np.std(cybersickness_ratings), 2)
                },
                'expected_symptoms': ASSESSMENT_STATEMENTS['Section3_Cybersickness_Symptoms']['symptoms']
            },
            'section4_emotion_sam': {
                'valence': emotional_response.valence,
                'arousal': emotional_response.arousal,
                'valence_normalized': round(valence_norm, 2),
                'arousal_normalized': round(arousal_norm, 2),
                'score': round(score_emotion, 1),
                'interpretation': {
                    'valence_label': _get_valence_label(emotional_response.valence),
                    'arousal_label': _get_arousal_label(emotional_response.arousal),
                    'quadrant': _get_emotion_quadrant(valence_norm, arousal_norm)
                }
            },
            'section5_performance': {
                'raw_metrics': {
                    'task_completion_time_min': performance_metrics.task_completion_time_min,
                    'error_rate': performance_metrics.error_rate,
                    'help_requests': performance_metrics.help_requests
                },
                'capped_values': {
                    'time_capped': time_capped,
                    'errors_capped': errors_capped,
                    'help_capped': help_capped
                },
                'individual_scores': {
                    'time_score': round(score_time, 1),
                    'errors_score': round(score_errors, 1),
                    'help_score': round(score_help, 1)
                },
                'combined_score': round(score_performance, 1),
                'performance_limits': {
                    'max_time': max_time,
                    'max_errors': max_errors,
                    'max_help': max_help
                },
                'metrics': ASSESSMENT_STATEMENTS['Section5_Objective_Performance']['metrics']
            },
            'scoring_metadata': {
                'total_sections': 5,
                'processing_timestamp': datetime.utcnow(),
                'validation_passed': True,
                'expected_responses': {
                    'ux_trust_total': expected_total_ux_trust,
                    'section1_core_usability': expected_section1,
                    'section2_trust_transparency': expected_section2,
                    'cybersickness_symptoms': expected_cybersickness,
                    'workload_metrics': 3,
                    'sam_components': 2,
                    'performance_metrics': 3
                },
                'actual_responses': {
                    'ux_trust_received': len(ux_trust_responses),
                    'cybersickness_received': len(cybersickness_responses)
                }
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


def _get_valence_label(valence: int) -> str:
    """Get human-readable label for valence value"""
    labels = {
        1: "Very Negative",
        2: "Negative", 
        3: "Neutral",
        4: "Positive",
        5: "Very Positive"
    }
    return labels.get(valence, "Unknown")


def _get_arousal_label(arousal: int) -> str:
    """Get human-readable label for arousal value"""
    labels = {
        1: "Very Calm",
        2: "Calm",
        3: "Neutral", 
        4: "Excited",
        5: "Very Excited"
    }
    return labels.get(arousal, "Unknown")


def _get_emotion_quadrant(valence_norm: float, arousal_norm: float) -> str:
    """Determine emotional quadrant based on normalized valence and arousal"""
    if valence_norm >= 0.5 and arousal_norm >= 0.5:
        return "High Positive Arousal (Excited/Happy)"
    elif valence_norm >= 0.5 and arousal_norm < 0.5:
        return "Low Positive Arousal (Calm/Content)"
    elif valence_norm < 0.5 and arousal_norm >= 0.5:
        return "High Negative Arousal (Stressed/Anxious)"
    else:
        return "Low Negative Arousal (Sad/Bored)"