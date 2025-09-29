from datetime import datetime
import numpy as np
from typing import Dict, Any, List, Optional, Set, Tuple
import logging

from shared.models.exceptions import ScoringException
from .models import (
    LikertResponse, WorkloadMetrics, CybersicknessResponse, 
    EmotionalResponse, PerformanceMetrics, HumanCentricityDomain,
    FIXED_DOMAINS, DEFAULT_STATEMENTS, PERFORMANCE_CONSTANTS, HumanCentricityInput
)

logger = logging.getLogger(__name__)


class HumanCentricityScorer:
    """Enhanced scoring system with domain selection support and custom statements"""
    
    def __init__(self):
        self.domain_weights = {
            HumanCentricityDomain.CORE_USABILITY: 1.0,
            HumanCentricityDomain.TRUST_TRANSPARENCY: 1.0,
            HumanCentricityDomain.WORKLOAD_COMFORT: 1.0,
            HumanCentricityDomain.CYBERSICKNESS: 1.0,
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
            return self._score_core_usability(input_data.core_usability_responses, input_data.custom_responses)
        
        elif domain == HumanCentricityDomain.TRUST_TRANSPARENCY:
            return self._score_trust_transparency(input_data.trust_transparency_responses, input_data.custom_responses)
        
        elif domain == HumanCentricityDomain.WORKLOAD_COMFORT:
            return self._score_workload_comfort(input_data.workload_metrics, input_data.custom_responses)
        
        elif domain == HumanCentricityDomain.CYBERSICKNESS:
            return self._score_cybersickness(input_data.cybersickness_responses, input_data.custom_responses)
        
        elif domain == HumanCentricityDomain.EMOTIONAL_RESPONSE:
            return self._score_emotional_response(input_data.emotional_response, input_data.custom_responses)
        
        elif domain == HumanCentricityDomain.PERFORMANCE:
            return self._score_performance(input_data.performance_metrics, input_data.custom_responses)
        
        else:
            raise ScoringException(f"Unknown domain: {domain}")
    
    def _score_core_usability(self, responses: Optional[List[LikertResponse]], 
                             custom_responses: Optional[Dict[str, List[Dict[str, Any]]]]) -> Tuple[float, Dict[str, Any]]:
        """Score core usability responses"""
        all_ratings = []
        response_details = {'default_responses': [], 'custom_responses': []}
        
        # Process default responses
        if responses:
            all_ratings.extend([r.rating for r in responses])
            response_details['default_responses'] = [
                {'statement': r.statement, 'rating': r.rating} for r in responses
            ]
        
        # Process custom responses for this domain
        if custom_responses and HumanCentricityDomain.CORE_USABILITY.value in custom_responses:
            custom_domain_responses = custom_responses[HumanCentricityDomain.CORE_USABILITY.value]
            for response in custom_domain_responses:
                if 'rating' in response:
                    all_ratings.append(response['rating'])
                    response_details['custom_responses'].append(response)
        
        if not all_ratings:
            raise ScoringException("Core Usability responses are required but not provided")
        
        # Validate ratings
        if not all(1 <= rating <= 7 for rating in all_ratings):
            raise ScoringException("Invalid Likert ratings - must be between 1 and 7")
        
        mean_rating = np.mean(all_ratings)
        score = (mean_rating - 1) / 6 * 100
        
        expected_count = len(DEFAULT_STATEMENTS.get(HumanCentricityDomain.CORE_USABILITY, []))
        
        return score, {
            'mean_rating': round(mean_rating, 2),
            'score': round(score, 1),
            'response_count': len(all_ratings),
            'expected_default_count': expected_count,
            'rating_distribution': {
                'min': min(all_ratings),
                'max': max(all_ratings),
                'std': round(np.std(all_ratings), 2),
                'ratings': all_ratings
            },
            'response_breakdown': response_details,
            'default_statements': DEFAULT_STATEMENTS.get(HumanCentricityDomain.CORE_USABILITY, [])
        }
    
    def _score_trust_transparency(self, responses: Optional[List[LikertResponse]], 
                                 custom_responses: Optional[Dict[str, List[Dict[str, Any]]]]) -> Tuple[float, Dict[str, Any]]:
        """Score trust and transparency responses"""
        all_ratings = []
        response_details = {'default_responses': [], 'custom_responses': []}
        
        # Process default responses
        if responses:
            all_ratings.extend([r.rating for r in responses])
            response_details['default_responses'] = [
                {'statement': r.statement, 'rating': r.rating} for r in responses
            ]
        
        # Process custom responses for this domain
        if custom_responses and HumanCentricityDomain.TRUST_TRANSPARENCY.value in custom_responses:
            custom_domain_responses = custom_responses[HumanCentricityDomain.TRUST_TRANSPARENCY.value]
            for response in custom_domain_responses:
                if 'rating' in response:
                    all_ratings.append(response['rating'])
                    response_details['custom_responses'].append(response)
        
        if not all_ratings:
            raise ScoringException("Trust & Transparency responses are required but not provided")
        
        # Validate ratings
        if not all(1 <= rating <= 7 for rating in all_ratings):
            raise ScoringException("Invalid Likert ratings - must be between 1 and 7")
        
        mean_rating = np.mean(all_ratings)
        score = (mean_rating - 1) / 6 * 100
        
        expected_count = len(DEFAULT_STATEMENTS.get(HumanCentricityDomain.TRUST_TRANSPARENCY, []))
        
        return score, {
            'mean_rating': round(mean_rating, 2),
            'score': round(score, 1),
            'response_count': len(all_ratings),
            'expected_default_count': expected_count,
            'rating_distribution': {
                'min': min(all_ratings),
                'max': max(all_ratings),
                'std': round(np.std(all_ratings), 2),
                'ratings': all_ratings
            },
            'response_breakdown': response_details,
            'default_statements': DEFAULT_STATEMENTS.get(HumanCentricityDomain.TRUST_TRANSPARENCY, [])
        }
    
    def _score_workload_comfort(self, workload_metrics: Optional[WorkloadMetrics], 
                               custom_responses: Optional[Dict[str, List[Dict[str, Any]]]]) -> Tuple[float, Dict[str, Any]]:
        """Score workload and comfort metrics (now separate from cybersickness)"""
        if not workload_metrics:
            raise ScoringException("Workload metrics are required but not provided")
        
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
        
        # Process any custom responses for this domain
        custom_response_details = []
        if custom_responses and HumanCentricityDomain.WORKLOAD_COMFORT.value in custom_responses:
            custom_domain_responses = custom_responses[HumanCentricityDomain.WORKLOAD_COMFORT.value]
            custom_response_details = custom_domain_responses
        
        return workload_score, {
            'score': round(workload_score, 1),
            'workload': {
                'mental_demand': workload_metrics.mental_demand,
                'effort_required': workload_metrics.effort_required,
                'frustration_level': workload_metrics.frustration_level,
                'mean_workload': round(mean_workload, 2),
                'score': round(workload_score, 1)
            },
            'custom_responses': custom_response_details,
            'default_statements': DEFAULT_STATEMENTS.get(HumanCentricityDomain.WORKLOAD_COMFORT, [])
        }
    
    def _score_cybersickness(self, cybersickness_responses: Optional[List[CybersicknessResponse]], 
                            custom_responses: Optional[Dict[str, List[Dict[str, Any]]]]) -> Tuple[float, Dict[str, Any]]:
        """Score cybersickness responses (now separate domain)"""
        all_severity_ratings = []
        response_details = {'default_responses': [], 'custom_responses': []}
        
        # Process default cybersickness responses
        if cybersickness_responses:
            all_severity_ratings.extend([r.severity for r in cybersickness_responses])
            response_details['default_responses'] = [
                {'symptom': r.symptom, 'severity': r.severity} for r in cybersickness_responses
            ]
        
        # Process custom responses for this domain
        if custom_responses and HumanCentricityDomain.CYBERSICKNESS.value in custom_responses:
            custom_domain_responses = custom_responses[HumanCentricityDomain.CYBERSICKNESS.value]
            for response in custom_domain_responses:
                if 'severity' in response:
                    all_severity_ratings.append(response['severity'])
                    response_details['custom_responses'].append(response)
                elif 'rating' in response:  # Handle Likert-style responses
                    all_severity_ratings.append(response['rating'])
                    response_details['custom_responses'].append(response)
        
        if not all_severity_ratings:
            raise ScoringException("Cybersickness responses are required but not provided")
        
        # Validate ratings
        if not all(1 <= rating <= 5 for rating in all_severity_ratings):
            raise ScoringException("Invalid cybersickness ratings - must be between 1 and 5")
        
        mean_severity = np.mean(all_severity_ratings)
        # Invert score - lower symptoms is better
        normalized_severity = (mean_severity - 1) / (5 - 1)
        score = (1 - normalized_severity) * 100
        
        expected_count = len(DEFAULT_STATEMENTS.get(HumanCentricityDomain.CYBERSICKNESS, []))
        
        return score, {
            'mean_severity': round(mean_severity, 2),
            'score': round(score, 1),
            'response_count': len(all_severity_ratings),
            'expected_default_count': expected_count,
            'severity_distribution': {
                'min': min(all_severity_ratings),
                'max': max(all_severity_ratings),
                'std': round(np.std(all_severity_ratings), 2),
                'ratings': all_severity_ratings
            },
            'response_breakdown': response_details,
            'symptoms': {r.symptom: r.severity for r in cybersickness_responses} if cybersickness_responses else {},
            'default_statements': DEFAULT_STATEMENTS.get(HumanCentricityDomain.CYBERSICKNESS, [])
        }
    
    def _score_emotional_response(self, emotional_response: Optional[EmotionalResponse], 
                                 custom_responses: Optional[Dict[str, List[Dict[str, Any]]]]) -> Tuple[float, Dict[str, Any]]:
        """Score emotional response (SAM)"""
        if not emotional_response:
            raise ScoringException("Emotional response is required but not provided")
        
        if not (1 <= emotional_response.valence <= 5 and 1 <= emotional_response.arousal <= 5):
            raise ScoringException("Invalid emotional response values - must be between 1 and 5")
        
        valence_norm = (emotional_response.valence - 1) / 4
        arousal_norm = (emotional_response.arousal - 1) / 4
        score = (valence_norm + arousal_norm) / 2 * 100
        
        # Process any custom responses for this domain
        custom_response_details = []
        if custom_responses and HumanCentricityDomain.EMOTIONAL_RESPONSE.value in custom_responses:
            custom_domain_responses = custom_responses[HumanCentricityDomain.EMOTIONAL_RESPONSE.value]
            custom_response_details = custom_domain_responses
        
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
            },
            'custom_responses': custom_response_details,
            'default_statements': DEFAULT_STATEMENTS.get(HumanCentricityDomain.EMOTIONAL_RESPONSE, [])
        }
    
    def _score_performance(self, performance_metrics: Optional[PerformanceMetrics], 
                          custom_responses: Optional[Dict[str, List[Dict[str, Any]]]]) -> Tuple[float, Dict[str, Any]]:
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
        
        # Process any custom responses for this domain
        custom_response_details = []
        if custom_responses and HumanCentricityDomain.PERFORMANCE.value in custom_responses:
            custom_domain_responses = custom_responses[HumanCentricityDomain.PERFORMANCE.value]
            custom_response_details = custom_domain_responses
        
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
            },
            'custom_responses': custom_response_details,
            'default_statements': DEFAULT_STATEMENTS.get(HumanCentricityDomain.PERFORMANCE, [])
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
                domain_titles = [FIXED_DOMAINS.get(HumanCentricityDomain(d), {}).get('title', d) for d in weakest_domains if d in [e.value for e in HumanCentricityDomain]]
                recommendations.append(
                    f"Critical attention needed for {', '.join(domain_titles)} "
                    f"(score: {min_score})"
                )
            elif min_score < 70:
                domain_titles = [FIXED_DOMAINS.get(HumanCentricityDomain(d), {}).get('title', d) for d in weakest_domains if d in [e.value for e in HumanCentricityDomain]]
                recommendations.append(
                    f"Improvement recommended for {', '.join(domain_titles)} "
                    f"(score: {min_score})"
                )
            
            # Specific domain recommendations
            for domain_key, score in domain_scores.items():
                if score < 60:
                    domain_title = FIXED_DOMAINS.get(HumanCentricityDomain(domain_key), {}).get('title', domain_key)
                    
                    if domain_key == HumanCentricityDomain.CORE_USABILITY.value:
                        recommendations.append(f"Consider improving system intuitiveness and user interface design")
                    elif domain_key == HumanCentricityDomain.TRUST_TRANSPARENCY.value:
                        recommendations.append(f"Enhance system transparency and explanation capabilities")
                    elif domain_key == HumanCentricityDomain.WORKLOAD_COMFORT.value:
                        recommendations.append(f"Reduce cognitive load and mental workload demands")
                    elif domain_key == HumanCentricityDomain.CYBERSICKNESS.value:
                        recommendations.append(f"Address cybersickness symptoms and physical comfort issues")
                    elif domain_key == HumanCentricityDomain.EMOTIONAL_RESPONSE.value:
                        recommendations.append(f"Focus on improving user emotional experience")
                    elif domain_key == HumanCentricityDomain.PERFORMANCE.value:
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