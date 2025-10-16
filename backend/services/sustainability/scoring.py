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
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    LOGARITHMIC = "logarithmic"
    SIGMOID = "sigmoid"
    INVERTED_U = "inverted_u"


class DynamicSustainabilityScorer:
    """Dynamic scoring engine that adapts to current criteria configuration"""
    
    def __init__(self):
        # Only curves, no weights - all criteria are equal
        self.default_scoring_config = {
            'environmental': {
                'curves': {
                    'ENV_01': ScoringCurveType.SIGMOID,
                    'ENV_02': ScoringCurveType.LINEAR,
                    'ENV_03': ScoringCurveType.LINEAR,
                    'ENV_04': ScoringCurveType.EXPONENTIAL,
                    'ENV_05': ScoringCurveType.LOGARITHMIC
                }
            },
            'economic': {
                'curves': {
                    'ECO_01': ScoringCurveType.INVERTED_U,
                    'ECO_02': ScoringCurveType.LINEAR,
                    'ECO_03': ScoringCurveType.LINEAR,
                    'ECO_04': ScoringCurveType.LINEAR
                }
            },
            'social': {
                'curves': {
                    'SOC_01': ScoringCurveType.LINEAR,
                    'SOC_02': ScoringCurveType.EXPONENTIAL,
                    'SOC_03': ScoringCurveType.LINEAR
                }
            }
        }
    
    def calculate_dimension_score(self, domain: str, assessment_data: Dict[str, Any]) -> float:
        """Calculate score for a specific domain using dynamic criteria with detailed debug logs"""
        try:
            if domain not in SUSTAINABILITY_SCENARIOS:
                raise ScoringException(f"Domain {domain} not found in current configuration")
            
            domain_config = SUSTAINABILITY_SCENARIOS[domain]
            criteria = domain_config.get('criteria', {})
            
            if not criteria:
                raise ScoringException(f"No criteria found for domain {domain}")
            
            scoring_config = self.default_scoring_config.get(domain, {})
            curves = scoring_config.get('curves', {})
            
            criterion_scores = []
            
            print(f"\n--- Calculating {domain.upper()} Score ---")
            
            for criterion_key, criterion_value in assessment_data.items():
                if criterion_key not in criteria:
                    logger.warning(f"[SKIP] Criterion {criterion_key} not found in domain {domain} configuration")
                    continue
                
                criterion_config = criteria[criterion_key]
                levels = criterion_config.get('levels', [])
                
                if not levels:
                    logger.warning(f"[SKIP] No levels defined for criterion {criterion_key}")
                    continue
                
                # Get the actual level count for this criterion
                level_count = len(levels)
                level_index = self._get_level_index(criterion_value, levels)
                max_level = level_count - 1
                
                # Ensure level_index is within bounds
                level_index = max(0, min(level_index, max_level))
                
                curve_type = curves.get(criterion_key, ScoringCurveType.LINEAR)
                raw_score = self._apply_scoring_curve(level_index, max_level, curve_type)
                
                # All criteria have equal weight
                criterion_scores.append(raw_score)
                
                # Detailed debug log for this criterion
                print(
                    f"\nCriterion {criterion_key}:\n"
                    f"  - Input Value     : {criterion_value}\n"
                    f"  - Levels          : {levels} (count={level_count})\n"
                    f"  - Selected Index  : {level_index}/{max_level}\n"
                    f"  - Curve           : {curve_type}\n"
                    f"  - Raw Score       : {raw_score:.4f}\n"
                    f"  - Contribution    : {raw_score:.4f} (equal weight)"
                )
            
            if not criterion_scores:
                raise ScoringException(f"No valid criteria scores calculated for domain {domain}")
            
            # Simple average of all criteria scores
            final_score = np.mean(criterion_scores) * 100
            print(
                f"\nFinal Score Equation: mean(criterion_scores) * 100\n"
                f"  = mean({[f'{s:.4f}' for s in criterion_scores]}) * 100\n"
                f"  = {np.mean(criterion_scores):.4f} * 100\n"
                f"  = {final_score:.2f}"
            )
            
            final_score = max(0, min(100, final_score))
            print(f"\n>>> FINAL {domain.upper()} SCORE: {final_score:.2f}\n")
            return final_score
            
        except Exception as e:
            logger.error(f"Error calculating score for domain {domain}: {e}")
            raise ScoringException(f"Failed to calculate score for domain {domain}: {e}")

    
    def _get_level_index(self, criterion_value: Any, levels: List[str]) -> int:
        """Get the index of the current level (0-based) - now supports numeric values directly"""
        if criterion_value is None:
            return 0
        
        # If it's already an integer, use it directly
        if isinstance(criterion_value, int):
            return max(0, min(criterion_value, len(levels) - 1))
        
        # Convert to string for processing
        if hasattr(criterion_value, 'value'):
            value_str = str(criterion_value.value)
        else:
            value_str = str(criterion_value)
        
        # Try to parse as integer first (e.g., "0", "1", "5")
        try:
            level_index = int(value_str)
            return max(0, min(level_index, len(levels) - 1))
        except ValueError:
            pass
        
        # If not numeric, do text matching (for backward compatibility with old enum strings)
        value_normalized = value_str.lower().replace(' ', '_').replace('-', '_')
        
        # Strategy 1: Exact text match
        for i, level_desc in enumerate(levels):
            if value_str == level_desc:
                return i
        
        # Strategy 2: Match key phrase before colon
        for i, level_desc in enumerate(levels):
            key_phrase = level_desc.split(':')[0].strip()
            key_normalized = key_phrase.lower().replace(' ', '_').replace('-', '_')
            
            if key_normalized == value_normalized:
                return i
        
        # Strategy 3: Check if value words are contained in level
        value_words = [w for w in value_normalized.split('_') if len(w) > 2]
        
        if value_words:
            for i, level_desc in enumerate(levels):
                level_normalized = level_desc.lower().replace('-', '_').replace(':', '').replace(',', '')
                level_words = set(level_normalized.split())
                
                matches = sum(1 for vw in value_words if vw in level_words)
                if matches >= len(value_words) * 0.7 and matches >= 2:
                    return i
        
        logger.warning(f"Could not match '{value_str}' to any level. Defaulting to 0. Levels: {levels[:2]}...")
        return 0


    
    def _apply_scoring_curve(self, level_index: int, max_level: int, curve_type: ScoringCurveType) -> float:
        """Apply different scoring curves based on criterion type
        
        Properly handles any number of levels (not just 6)
        """
        if max_level == 0:
            return 1.0  # Single level means full score
        
        # Normalize to 0-1 range based on actual max_level
        x = level_index / max_level
        
        if curve_type == ScoringCurveType.LINEAR:
            return x
        
        elif curve_type == ScoringCurveType.EXPONENTIAL:
            return np.power(x, 0.5)
        
        elif curve_type == ScoringCurveType.LOGARITHMIC:
            if x == 0:
                return 0
            return np.log(1 + x * (np.e - 1)) / np.log(np.e)
        
        elif curve_type == ScoringCurveType.SIGMOID:
            k = 6
            return 1 / (1 + np.exp(-k * (x - 0.5)))
        
        elif curve_type == ScoringCurveType.INVERTED_U:
            return max(0, 1 - 4 * (x - 0.5) ** 2)
        
        else:
            return x
    
    def generate_dynamic_recommendations(self, dimension_scores: Dict[str, float], 
                                       detailed_metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on current criteria and performance"""
        recommendations = []
        
        if not dimension_scores:
            return recommendations
        
        avg_score = np.mean(list(dimension_scores.values()))
        min_score = min(dimension_scores.values())
        max_score = max(dimension_scores.values())
        score_spread = max_score - min_score
        
        critical_domains = [domain for domain, score in dimension_scores.items() if score < 40]
        if critical_domains:
            recommendations.append(
                f"Critical sustainability gaps identified in {', '.join(critical_domains)}. "
                f"Immediate action required to address fundamental deficiencies."
            )
        
        moderate_domains = [domain for domain, score in dimension_scores.items() if 40 <= score < 60]
        if moderate_domains:
            recommendations.append(
                f"Significant improvement opportunities in {', '.join(moderate_domains)}. "
                f"Focus on upgrading key capabilities and processes."
            )
        
        if score_spread > 30 and len(dimension_scores) > 1:
            weakest = min(dimension_scores.keys(), key=dimension_scores.get)
            strongest = max(dimension_scores.keys(), key=dimension_scores.get)
            recommendations.append(
                f"Performance imbalance detected: {strongest} ({dimension_scores[strongest]:.1f}) "
                f"significantly outperforms {weakest} ({dimension_scores[weakest]:.1f}). "
                f"Consider reallocating resources to strengthen weaker areas."
            )
        
        for domain, metrics in detailed_metrics.items():
            domain_recommendations = self._get_domain_specific_recommendations(
                domain, dimension_scores.get(domain, 0), metrics
            )
            recommendations.extend(domain_recommendations)
        
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
        
        if all(score >= 80 for score in dimension_scores.values()) and len(dimension_scores) >= 2:
            recommendations.append(
                "Excellent sustainability performance across assessed domains. "
                "Focus on continuous improvement and sharing best practices."
            )
        
        return recommendations
    
    def _get_domain_specific_recommendations(self, domain: str, score: float, 
                                           metrics: Dict[str, Any]) -> List[str]:
        """Generate domain-specific recommendations based on actual criterion performance"""
        recommendations = []
        
        if score >= 70:
            return recommendations
        
        # Analyze each criterion's performance
        low_performing_criteria = []
        
        for criterion_key, criterion_data in metrics.items():
            if not isinstance(criterion_data, dict):
                continue
                
            # Get level index and max level for this criterion
            level_index = criterion_data.get('level_index', 0)
            max_level = criterion_data.get('max_level', 5)
            criterion_name = criterion_data.get('criterion_name', criterion_key)
            
            # Consider criterion low-performing if it's in bottom 40% of range
            if level_index < max_level * 0.4:
                low_performing_criteria.append({
                    'key': criterion_key,
                    'name': criterion_name,
                    'level_index': level_index,
                    'max_level': max_level,
                    'description': criterion_data.get('level_description', '')
                })
        
        if not low_performing_criteria:
            return recommendations
        
        # Sort by relative performance (worst first)
        low_performing_criteria.sort(key=lambda x: x['level_index'] / max(x['max_level'], 1))
        
        # Domain-specific recommendations
        if domain == 'environmental':
            top_issues = low_performing_criteria[:2]
            issue_names = [c['name'] for c in top_issues]
            recommendations.append(
                f"Environmental: Prioritize improvements in {' and '.join(issue_names)}. "
                f"Consider investing in better monitoring systems and expanding measurement scope."
            )
        elif domain == 'economic':
            top_issues = low_performing_criteria[:2]
            issue_names = [c['name'] for c in top_issues]
            recommendations.append(
                f"Economic: Address {' and '.join(issue_names)} to improve financial sustainability. "
                f"Focus on demonstrating clear ROI and quantifying benefits."
            )
        elif domain == 'social':
            top_issues = low_performing_criteria[:2]
            issue_names = [c['name'] for c in top_issues]
            recommendations.append(
                f"Social: Enhance {' and '.join(issue_names)} through stakeholder engagement. "
                f"Develop comprehensive workforce and community benefit programs."
            )
        
        return recommendations


def calculate_sustainability_score(
    assessments: Dict[str, Union[EnvironmentalAssessment, EconomicAssessment, SocialAssessment]]
) -> Dict[str, Any]:
    """Calculate sustainability scores from selected domain assessments using dynamic criteria"""
    
    try:
        if not assessments:
            raise ScoringException("No assessments provided for scoring")
        
        scorer = DynamicSustainabilityScorer()
        dimension_scores = {}
        detailed_metrics = {}
        
        for domain_name, assessment in assessments.items():
            try:
                if hasattr(assessment, 'dict'):
                    assessment_data = assessment.dict()
                elif hasattr(assessment, '__dict__'):
                    assessment_data = assessment.__dict__
                else:
                    assessment_data = dict(assessment)
                
                score = scorer.calculate_dimension_score(domain_name, assessment_data)
                dimension_scores[domain_name] = round(score, 1)
                
                # Get detailed metrics with actual level descriptions
                detailed_metrics[domain_name] = _get_assessment_details(domain_name, assessment)
                
                print(f"Domain {domain_name}: score={score:.1f}")
                
            except Exception as e:
                logger.error(f"Error processing domain {domain_name}: {e}")
                raise ScoringException(f"Failed to process domain {domain_name}: {e}")
        
        if not dimension_scores:
            raise ScoringException("No valid domains processed for scoring")
        
        overall_score = _calculate_weighted_overall_score(dimension_scores)
        
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
    
    base_weights = {
        'environmental': getattr(settings, 'dimension_weight_environmental', 0.4),
        'economic': getattr(settings, 'dimension_weight_economic', 0.3),
        'social': getattr(settings, 'dimension_weight_social', 0.3)
    }
    
    total_weight = sum(base_weights[domain] for domain in dimension_scores.keys() if domain in base_weights)
    
    if total_weight == 0:
        return np.mean(list(dimension_scores.values()))
    
    normalized_weights = {
        domain: base_weights[domain] / total_weight
        for domain in dimension_scores.keys()
        if domain in base_weights
    }
    
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
    """Get detailed assessment information with actual level descriptions from current configuration"""
    details = {}
    
    # Get current domain configuration
    domain_config = SUSTAINABILITY_SCENARIOS.get(domain, {})
    criteria_config = domain_config.get('criteria', {})
    
    # Extract assessment data
    if hasattr(assessment, 'dict'):
        assessment_data = assessment.dict(exclude_none=True)
    elif hasattr(assessment, '__dict__'):
        assessment_data = assessment.__dict__
    else:
        assessment_data = dict(assessment)
    
    # Process each criterion in the assessment
    for criterion_key, criterion_value in assessment_data.items():
        # Skip if criterion not in current configuration (may have been deleted)
        if criterion_key not in criteria_config:
            logger.warning(f"Criterion {criterion_key} not found in current {domain} configuration")
            continue
        
        criterion_info = criteria_config[criterion_key]
        levels = criterion_info.get('levels', [])
        criterion_name = criterion_info.get('name', criterion_key)
        
        if not levels:
            logger.warning(f"No levels defined for criterion {criterion_key}")
            continue
        
        # Parse the level index from criterion_value
        if isinstance(criterion_value, int):
            level_index = criterion_value
        else:
            # Try to parse as integer
            try:
                level_index = int(str(criterion_value))
            except (ValueError, TypeError):
                logger.warning(f"Could not parse level index from value: {criterion_value}")
                level_index = 0
        
        # Ensure level_index is within bounds
        level_index = max(0, min(level_index, len(levels) - 1))
        max_level = len(levels) - 1
        
        # Get the actual level description
        level_description = levels[level_index] if level_index < len(levels) else "Unknown"
        
        # Create detailed metrics entry
        details[criterion_key] = {
            'criterion_name': criterion_name,
            'level_index': level_index,
            'max_level': max_level,
            'level_description': level_description,
            'level_label': f"Level {level_index}/{max_level}",
            'is_custom': not criterion_info.get('is_default', True)  # Track if this is a custom criterion
        }
    
    return details