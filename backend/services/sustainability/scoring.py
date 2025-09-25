import numpy as np
from typing import Dict, Any, List, Union, Optional
import logging
from enum import Enum

from shared.models.exceptions import ScoringException
from .models import (
    EnvironmentalAssessment, EconomicAssessment, SocialAssessment,
    SUSTAINABILITY_SCENARIOS
)
from .config import settings

logger = logging.getLogger(__name__)


class ScoringCurveType(str, Enum):
    """Different types of scoring curves for different criteria"""
    LINEAR = "linear"           # 0,1,2,3,4,5 -> 0,20,40,60,80,100
    EXPONENTIAL = "exponential" # Accelerating improvements
    LOGARITHMIC = "logarithmic" # Diminishing returns
    SIGMOID = "sigmoid"         # S-curve: slow start, rapid middle, slow end
    INVERTED_U = "inverted_u"   # Peak in middle (like budget optimization)


class DynamicSustainabilityScorer:
    """Dynamic scoring engine that adapts to current criteria configuration"""
    
    def __init__(self):
        # Default scoring configurations - can be made database-configurable later
        self.default_scoring_config = {
            'environmental': {
                'weights': {
                    'ENV_01': 0.25,
                    'ENV_02': 0.20,
                    'ENV_03': 0.20,
                    'ENV_04': 0.20,
                    'ENV_05': 0.15
                },
                'curves': {
                    'ENV_01': ScoringCurveType.SIGMOID,
                    'ENV_02': ScoringCurveType.LINEAR,
                    'ENV_03': ScoringCurveType.LINEAR,
                    'ENV_04': ScoringCurveType.EXPONENTIAL,
                    'ENV_05': ScoringCurveType.LOGARITHMIC
                }
            },
            'economic': {
                'weights': {
                    'ECO_01': 0.20,
                    'ECO_02': 0.30,
                    'ECO_03': 0.25,
                    'ECO_04': 0.25
                },
                'curves': {
                    'ECO_01': ScoringCurveType.INVERTED_U,
                    'ECO_02': ScoringCurveType.LINEAR,
                    'ECO_03': ScoringCurveType.LINEAR,
                    'ECO_04': ScoringCurveType.LINEAR
                }
            },
            'social': {
                'weights': {
                    'SOC_01': 0.40,
                    'SOC_02': 0.35,
                    'SOC_03': 0.25
                },
                'curves': {
                    'SOC_01': ScoringCurveType.LINEAR,
                    'SOC_02': ScoringCurveType.EXPONENTIAL,
                    'SOC_03': ScoringCurveType.LINEAR
                }
            }
        }
    
    def calculate_dimension_score(self, domain: str, assessment_data: Dict[str, Any]) -> float:
        """Calculate score for a specific domain using dynamic criteria"""
        try:
            # Get current criteria configuration for this domain
            if domain not in SUSTAINABILITY_SCENARIOS:
                raise ScoringException(f"Domain {domain} not found in current configuration")
            
            domain_config = SUSTAINABILITY_SCENARIOS[domain]
            criteria = domain_config.get('criteria', {})
            
            if not criteria:
                raise ScoringException(f"No criteria found for domain {domain}")
            
            # Get scoring configuration for this domain
            scoring_config = self.default_scoring_config.get(domain, {})
            weights = scoring_config.get('weights', {})
            curves = scoring_config.get('curves', {})
            
            # Calculate scores for each criterion
            criterion_scores = []
            total_weight = 0
            
            for criterion_key, criterion_value in assessment_data.items():
                if criterion_key not in criteria:
                    logger.warning(f"Criterion {criterion_key} not found in domain {domain} configuration")
                    continue
                
                # Get criterion configuration
                criterion_config = criteria[criterion_key]
                levels = criterion_config.get('levels', [])
                
                if not levels:
                    logger.warning(f"No levels found for criterion {criterion_key}")
                    continue
                
                # Determine the level index (0-based)
                level_index = self._get_level_index(criterion_value, levels)
                max_level = len(levels) - 1
                
                # Apply scoring curve
                curve_type = curves.get(criterion_key, ScoringCurveType.LINEAR)
                raw_score = self._apply_scoring_curve(level_index, max_level, curve_type)
                
                # Apply weight
                weight = weights.get(criterion_key, 1.0 / len(assessment_data))  # Default to equal weight
                weighted_score = raw_score * weight
                
                criterion_scores.append(weighted_score)
                total_weight += weight
                
                logger.debug(f"Criterion {criterion_key}: level={level_index}/{max_level}, "
                           f"raw_score={raw_score:.1f}, weight={weight:.2f}, weighted={weighted_score:.1f}")
            
            if not criterion_scores:
                raise ScoringException(f"No valid criteria scores calculated for domain {domain}")
            
            # Normalize by total weight
            if total_weight > 0:
                final_score = sum(criterion_scores) / total_weight * 100
            else:
                final_score = np.mean(criterion_scores) * 100
            
            return max(0, min(100, final_score))  # Clamp to 0-100
            
        except Exception as e:
            logger.error(f"Error calculating score for domain {domain}: {e}")
            raise ScoringException(f"Failed to calculate score for domain {domain}: {e}")
    
    def _get_level_index(self, criterion_value: Any, levels: List[str]) -> int:
        """Get the index of the current level (0-based)"""
        if hasattr(criterion_value, 'value'):
            # Enum value
            value_str = criterion_value.value
        else:
            value_str = str(criterion_value)
        
        # Try to find matching level by converting enum value to readable format
        for i, level_desc in enumerate(levels):
            # Create comparable strings
            level_normalized = level_desc.lower().replace(' ', '_').replace('-', '_')
            value_normalized = value_str.lower().replace('-', '_')
            
            if level_normalized == value_normalized:
                return i
        
        # Fallback: try direct string matching
        if value_str in levels:
            return levels.index(value_str)
        
        # If no match found, try to extract from enum name patterns
        # This handles cases where enum names don't exactly match level descriptions
        logger.warning(f"Could not find exact match for {value_str} in levels {levels}")
        
        # For now, return middle index as fallback
        return len(levels) // 2
    
    def _apply_scoring_curve(self, level_index: int, max_level: int, curve_type: ScoringCurveType) -> float:
        """Apply different scoring curves based on criterion type"""
        if max_level == 0:
            return 0
        
        # Normalize to 0-1 range
        x = level_index / max_level
        
        if curve_type == ScoringCurveType.LINEAR:
            return x
        
        elif curve_type == ScoringCurveType.EXPONENTIAL:
            # Accelerating improvements: score = x^(1/2) (square root for moderate acceleration)
            return np.power(x, 0.5)
        
        elif curve_type == ScoringCurveType.LOGARITHMIC:
            # Diminishing returns: early improvements matter more
            if x == 0:
                return 0
            return np.log(1 + x * (np.e - 1)) / np.log(np.e)
        
        elif curve_type == ScoringCurveType.SIGMOID:
            # S-curve: slow start, rapid middle, slow end
            # Using logistic function: 1 / (1 + e^(-k*(x-0.5)))
            k = 6  # Steepness parameter
            return 1 / (1 + np.exp(-k * (x - 0.5)))
        
        elif curve_type == ScoringCurveType.INVERTED_U:
            # Peak in middle (for budget optimization)
            # Using inverted parabola: -4*(x-0.5)^2 + 1
            return max(0, 1 - 4 * (x - 0.5) ** 2)
        
        else:
            # Default to linear
            return x
    
    def generate_dynamic_recommendations(self, dimension_scores: Dict[str, float], 
                                       detailed_metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on current criteria and performance"""
        recommendations = []
        
        if not dimension_scores:
            return recommendations
        
        # Overall performance assessment
        avg_score = np.mean(list(dimension_scores.values()))
        min_score = min(dimension_scores.values())
        max_score = max(dimension_scores.values())
        score_spread = max_score - min_score
        
        # Critical issues (any domain below 40)
        critical_domains = [domain for domain, score in dimension_scores.items() if score < 40]
        if critical_domains:
            recommendations.append(
                f"Critical sustainability gaps identified in {', '.join(critical_domains)}. "
                f"Immediate action required to address fundamental deficiencies."
            )
        
        # Moderate issues (any domain below 60)
        moderate_domains = [domain for domain, score in dimension_scores.items() if 40 <= score < 60]
        if moderate_domains:
            recommendations.append(
                f"Significant improvement opportunities in {', '.join(moderate_domains)}. "
                f"Focus on upgrading key capabilities and processes."
            )
        
        # Imbalanced performance
        if score_spread > 30 and len(dimension_scores) > 1:
            weakest = min(dimension_scores.keys(), key=dimension_scores.get)
            strongest = max(dimension_scores.keys(), key=dimension_scores.get)
            recommendations.append(
                f"Performance imbalance detected: {strongest} ({dimension_scores[strongest]:.1f}) "
                f"significantly outperforms {weakest} ({dimension_scores[weakest]:.1f}). "
                f"Consider reallocating resources to strengthen weaker areas."
            )
        
        # Domain-specific recommendations based on detailed metrics
        for domain, metrics in detailed_metrics.items():
            domain_recommendations = self._get_domain_specific_recommendations(
                domain, dimension_scores.get(domain, 0), metrics
            )
            recommendations.extend(domain_recommendations)
        
        # Incomplete assessment
        all_domains = {'environmental', 'economic', 'social'}
        assessed_domains = set(dimension_scores.keys())
        missing_domains = all_domains - assessed_domains
        
        if missing_domains and avg_score > 60:
            recommendations.append(
                f"Strong performance in assessed areas. Consider completing evaluation "
                f"for {', '.join(missing_domains)} to achieve comprehensive sustainability profile."
            )
        elif missing_domains:
            recommendations.append(
                f"Partial assessment completed. Full evaluation including "
                f"{', '.join(missing_domains)} recommended for complete sustainability analysis."
            )
        
        # High performance recognition
        if all(score >= 80 for score in dimension_scores.values()) and len(dimension_scores) >= 2:
            recommendations.append(
                "Excellent sustainability performance across assessed domains. "
                "Focus on continuous improvement and sharing best practices."
            )
        
        return recommendations
    
    def _get_domain_specific_recommendations(self, domain: str, score: float, 
                                           metrics: Dict[str, Any]) -> List[str]:
        """Generate domain-specific recommendations"""
        recommendations = []
        
        if score >= 70:  # Good performance, focus on optimization
            return recommendations
        
        # Analyze which criteria are underperforming
        low_performing_criteria = []
        
        for criterion_key, criterion_data in metrics.items():
            if isinstance(criterion_data, dict) and 'level' in criterion_data:
                # This is simplified - in a real implementation, you'd want to track
                # the actual scores per criterion
                level = criterion_data['level']
                # Heuristic: if level contains basic/simple/no/nothing keywords, it's low performing
                if any(keyword in level.lower() for keyword in ['no', 'nothing', 'basic', 'simple', 'minimal']):
                    low_performing_criteria.append(criterion_key.replace('_', ' ').title())
        
        if low_performing_criteria and domain == 'environmental':
            recommendations.append(
                f"Environmental: Prioritize improvements in {', '.join(low_performing_criteria[:2])}. "
                f"Consider investing in better monitoring systems and expanding measurement scope."
            )
        elif low_performing_criteria and domain == 'economic':
            recommendations.append(
                f"Economic: Address {', '.join(low_performing_criteria[:2])} to improve financial sustainability. "
                f"Focus on demonstrating clear ROI and quantifying benefits."
            )
        elif low_performing_criteria and domain == 'social':
            recommendations.append(
                f"Social: Enhance {', '.join(low_performing_criteria[:2])} through stakeholder engagement. "
                f"Develop comprehensive workforce and community benefit programs."
            )
        
        return recommendations


# Updated main scoring function
def calculate_sustainability_score(
    assessments: Dict[str, Union[EnvironmentalAssessment, EconomicAssessment, SocialAssessment]]
) -> Dict[str, Any]:
    """
    Calculate sustainability scores from selected domain assessments using dynamic criteria
    
    Args:
        assessments: Dictionary containing selected domain assessments
    
    Returns:
        Dictionary containing comprehensive scoring results
    """
    
    try:
        if not assessments:
            raise ScoringException("No assessments provided for scoring")
        
        scorer = DynamicSustainabilityScorer()
        dimension_scores = {}
        detailed_metrics = {}
        
        # Process each provided domain
        for domain_name, assessment in assessments.items():
            try:
                # Convert assessment object to dict for processing
                if hasattr(assessment, 'dict'):
                    assessment_data = assessment.dict()
                elif hasattr(assessment, '__dict__'):
                    assessment_data = assessment.__dict__
                else:
                    assessment_data = dict(assessment)
                
                # Calculate score using dynamic scorer
                score = scorer.calculate_dimension_score(domain_name, assessment_data)
                dimension_scores[domain_name] = round(score, 1)
                
                # Generate detailed metrics (maintains original format)
                detailed_metrics[domain_name] = _get_assessment_details(domain_name, assessment)
                
                logger.debug(f"Domain {domain_name}: score={score:.1f}")
                
            except Exception as e:
                logger.error(f"Error processing domain {domain_name}: {e}")
                raise ScoringException(f"Failed to process domain {domain_name}: {e}")
        
        if not dimension_scores:
            raise ScoringException("No valid domains processed for scoring")
        
        # Calculate weighted overall score based on available domains
        overall_score = _calculate_weighted_overall_score(dimension_scores)
        
        # Generate sustainability metrics using dynamic recommendations
        sustainability_metrics = {
            'selected_domains': list(dimension_scores.keys()),
            'domain_count': len(dimension_scores),
            'dimension_weights': _get_applied_weights(dimension_scores.keys()),
            'detailed_metrics': detailed_metrics,
            'score_distribution': {
                'min': min(dimension_scores.values()) if dimension_scores else 0,
                'max': max(dimension_scores.values()) if dimension_scores else 0,
                'std': round(np.std(list(dimension_scores.values())), 2) if len(dimension_scores) > 1 else 0
            },
            'recommendations': scorer.generate_dynamic_recommendations(dimension_scores, detailed_metrics)
        }
        
        result = {
            'overall_score': round(overall_score, 1),
            'dimension_scores': dimension_scores,
            'sustainability_metrics': sustainability_metrics
        }
        
        logger.info(f"Successfully calculated sustainability scores: overall={overall_score:.1f}, domains={list(dimension_scores.keys())}")
        return result
        
    except ScoringException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in sustainability scoring: {e}")
        raise ScoringException(f"Unexpected error during scoring calculation: {e}")


def _calculate_weighted_overall_score(dimension_scores: Dict[str, float]) -> float:
    """Calculate weighted overall score based on available domains"""
    
    # Base weights from settings (assumes these exist)
    base_weights = {
        'environmental': getattr(settings, 'dimension_weight_environmental', 0.4),
        'economic': getattr(settings, 'dimension_weight_economic', 0.3),
        'social': getattr(settings, 'dimension_weight_social', 0.3)
    }
    
    # Calculate total weight for selected domains
    total_weight = sum(base_weights[domain] for domain in dimension_scores.keys() if domain in base_weights)
    
    if total_weight == 0:
        # Fallback to equal weights if no base weights found
        return np.mean(list(dimension_scores.values()))
    
    # Normalize weights for selected domains
    normalized_weights = {
        domain: base_weights[domain] / total_weight
        for domain in dimension_scores.keys()
        if domain in base_weights
    }
    
    # Calculate weighted score
    weighted_score = sum(
        dimension_scores[domain] * normalized_weights.get(domain, 0)
        for domain in dimension_scores.keys()
    )
    
    return weighted_score


def _get_applied_weights(selected_domains) -> Dict[str, float]:
    """Get the normalized weights applied to selected domains"""
    base_weights = {
        'environmental': getattr(settings, 'dimension_weight_environmental', 0.4),
        'economic': getattr(settings, 'dimension_weight_economic', 0.3),
        'social': getattr(settings, 'dimension_weight_social', 0.3)
    }
    
    total_weight = sum(base_weights[domain] for domain in selected_domains if domain in base_weights)
    
    if total_weight == 0:
        return {domain: 1.0 / len(selected_domains) for domain in selected_domains}
    
    return {
        domain: base_weights[domain] / total_weight
        for domain in selected_domains
        if domain in base_weights
    }


def _get_assessment_details(domain: str, assessment: Any) -> Dict[str, Any]:
    """Get detailed assessment information (maintains original format)"""
    details = {}
    
    if hasattr(assessment, 'dict'):
        assessment_data = assessment.dict()
    elif hasattr(assessment, '__dict__'):
        assessment_data = assessment.__dict__
    else:
        assessment_data = dict(assessment)
    
    for field_name, field_value in assessment_data.items():
        if hasattr(field_value, 'value'):
            # Enum value
            details[field_name] = {
                'level': field_value.value,
                'description': field_value.value.replace('_', ' ').title()
            }
        else:
            details[field_name] = {
                'level': str(field_value),
                'description': str(field_value).replace('_', ' ').title()
            }
    
    return details