import numpy as np
from typing import Dict, Any
import logging

from shared.models.exceptions import ScoringException
from .models import DomainAssessment, LikelihoodLevel, ImpactLevel

logger = logging.getLogger(__name__)


def calculate_resilience_score(assessments: Dict[str, DomainAssessment]) -> Dict[str, Any]:
    """Calculate resilience scores from assessments"""
    
    try:
        # Validate input
        if not assessments:
            raise ScoringException("No assessments provided for scoring")
        
        # Mapping scales to numeric values (1-5)
        likelihood_map = {
            LikelihoodLevel.RARE: 1,
            LikelihoodLevel.UNLIKELY: 2,
            LikelihoodLevel.POSSIBLE: 3,
            LikelihoodLevel.LIKELY: 4,
            LikelihoodLevel.ALMOST_CERTAIN: 5
        }
        
        impact_map = {
            ImpactLevel.NEGLIGIBLE: 1,
            ImpactLevel.MINOR: 2,
            ImpactLevel.MODERATE: 3,
            ImpactLevel.MAJOR: 4,
            ImpactLevel.CATASTROPHIC: 5
        }
        
        domain_scores = {}
        all_risk_scores = []
        detailed_metrics = {}
        
        for domain_name, domain_assessment in assessments.items():
            try:
                domain_risks = []
                scenario_details = {}
                
                # Validate domain assessment
                if not hasattr(domain_assessment, 'scenarios') or not domain_assessment.scenarios:
                    logger.warning(f"Domain {domain_name} has no scenarios, skipping")
                    continue
                
                for scenario_text, assessment in domain_assessment.scenarios.items():
                    try:
                        # Validate assessment components
                        if not hasattr(assessment, 'likelihood') or not hasattr(assessment, 'impact'):
                            raise ScoringException(f"Invalid assessment structure for scenario: {scenario_text}")
                        
                        likelihood_num = likelihood_map.get(assessment.likelihood)
                        impact_num = impact_map.get(assessment.impact)
                        
                        if likelihood_num is None or impact_num is None:
                            raise ScoringException(f"Invalid likelihood or impact values for scenario: {scenario_text}")
                        
                        # Risk score = likelihood * impact (1-25 range)
                        risk_score = likelihood_num * impact_num
                        domain_risks.append(risk_score)
                        all_risk_scores.append(risk_score)
                        
                        scenario_details[scenario_text] = {
                            'likelihood': assessment.likelihood.value,
                            'impact': assessment.impact.value,
                            'likelihood_score': likelihood_num,
                            'impact_score': impact_num,
                            'risk_score': risk_score
                        }
                        
                    except Exception as e:
                        logger.error(f"Error processing scenario {scenario_text} in domain {domain_name}: {e}")
                        raise ScoringException(f"Failed to process scenario {scenario_text}: {e}")
                
                if not domain_risks:
                    logger.warning(f"No valid scenarios found for domain {domain_name}")
                    continue
                
                # Calculate domain resilience score
                # Convert risk to resilience: higher risk = lower resilience
                mean_risk = np.mean(domain_risks)
                # Normalize to 0-100 scale (min risk=1, max risk=25)
                domain_resilience = (1 - (mean_risk - 1) / (25 - 1)) * 100
                domain_scores[domain_name] = round(domain_resilience, 1)
                
                detailed_metrics[domain_name] = {
                    'mean_risk_score': round(mean_risk, 2),
                    'resilience_score': round(domain_resilience, 1),
                    'scenario_count': len(domain_risks),
                    'scenarios': scenario_details
                }
                
                logger.debug(f"Calculated resilience score for domain {domain_name}: {domain_resilience:.1f}")
                
            except Exception as e:
                logger.error(f"Error processing domain {domain_name}: {e}")
                raise ScoringException(f"Failed to process domain {domain_name}: {e}")
        
        if not all_risk_scores:
            raise ScoringException("No valid risk scores calculated from assessments")
        
        # Calculate overall resilience score
        overall_mean_risk = np.mean(all_risk_scores)
        overall_resilience = (1 - (overall_mean_risk - 1) / (25 - 1)) * 100
        
        result = {
            'overall_score': round(overall_resilience, 1),
            'domain_scores': domain_scores,
            'risk_metrics': {
                'overall_mean_risk': round(overall_mean_risk, 2),
                'total_scenarios': len(all_risk_scores),
                'domains_processed': len(domain_scores),
                'risk_distribution': {
                    'min': min(all_risk_scores),
                    'max': max(all_risk_scores),
                    'std': round(np.std(all_risk_scores), 2)
                },
                'detailed_metrics': detailed_metrics
            }
        }
        
        logger.info(f"Successfully calculated resilience scores: overall={overall_resilience:.1f}, domains={len(domain_scores)}")
        return result
        
    except ScoringException:
        # Re-raise scoring exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in resilience scoring: {e}")
        raise ScoringException(f"Unexpected error during scoring calculation: {e}")