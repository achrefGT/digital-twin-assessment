import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import logging

from shared.models.exceptions import ScoringException
from .models import DomainAssessment, LikelihoodLevel, ImpactLevel

logger = logging.getLogger(__name__)


class SimplifiedResilienceScoring:
    """Simplified scoring system without confidence and notes"""

    def __init__(self):
        self.likelihood_map = {
            LikelihoodLevel.RARE: 1,
            LikelihoodLevel.UNLIKELY: 2,
            LikelihoodLevel.POSSIBLE: 3,
            LikelihoodLevel.LIKELY: 4,
            LikelihoodLevel.ALMOST_CERTAIN: 5
        }

        self.impact_map = {
            ImpactLevel.NEGLIGIBLE: 1,
            ImpactLevel.MINOR: 2,
            ImpactLevel.MODERATE: 3,
            ImpactLevel.MAJOR: 4,
            ImpactLevel.CATASTROPHIC: 5
        }

    def _calculate_scenario_risk(self, assessment: Any) -> Tuple[float, Dict[str, Any]]:
        """Calculate risk score for a single scenario"""
        try:
            likelihood_num = self.likelihood_map.get(assessment.likelihood)
            impact_num = self.impact_map.get(assessment.impact)

            if likelihood_num is None or impact_num is None:
                raise ScoringException("Invalid likelihood or impact values")

            # Risk score = likelihood * impact
            risk_score = likelihood_num * impact_num

            details = {
                'likelihood': assessment.likelihood.value,
                'impact': assessment.impact.value,
                'likelihood_score': likelihood_num,
                'impact_score': impact_num,
                'risk_score': risk_score
            }

            return risk_score, details

        except Exception as e:
            raise ScoringException(f"Failed to calculate scenario risk: {e}")

    def _calculate_domain_score(self, domain_assessment: DomainAssessment, domain_name: str) -> Dict[str, Any]:
        """Calculate resilience score for a single domain"""
        try:
            domain_risks = []
            scenario_details = {}

            if not hasattr(domain_assessment, 'scenarios') or not domain_assessment.scenarios:
                raise ScoringException(f"Domain {domain_name} has no scenarios")

            for scenario_text, assessment in domain_assessment.scenarios.items():
                try:
                    risk_score, details = self._calculate_scenario_risk(assessment)
                    domain_risks.append(risk_score)
                    scenario_details[scenario_text] = details

                except Exception as e:
                    logger.error(f"Error processing scenario {scenario_text} in domain {domain_name}: {e}")
                    raise ScoringException(f"Failed to process scenario {scenario_text}: {e}")

            if not domain_risks:
                raise ScoringException(f"No valid scenarios found for domain {domain_name}")

            # Calculate domain resilience score
            mean_risk = np.mean(domain_risks)
            max_risk = max(self.likelihood_map.values()) * max(self.impact_map.values())
            min_risk = min(self.likelihood_map.values()) * min(self.impact_map.values())

            # Normalize to 0-100 scale
            if max_risk > min_risk:
                domain_resilience = (1 - (mean_risk - min_risk) / (max_risk - min_risk)) * 100
            else:
                domain_resilience = 100.0  # Edge case where all risks are the same

            return {
                'mean_risk_score': round(mean_risk, 2),
                'resilience_score': round(domain_resilience, 1),
                'scenario_count': len(domain_risks),
                'risk_distribution': {
                    'min': min(domain_risks),
                    'max': max(domain_risks),
                    'std': round(np.std(domain_risks), 2)
                },
                'scenarios': scenario_details
            }

        except ScoringException:
            raise
        except Exception as e:
            raise ScoringException(f"Failed to calculate domain score for {domain_name}: {e}")

    def calculate_resilience_score(self, assessments: Dict[str, DomainAssessment]) -> Dict[str, Any]:
        """Calculate comprehensive resilience scores from assessments"""

        try:
            if not assessments:
                raise ScoringException("No assessments provided for scoring")

            domain_scores = {}
            all_risk_scores = []
            detailed_metrics = {}

            # Process each domain
            for domain_name, domain_assessment in assessments.items():
                try:
                    domain_result = self._calculate_domain_score(domain_assessment, domain_name)

                    base_score = domain_result['resilience_score']
                    domain_scores[domain_name] = base_score
                    detailed_metrics[domain_name] = domain_result

                    # Collect risk scores for overall calculation
                    domain_risks = [
                        details['risk_score']
                        for details in domain_result['scenarios'].values()
                    ]
                    all_risk_scores.extend(domain_risks)

                    logger.debug(f"Domain {domain_name}: score={base_score}")

                except Exception as e:
                    logger.error(f"Error processing domain {domain_name}: {e}")
                    raise ScoringException(f"Failed to process domain {domain_name}: {e}")

            if not all_risk_scores:
                raise ScoringException("No valid risk scores calculated from assessments")

            # Calculate overall resilience score as simple average
            overall_score = np.mean(list(domain_scores.values()))

            # Generate recommendations
            recommendations = self._generate_recommendations(detailed_metrics)

            # Calculate risk metrics
            risk_metrics = self._calculate_risk_metrics(all_risk_scores, detailed_metrics, len(domain_scores))

            result = {
                'overall_score': round(overall_score, 1),
                'domain_scores': domain_scores,
                'risk_metrics': risk_metrics,
                'recommendations': recommendations
            }

            logger.info(f"Successfully calculated resilience scores: overall={overall_score:.1f}, domains={len(domain_scores)}")
            return result

        except ScoringException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in resilience scoring: {e}")
            raise ScoringException(f"Unexpected error during scoring calculation: {e}")

    def _calculate_risk_metrics(self, all_risks: list, detailed_metrics: Dict, domain_count: int) -> Dict[str, Any]:
        """Calculate comprehensive risk metrics"""
        overall_mean_risk = np.mean(all_risks)

        return {
            'overall_mean_risk': round(overall_mean_risk, 2),
            'total_scenarios': len(all_risks),
            'domains_processed': domain_count,
            'risk_distribution': {
                'min': min(all_risks),
                'max': max(all_risks),
                'std': round(np.std(all_risks), 2),
                'percentiles': {
                    '25th': round(np.percentile(all_risks, 25), 2),
                    '50th': round(np.percentile(all_risks, 50), 2),
                    '75th': round(np.percentile(all_risks, 75), 2)
                }
            },
            'detailed_metrics': detailed_metrics
        }

    def _generate_recommendations(self, detailed_metrics: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on assessment results"""
        recommendations = []

        # Find domains with lowest scores
        domain_scores = {
            domain: metrics['resilience_score']
            for domain, metrics in detailed_metrics.items()
        }

        if domain_scores:
            min_score = min(domain_scores.values())
            weakest_domains = [
                domain for domain, score in domain_scores.items()
                if score == min_score
            ]

            if min_score < 50:
                recommendations.append(
                    f"Critical attention needed for {', '.join(weakest_domains)} "
                    f"(score: {min_score})"
                )
            elif min_score < 70:
                recommendations.append(
                    f"Improvement recommended for {', '.join(weakest_domains)} "
                    f"(score: {min_score})"
                )

            # High-risk scenarios
            for domain, metrics in detailed_metrics.items():
                high_risk_scenarios = [
                    scenario for scenario, details in metrics['scenarios'].items()
                    if details['risk_score'] >= 20  # High risk threshold
                ]

                if high_risk_scenarios:
                    recommendations.append(
                        f"High-risk scenarios in {domain}: {', '.join(high_risk_scenarios[:2])}"
                        + ("..." if len(high_risk_scenarios) > 2 else "")
                    )

        return recommendations


def calculate_resilience_score(assessments: Dict[str, DomainAssessment]) -> Dict[str, Any]:
    """
    Main function to calculate resilience scores

    Args:
        assessments: Dictionary of domain assessments

    Returns:
        Dictionary containing comprehensive scoring results
    """
    scorer = SimplifiedResilienceScoring()
    return scorer.calculate_resilience_score(assessments)
