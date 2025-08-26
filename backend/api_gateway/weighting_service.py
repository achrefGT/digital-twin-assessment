# weighting_service.py
from typing import Dict, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class WeightingService:
    def __init__(self):
        # Define domain weights (configurable)
        self.default_weights = {
            "resilience": 0.30,
            "elca": 0.23,
            "lcc": 0.17,
            "slca": 0.10,
            "human_centricity": 0.20
        }
        
        # You can load these from config or environment variables
        self.weights = self.default_weights.copy()
    
    def calculate_overall_score(self, domain_scores: Dict[str, float]) -> Optional[float]:
        """Calculate weighted overall score from domain scores"""
        if not domain_scores:
            return None
        
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for domain, score in domain_scores.items():
            if score is not None and domain in self.weights:
                weight = self.weights[domain]
                total_weighted_score += score * weight
                total_weight += weight
        
        # Only return score if we have enough domains (at least 50% of total weight)
        if total_weight >= 0.5:
            return total_weighted_score / total_weight
        
        return None
    
    def is_assessment_complete(self, domain_scores: Dict[str, float]) -> bool:
        """Check if all required domains have scores"""
        required_domains = set(self.weights.keys())
        completed_domains = {
            domain for domain, score in domain_scores.items() 
            if score is not None
        }
        return required_domains.issubset(completed_domains)
    
    def get_completion_percentage(self, domain_scores: Dict[str, float]) -> float:
        """Get assessment completion percentage based on domain completion"""
        required_domains = len(self.weights)
        completed_domains = len([
            score for score in domain_scores.values() 
            if score is not None
        ])
        return (completed_domains / required_domains) * 100 if required_domains > 0 else 0
    
    def update_weights(self, new_weights: Dict[str, float]) -> bool:
        """Update weights with validation"""
        # Validate weights sum to 1.0 (allow small floating point errors)
        total_weight = sum(new_weights.values())
        if abs(total_weight - 1.0) > 0.01:
            logger.error(f"Invalid weights: sum is {total_weight}, should be 1.0")
            return False
        
        # Validate all required domains are present
        required_domains = {"resilience", "elca", "lcc", "slca", "human_centricity"}
        if set(new_weights.keys()) != required_domains:
            logger.error(f"Invalid domains. Required: {required_domains}, got: {set(new_weights.keys())}")
            return False
        
        # Update weights
        self.weights = new_weights.copy()
        logger.info(f"Updated weights: {self.weights}")
        return True