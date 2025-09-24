import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import logging

from shared.models.exceptions import ScoringException
from .models import DomainAssessment, LikelihoodLevel, ImpactLevel, RESILIENCE_SCENARIOS

logger = logging.getLogger(__name__)


class DynamicResilienceScoring:
    """Enhanced scoring system that works with dynamic scenarios"""

    def __init__(self, scenario_manager=None):
        self.scenario_manager = scenario_manager
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

    def _get_current_scenarios_config(self) -> Dict[str, Any]:
        """Get current scenarios configuration"""
        try:
            if self.scenario_manager:
                return self.scenario_manager.get_current_scenarios_config()
            else:
                # Fallback to in-memory configuration
                return {
                    'scenarios': {
                        domain: data['scenarios'] 
                        for domain, data in RESILIENCE_SCENARIOS.items()
                    },
                    'domain_descriptions': {
                        domain: data.get('description', '') 
                        for domain, data in RESILIENCE_SCENARIOS.items()
                    }
                }
        except Exception as e:
            logger.error(f"Failed to get scenarios configuration: {e}")
            # Fallback to static configuration
            return {
                'scenarios': {
                    domain: data['scenarios'] 
                    for domain, data in RESILIENCE_SCENARIOS.items()
                },
                'domain_descriptions': {
                    domain: data.get('description', '') 
                    for domain, data in RESILIENCE_SCENARIOS.items()
                }
            }

    def _validate_assessment_scenarios(self, assessments: Dict[str, DomainAssessment]) -> Dict[str, List[str]]:
        """Validate that all scenarios in assessments exist in current configuration"""
        try:
            config = self._get_current_scenarios_config()
            missing_scenarios = {}
            
            for domain_name, domain_assessment in assessments.items():
                if domain_name not in config['scenarios']:
                    missing_scenarios[domain_name] = [f"Domain {domain_name} not found in configuration"]
                    continue
                
                current_domain_scenarios = config['scenarios'][domain_name]
                missing_for_domain = []
                
                for scenario_text in domain_assessment.scenarios.keys():
                    if scenario_text not in current_domain_scenarios:
                        missing_for_domain.append(scenario_text)
                
                if missing_for_domain:
                    missing_scenarios[domain_name] = missing_for_domain
            
            return missing_scenarios
        except Exception as e:
            logger.error(f"Error validating scenarios: {e}")
            return {"validation_error": [str(e)]}

    def _calculate_scenario_risk(self, assessment: Any, scenario_text: str = None) -> Tuple[float, Dict[str, Any]]:
        """Calculate risk score for a single scenario"""
        try:
            likelihood_num = self.likelihood_map.get(assessment.likelihood)
            impact_num = self.impact_map.get(assessment.impact)

            if likelihood_num is None or impact_num is None:
                raise ScoringException("Invalid likelihood or impact values")

            # Risk score = likelihood * impact
            risk_score = likelihood_num * impact_num

            details = {
                'scenario_text': scenario_text,
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
                    risk_score, details = self._calculate_scenario_risk(assessment, scenario_text)
                    domain_risks.append(risk_score)
                    scenario_details[scenario_text] = details

                except Exception as e:
                    logger.error(f"Error processing scenario '{scenario_text}' in domain {domain_name}: {e}")
                    # Continue processing other scenarios instead of failing completely
                    continue

            if not domain_risks:
                raise ScoringException(f"No valid scenarios found for domain {domain_name}")

            # Calculate domain resilience score
            mean_risk = np.mean(domain_risks)
            max_risk = max(self.likelihood_map.values()) * max(self.impact_map.values())
            min_risk = min(self.likelihood_map.values()) * min(self.impact_map.values())

            # Normalize to 0-100 scale (higher score = more resilient = lower risk)
            if max_risk > min_risk:
                domain_resilience = (1 - (mean_risk - min_risk) / (max_risk - min_risk)) * 100
            else:
                domain_resilience = 100.0  # Edge case where all risks are the same

            # Additional metrics
            risk_variance = np.var(domain_risks)
            risk_consistency_score = max(0, 100 - (risk_variance * 10))  # Lower variance = more consistent

            return {
                'mean_risk_score': round(mean_risk, 2),
                'resilience_score': round(domain_resilience, 1),
                'consistency_score': round(risk_consistency_score, 1),
                'scenario_count': len(domain_risks),
                'processed_scenarios': len(scenario_details),
                'risk_distribution': {
                    'min': min(domain_risks),
                    'max': max(domain_risks),
                    'std': round(np.std(domain_risks), 2),
                    'variance': round(risk_variance, 2)
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

            # Validate scenarios first
            missing_scenarios = self._validate_assessment_scenarios(assessments)
            validation_warnings = []
            
            if missing_scenarios:
                for domain, missing in missing_scenarios.items():
                    validation_warnings.extend([
                        f"Domain '{domain}': Missing scenarios - {', '.join(missing[:3])}"
                        + ("..." if len(missing) > 3 else "")
                    ])
                logger.warning(f"Assessment contains scenarios not in current configuration: {missing_scenarios}")

            domain_scores = {}
            all_risk_scores = []
            detailed_metrics = {}
            processing_summary = {
                'domains_processed': 0,
                'total_scenarios': 0,
                'successful_scenarios': 0,
                'failed_scenarios': 0,
                'validation_warnings': validation_warnings
            }

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

                    # Update processing summary
                    processing_summary['domains_processed'] += 1
                    processing_summary['total_scenarios'] += domain_result['scenario_count']
                    processing_summary['successful_scenarios'] += domain_result['processed_scenarios']
                    processing_summary['failed_scenarios'] += (
                        domain_result['scenario_count'] - domain_result['processed_scenarios']
                    )

                    logger.debug(f"Domain {domain_name}: score={base_score}, scenarios={domain_result['scenario_count']}")

                except Exception as e:
                    logger.error(f"Error processing domain {domain_name}: {e}")
                    # Continue processing other domains
                    processing_summary['failed_scenarios'] += len(domain_assessment.scenarios) if hasattr(domain_assessment, 'scenarios') else 0
                    continue

            if not all_risk_scores:
                raise ScoringException("No valid risk scores calculated from assessments")

            # Calculate overall resilience score
            if len(domain_scores) > 0:
                # Weighted average by number of scenarios per domain
                weighted_scores = []
                weights = []
                
                for domain_name, score in domain_scores.items():
                    scenario_count = detailed_metrics[domain_name]['scenario_count']
                    weighted_scores.append(score * scenario_count)
                    weights.append(scenario_count)
                
                overall_score = sum(weighted_scores) / sum(weights) if sum(weights) > 0 else 0
            else:
                overall_score = 0

            # Generate recommendations
            recommendations = self._generate_enhanced_recommendations(detailed_metrics, processing_summary)

            # Calculate risk metrics
            risk_metrics = self._calculate_comprehensive_risk_metrics(
                all_risk_scores, detailed_metrics, len(domain_scores), processing_summary
            )

            result = {
                'overall_score': round(overall_score, 1),
                'domain_scores': domain_scores,
                'risk_metrics': risk_metrics,
                'recommendations': recommendations,
                'processing_summary': processing_summary,
                'scenario_compatibility': {
                    'missing_scenarios': missing_scenarios,
                    'has_compatibility_issues': len(missing_scenarios) > 0
                }
            }

            logger.info(
                f"Successfully calculated resilience scores: "
                f"overall={overall_score:.1f}, domains={len(domain_scores)}, "
                f"scenarios={processing_summary['successful_scenarios']}"
            )
            return result

        except ScoringException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in resilience scoring: {e}")
            raise ScoringException(f"Unexpected error during scoring calculation: {e}")

    def _calculate_comprehensive_risk_metrics(self, all_risks: list, detailed_metrics: Dict, 
                                           domain_count: int, processing_summary: Dict) -> Dict[str, Any]:
        """Calculate comprehensive risk metrics with processing information"""
        if not all_risks:
            return {
                'error': 'No risk data available',
                'processing_summary': processing_summary
            }
            
        overall_mean_risk = np.mean(all_risks)

        # Calculate risk level distribution
        risk_levels = {
            'low': sum(1 for r in all_risks if r <= 6),      # 1-6
            'medium': sum(1 for r in all_risks if 7 <= r <= 15), # 7-15
            'high': sum(1 for r in all_risks if 16 <= r <= 20),  # 16-20
            'critical': sum(1 for r in all_risks if r > 20)      # 21-25
        }

        return {
            'overall_mean_risk': round(overall_mean_risk, 2),
            'total_scenarios_analyzed': len(all_risks),
            'domains_processed': domain_count,
            'risk_distribution': {
                'min': min(all_risks),
                'max': max(all_risks),
                'std': round(np.std(all_risks), 2),
                'percentiles': {
                    '25th': round(np.percentile(all_risks, 25), 2),
                    '50th': round(np.percentile(all_risks, 50), 2),
                    '75th': round(np.percentile(all_risks, 75), 2),
                    '90th': round(np.percentile(all_risks, 90), 2)
                }
            },
            'risk_levels': risk_levels,
            'detailed_metrics': detailed_metrics,
            'processing_summary': processing_summary
        }

    def _generate_enhanced_recommendations(self, detailed_metrics: Dict[str, Any], 
                                         processing_summary: Dict) -> List[str]:
        """Generate enhanced recommendations based on assessment results"""
        recommendations = []

        # Processing issues
        if processing_summary['failed_scenarios'] > 0:
            recommendations.append(
                f"⚠️  {processing_summary['failed_scenarios']} scenarios failed processing - "
                "review assessment data quality"
            )

        if processing_summary['validation_warnings']:
            recommendations.append(
                "🔍 Assessment contains scenarios not in current configuration - "
                "consider updating scenario definitions"
            )

        # Domain-based recommendations
        if detailed_metrics:
            domain_scores = {
                domain: metrics['resilience_score']
                for domain, metrics in detailed_metrics.items()
            }

            if domain_scores:
                min_score = min(domain_scores.values())
                max_score = max(domain_scores.values())
                
                # Critical domains
                critical_domains = [
                    domain for domain, score in domain_scores.items()
                    if score < 40
                ]
                
                if critical_domains:
                    recommendations.append(
                        f"🚨 Critical resilience gaps in: {', '.join(critical_domains)}"
                    )

                # Improvement opportunities
                low_domains = [
                    domain for domain, score in domain_scores.items()
                    if 40 <= score < 70
                ]
                
                if low_domains:
                    recommendations.append(
                        f"📈 Improvement opportunities in: {', '.join(low_domains)}"
                    )

                # Consistency issues
                inconsistent_domains = [
                    domain for domain, metrics in detailed_metrics.items()
                    if metrics.get('consistency_score', 100) < 50
                ]
                
                if inconsistent_domains:
                    recommendations.append(
                        f"⚖️  Inconsistent risk patterns in: {', '.join(inconsistent_domains)}"
                    )

                # High-risk scenarios across domains
                high_risk_count = 0
                for domain, metrics in detailed_metrics.items():
                    high_risk_scenarios = [
                        scenario for scenario, details in metrics['scenarios'].items()
                        if details['risk_score'] >= 20
                    ]
                    high_risk_count += len(high_risk_scenarios)

                if high_risk_count > 0:
                    recommendations.append(
                        f"⚡ {high_risk_count} high-risk scenarios identified - "
                        "prioritize mitigation strategies"
                    )

        # Default recommendation if no issues found
        if not recommendations:
            recommendations.append("✅ Overall resilience profile appears balanced")

        return recommendations[:5]  # Limit to top 5 recommendations


def calculate_resilience_score(assessments: Dict[str, DomainAssessment], 
                             scenario_manager=None) -> Dict[str, Any]:
    """
    Main function to calculate resilience scores with dynamic scenario support

    Args:
        assessments: Dictionary of domain assessments
        scenario_manager: Optional scenario manager for dynamic configuration

    Returns:
        Dictionary containing comprehensive scoring results
    """
    scorer = DynamicResilienceScoring(scenario_manager)
    return scorer.calculate_resilience_score(assessments)