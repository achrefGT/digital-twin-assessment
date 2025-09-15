from datetime import datetime
import numpy as np
from typing import Dict, Any, List, Optional, Set, Tuple
import logging

from shared.models.exceptions import ScoringException
from .models import (
    LikertResponse, WorkloadMetrics, CybersicknessResponse, 
    EmotionalResponse, PerformanceMetrics, HumanCentricityDomain,
    ASSESSMENT_DOMAINS, PERFORMANCE_CONSTANTS, HumanCentricityInput
)

logger = logging.getLogger(__name__)


class HumanCentricityScorer:
    """Enhanced scoring system with domain selection support"""
    
    def __init__(self):
        self.domain_weights = {
            HumanCentricityDomain.CORE_USABILITY: 1.0,
            HumanCentricityDomain.TRUST_TRANSPARENCY: 1.0,
            HumanCentricityDomain.WORKLOAD_COMFORT: 1.0,
            HumanCentricityDomain.EMOTIONAL_RESPONSE: 1.0,
            HumanCentricityDomain.PERFORMANCE: 1.0
        }
    
    def calculate_human_centricity_score(self, input_data: HumanCentricityInput) -> Dict[str, Any]:
        """Calculate human-centricity scores based on selected domains"""
        
        try:
            if not input_data.selected_domains:
                raise ScoringException("No domains selected for assessment")
            
            domain_scores = {}
            detailed_metrics = {}
            
            # Process each selected domain
            for domain in input_data.selected_domains:
                try:
                    score, metrics = self._calculate_domain_score(domain, input_data)
                    domain_scores[domain.value] = score
                    detailed_metrics[domain.value] = metrics
                    
                    logger.debug(f"Domain {domain.value}: score={score}")
                    
                except Exception as e:
                    logger.error(f"Error processing domain {domain.value}: {e}")
                    raise ScoringException(f"Failed to process domain {domain.value}: {e}")
            
            if not domain_scores:
                raise ScoringException("No valid domain scores calculated")
            
            # Calculate weighted overall score
            overall_score = self._calculate_weighted_overall_score(domain_scores)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(domain_scores, detailed_metrics)
            
            result = {
                'overall_score': round(overall_score, 1),
                'domain_scores': domain_scores,
                'detailed_metrics': {
                    **detailed_metrics,
                    'scoring_metadata': {
                        'selected_domains': [d.value for d in input_data.selected_domains],
                        'total_domains': len(input_data.selected_domains),
                        'processing_timestamp': datetime.utcnow(),
                        'validation_passed': True,
                        'scoring_mode': 'domain_selective',
                        'recommendations': recommendations
                    }
                }
            }
            
            logger.info(f"Successfully calculated human centricity scores: overall={overall_score:.1f}, domains={len(domain_scores)}")
            return result
            
        except ScoringException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in human centricity scoring: {e}")
            raise ScoringException(f"Unexpected error during scoring calculation: {e}")
    
    def _calculate_domain_score(self, domain: HumanCentricityDomain, input_data: HumanCentricityInput) -> Tuple[float, Dict[str, Any]]:
        """Calculate score for a specific domain"""
        
        if domain == HumanCentricityDomain.CORE_USABILITY:
            return self._score_core_usability(input_data.core_usability_responses)
        
        elif domain == HumanCentricityDomain.TRUST_TRANSPARENCY:
            return self._score_trust_transparency(input_data.trust_transparency_responses)
        
        elif domain == HumanCentricityDomain.WORKLOAD_COMFORT:
            return self._score_workload_comfort(input_data.workload_metrics, input_data.cybersickness_responses)
        
        elif domain == HumanCentricityDomain.EMOTIONAL_RESPONSE:
            return self._score_emotional_response(input_data.emotional_response)
        
        elif domain == HumanCentricityDomain.PERFORMANCE:
            return self._score_performance(input_data.performance_metrics)
        
        else:
            raise ScoringException(f"Unknown domain: {domain}")
    
    def _score_core_usability(self, responses: Optional[List[LikertResponse]]) -> Tuple[float, Dict[str, Any]]:
        """Score core usability responses"""
        if not responses:
            raise ScoringException("Core Usability responses are required but not provided")
        
        expected_count = len(ASSESSMENT_DOMAINS['Core_Usability']['statements'])
        if len(responses) != expected_count:
            logger.warning(f"Expected {expected_count} Core Usability responses, got {len(responses)}")
        
        ratings = [r.rating for r in responses]
        if not all(1 <= rating <= 7 for rating in ratings):
            raise ScoringException("Invalid Likert ratings - must be between 1 and 7")
        
        mean_rating = np.mean(ratings)
        score = (mean_rating - 1) / 6 * 100
        
        return score, {
            'mean_rating': round(mean_rating, 2),
            'score': round(score, 1),
            'response_count': len(ratings),
            'rating_distribution': {
                'min': min(ratings),
                'max': max(ratings),
                'std': round(np.std(ratings), 2),
                'ratings': ratings
            },
            'statements': ASSESSMENT_DOMAINS['Core_Usability']['statements']
        }
    
    def _score_trust_transparency(self, responses: Optional[List[LikertResponse]]) -> Tuple[float, Dict[str, Any]]:
        """Score trust and transparency responses"""
        if not responses:
            raise ScoringException("Trust & Transparency responses are required but not provided")
        
        expected_count = len(ASSESSMENT_DOMAINS['Trust_Transparency']['statements'])
        if len(responses) != expected_count:
            logger.warning(f"Expected {expected_count} Trust & Transparency responses, got {len(responses)}")
        
        ratings = [r.rating for r in responses]
        if not all(1 <= rating <= 7 for rating in ratings):
            raise ScoringException("Invalid Likert ratings - must be between 1 and 7")
        
        mean_rating = np.mean(ratings)
        score = (mean_rating - 1) / 6 * 100
        
        return score, {
            'mean_rating': round(mean_rating, 2),
            'score': round(score, 1),
            'response_count': len(ratings),
            'rating_distribution': {
                'min': min(ratings),
                'max': max(ratings),
                'std': round(np.std(ratings), 2),
                'ratings': ratings
            },
            'statements': ASSESSMENT_DOMAINS['Trust_Transparency']['statements']
        }
    
    def _score_workload_comfort(self, workload_metrics: Optional[WorkloadMetrics], 
                               cybersickness_responses: Optional[List[CybersicknessResponse]]) -> Tuple[float, Dict[str, Any]]:
        """Score workload and comfort (cybersickness) metrics"""
        if not workload_metrics or not cybersickness_responses:
            raise ScoringException("Both workload metrics and cybersickness responses are required")
        
        # Score workload (inverted - lower workload is better)
        workload_values = [
            workload_metrics.mental_demand,
            workload_metrics.effort_required,
            workload_metrics.frustration_level
        ]
        if not all(0 <= val <= 100 for val in workload_values):
            raise ScoringException("Invalid workload values - must be between 0 and 100")
        
        mean_workload = np.mean(workload_values)
        workload_score = 100 - mean_workload
        
        # Score cybersickness (inverted - lower symptoms is better)
        expected_symptoms = len(ASSESSMENT_DOMAINS['Workload_Comfort']['components']['cybersickness']['symptoms'])
        if len(cybersickness_responses) != expected_symptoms:
            logger.warning(f"Expected {expected_symptoms} cybersickness responses, got {len(cybersickness_responses)}")
        
        cybersickness_ratings = [r.severity for r in cybersickness_responses]
        if not all(1 <= rating <= 5 for rating in cybersickness_ratings):
            raise ScoringException("Invalid cybersickness ratings - must be between 1 and 5")
        
        mean_cybersickness = np.mean(cybersickness_ratings)
        normalized_cybersickness = (mean_cybersickness - 1) / (5 - 1)
        cybersickness_score = (1 - normalized_cybersickness) * 100
        
        # Combined score (equal weighting)
        combined_score = (workload_score + cybersickness_score) / 2
        
        return combined_score, {
            'combined_score': round(combined_score, 1),
            'workload': {
                'mental_demand': workload_metrics.mental_demand,
                'effort_required': workload_metrics.effort_required,
                'frustration_level': workload_metrics.frustration_level,
                'mean_workload': round(mean_workload, 2),
                'score': round(workload_score, 1)
            },
            'cybersickness': {
                'mean_severity': round(mean_cybersickness, 2),
                'score': round(cybersickness_score, 1),
                'symptoms': {r.symptom: r.severity for r in cybersickness_responses},
                'severity_distribution': {
                    'min': min(cybersickness_ratings),
                    'max': max(cybersickness_ratings),
                    'std': round(np.std(cybersickness_ratings), 2)
                }
            }
        }
    
    def _score_emotional_response(self, emotional_response: Optional[EmotionalResponse]) -> Tuple[float, Dict[str, Any]]:
        """Score emotional response (SAM)"""
        if not emotional_response:
            raise ScoringException("Emotional response is required but not provided")
        
        if not (1 <= emotional_response.valence <= 5 and 1 <= emotional_response.arousal <= 5):
            raise ScoringException("Invalid emotional response values - must be between 1 and 5")
        
        valence_norm = (emotional_response.valence - 1) / 4
        arousal_norm = (emotional_response.arousal - 1) / 4
        score = (valence_norm + arousal_norm) / 2 * 100
        
        return score, {
            'valence': emotional_response.valence,
            'arousal': emotional_response.arousal,
            'valence_normalized': round(valence_norm, 2),
            'arousal_normalized': round(arousal_norm, 2),
            'score': round(score, 1),
            'interpretation': {
                'valence_label': self._get_valence_label(emotional_response.valence),
                'arousal_label': self._get_arousal_label(emotional_response.arousal),
                'quadrant': self._get_emotion_quadrant(valence_norm, arousal_norm)
            }
        }
    
    def _score_performance(self, performance_metrics: Optional[PerformanceMetrics]) -> Tuple[float, Dict[str, Any]]:
        """Score performance metrics"""
        if not performance_metrics:
            raise ScoringException("Performance metrics are required but not provided")
        
        if (performance_metrics.task_completion_time_min < 0 or 
            performance_metrics.error_rate < 0 or 
            performance_metrics.help_requests < 0):
            raise ScoringException("Performance metrics cannot be negative")
        
        max_time = PERFORMANCE_CONSTANTS['MAX_TIME']
        max_errors = PERFORMANCE_CONSTANTS['MAX_ERRORS']
        max_help = PERFORMANCE_CONSTANTS['MAX_HELP']
        
        time_capped = min(performance_metrics.task_completion_time_min, max_time)
        score_time = (max_time - time_capped) / max_time * 100
        
        errors_capped = min(performance_metrics.error_rate, max_errors)
        score_errors = (max_errors - errors_capped) / max_errors * 100
        
        help_capped = min(performance_metrics.help_requests, max_help)
        score_help = (max_help - help_capped) / max_help * 100
        
        score = np.mean([score_time, score_errors, score_help])
        
        return score, {
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
            'combined_score': round(score, 1),
            'performance_limits': {
                'max_time': max_time,
                'max_errors': max_errors,
                'max_help': max_help
            }
        }
    
    def _calculate_weighted_overall_score(self, domain_scores: Dict[str, float]) -> float:
        """Calculate weighted overall score from domain scores"""
        total_weight = 0
        weighted_sum = 0
        
        for domain_key, score in domain_scores.items():
            try:
                domain_enum = HumanCentricityDomain(domain_key)
                weight = self.domain_weights.get(domain_enum, 1.0)
                weighted_sum += score * weight
                total_weight += weight
            except ValueError:
                # Handle any legacy domain keys
                weight = 1.0
                weighted_sum += score * weight
                total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else 0
    
    def _generate_recommendations(self, domain_scores: Dict[str, float], detailed_metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on domain scores"""
        recommendations = []
        
        # Find lowest scoring domains
        if domain_scores:
            min_score = min(domain_scores.values())
            weakest_domains = [
                domain for domain, score in domain_scores.items()
                if score == min_score
            ]
            
            if min_score < 50:
                domain_titles = [ASSESSMENT_DOMAINS.get(d, {}).get('title', d) for d in weakest_domains]
                recommendations.append(
                    f"Critical attention needed for {', '.join(domain_titles)} "
                    f"(score: {min_score})"
                )
            elif min_score < 70:
                domain_titles = [ASSESSMENT_DOMAINS.get(d, {}).get('title', d) for d in weakest_domains]
                recommendations.append(
                    f"Improvement recommended for {', '.join(domain_titles)} "
                    f"(score: {min_score})"
                )
            
            # Specific domain recommendations
            for domain_key, score in domain_scores.items():
                if score < 60:
                    domain_title = ASSESSMENT_DOMAINS.get(domain_key, {}).get('title', domain_key)
                    
                    if domain_key == 'Core_Usability':
                        recommendations.append(f"Consider improving system intuitiveness and user interface design")
                    elif domain_key == 'Trust_Transparency':
                        recommendations.append(f"Enhance system transparency and explanation capabilities")
                    elif domain_key == 'Workload_Comfort':
                        recommendations.append(f"Reduce cognitive load and address comfort issues")
                    elif domain_key == 'Emotional_Response':
                        recommendations.append(f"Focus on improving user emotional experience")
                    elif domain_key == 'Performance':
                        recommendations.append(f"Optimize system performance and reduce user errors")
        
        return recommendations
    
    # Helper methods for emotional response interpretation
    def _get_valence_label(self, valence: int) -> str:
        """Get human-readable label for valence value"""
        labels = {
            1: "Very Negative",
            2: "Negative", 
            3: "Neutral",
            4: "Positive",
            5: "Very Positive"
        }
        return labels.get(valence, "Unknown")

    def _get_arousal_label(self, arousal: int) -> str:
        """Get human-readable label for arousal value"""
        labels = {
            1: "Very Calm",
            2: "Calm",
            3: "Neutral", 
            4: "Excited",
            5: "Very Excited"
        }
        return labels.get(arousal, "Unknown")

    def _get_emotion_quadrant(self, valence_norm: float, arousal_norm: float) -> str:
        """Determine emotional quadrant based on normalized valence and arousal"""
        if valence_norm >= 0.5 and arousal_norm >= 0.5:
            return "High Positive Arousal (Excited/Happy)"
        elif valence_norm >= 0.5 and arousal_norm < 0.5:
            return "Low Positive Arousal (Calm/Content)"
        elif valence_norm < 0.5 and arousal_norm >= 0.5:
            return "High Negative Arousal (Stressed/Anxious)"
        else:
            return "Low Negative Arousal (Sad/Bored)"


def calculate_human_centricity_score_with_domains(input_data: HumanCentricityInput) -> Dict[str, Any]:
    """
    Main function to calculate human centricity scores with domain selection
    
    Args:
        input_data: HumanCentricityInput with selected domains and corresponding data
    
    Returns:
        Dictionary containing comprehensive scoring results
    """
    scorer = HumanCentricityScorer()
    return scorer.calculate_human_centricity_score(input_data)