import numpy as np
import pandas as pd
import warnings
from typing import Dict, Optional, Union, Tuple, List
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class WeightingService:
    def __init__(self, alpha: float = 0.8):
        """
        Initialize WeightingService with compromise weighting.
        
        Parameters:
        -----------
        alpha : float, default=0.5
            Compromise parameter (0-1):
            - 0 = pure objective weights (entropy-based)
            - 1 = pure subjective weights (hardcoded)
            - 0.5 = equal balance between objective and subjective
        """
        # Define subjective weights (hardcoded/expert knowledge)
        self.subjective_weights = {
            "resilience": 0.30,
            "sustainability": 0.50,
            "human_centricity": 0.20
        }
        
        # Current weights (starts as subjective, may be updated with compromise)
        self.weights = self.subjective_weights.copy()
        self.weights_type = "subjective"  # Track weight type: subjective, objective, or compromise
        self.alpha = max(0.0, min(1.0, alpha))  # Ensure alpha is between 0 and 1
        self.last_objective_calculation = None
        self.min_assessments_for_objective = 10  # Minimum assessments needed for objective weighting
        self.objective_weights = None  # Store calculated objective weights
        
    def entropy_method(self, X: Union[np.ndarray, pd.DataFrame], 
                      normalized: bool = False) -> Tuple[np.ndarray, dict]:
        """
        Calculate objective weights using the entropy method.
        
        Parameters:
        -----------
        X : np.ndarray or pd.DataFrame
            Decision matrix with alternatives as rows and criteria as columns
        normalized : bool, default=False
            Whether the input matrix is already normalized
            
        Returns:
        --------
        weights : np.ndarray
            Objective weights for each criterion
        info : dict
            Dictionary containing intermediate calculations
        """
        
        # Input validation
        if isinstance(X, pd.DataFrame):
            if X.empty:
                raise ValueError("Input DataFrame is empty")
            X = X.values
        
        X = np.array(X, dtype=float)
        
        if X.size == 0:
            raise ValueError("Input matrix is empty")
        
        if np.any(X < 0):
            raise ValueError("Input matrix contains negative values")
        
        if np.any(np.isnan(X)) or np.any(np.isinf(X)):
            raise ValueError("Input matrix contains NaN or infinite values")
        
        m, n = X.shape  # m alternatives, n criteria
        
        if m < 2 or n < 2:
            raise ValueError("Matrix must have at least 2 alternatives and 2 criteria")
        
        # Step 1: Normalize the matrix if not already normalized
        if not normalized:
            X_norm = np.zeros_like(X)
            for j in range(n):
                col_sum = np.sum(X[:, j])
                if col_sum > 1e-10:  # Avoid division by very small numbers
                    X_norm[:, j] = X[:, j] / col_sum
                else:
                    warnings.warn(f"Column {j} has near-zero sum, using equal distribution")
                    X_norm[:, j] = 1.0 / m
        else:
            X_norm = X.copy()
            # Validate normalized input
            for j in range(n):
                col_sum = np.sum(X_norm[:, j])
                if not np.isclose(col_sum, 1.0, atol=1e-6):
                    warnings.warn(f"Column {j} doesn't sum to 1 ({col_sum:.6f}), renormalizing")
                    if col_sum > 1e-10:
                        X_norm[:, j] = X_norm[:, j] / col_sum
                    else:
                        X_norm[:, j] = 1.0 / m
        
        # Step 2: Calculate probability matrix P
        p_matrix = np.zeros_like(X_norm)
        
        for j in range(n):
            col_sum = np.sum(X_norm[:, j])
            if col_sum > 1e-10:
                p_matrix[:, j] = X_norm[:, j] / col_sum
            else:
                p_matrix[:, j] = 1.0 / m
        
        # Step 3: Calculate entropy for each criterion
        k = 1.0 / np.log(m) if m > 1 else 1.0
        entropy = np.zeros(n)
        
        for j in range(n):
            entropy_sum = 0
            for i in range(m):
                if p_matrix[i, j] > 1e-10:  # Avoid log(0)
                    entropy_sum += p_matrix[i, j] * np.log(p_matrix[i, j])
            entropy[j] = -k * entropy_sum
        
        # Step 4: Calculate degree of divergence
        divergence = 1 - entropy
        
        # Step 5: Calculate objective weights
        div_sum = np.sum(divergence)
        if div_sum > 1e-10:
            weights = divergence / div_sum
        else:
            warnings.warn("All criteria have maximum entropy, using equal weights")
            weights = np.ones(n) / n
        
        # Validate results
        if not np.isclose(np.sum(weights), 1.0, atol=1e-6):
            weights = weights / np.sum(weights)
        
        # Store intermediate results
        info = {
            'p_matrix': p_matrix,
            'entropy': entropy,
            'divergence': divergence,
            'k': k,
            'normalized_matrix': X_norm
        }
        
        return weights, info

    def calculate_compromise_weights(self, assessment_data: List[Dict[str, float]]) -> Dict[str, float]:
        """
        Calculate compromise weights combining objective and subjective weights.
        
        Formula: W_compromise = α * W_subjective + (1 - α) * W_objective
        
        Parameters:
        -----------
        assessment_data : List[Dict[str, float]]
            List of assessment data with domain scores
            
        Returns:
        --------
        Dict[str, float]
            Compromise weights for each domain
        """
        
        # Check if we have enough data for objective weighting
        if len(assessment_data) < self.min_assessments_for_objective:
            logger.info(f"Not enough data for objective weighting ({len(assessment_data)} < {self.min_assessments_for_objective}). Using subjective weights.")
            self.weights_type = "subjective"
            return self.subjective_weights.copy()
        
        try:
            # Prepare data matrix for entropy method
            # Rows = assessments, Columns = domains (resilience, sustainability, human_centricity)
            domains = ["resilience", "sustainability", "human_centricity"]
            
            # Filter assessments that have all domain scores
            complete_assessments = []
            for assessment in assessment_data:
                if all(domain in assessment and assessment[domain] is not None for domain in domains):
                    complete_assessments.append([assessment[domain] for domain in domains])
            
            if len(complete_assessments) < self.min_assessments_for_objective:
                logger.info(f"Not enough complete assessments for objective weighting ({len(complete_assessments)} < {self.min_assessments_for_objective}). Using subjective weights.")
                self.weights_type = "subjective"
                return self.subjective_weights.copy()
            
            # Create decision matrix
            decision_matrix = np.array(complete_assessments)
            
            # Calculate objective weights using entropy method
            objective_weights_array, entropy_info = self.entropy_method(decision_matrix, normalized=False)
            
            # Convert to dictionary format matching domain names
            objective_weights_dict = {
                domains[i]: float(objective_weights_array[i]) 
                for i in range(len(domains))
            }
            
            # Store objective weights for reference
            self.objective_weights = objective_weights_dict.copy()
            
            # Calculate compromise weights
            # W_compromise = α * W_subjective + (1 - α) * W_objective
            compromise_weights = {}
            for domain in domains:
                subjective_weight = self.subjective_weights[domain]
                objective_weight = objective_weights_dict[domain]
                compromise_weight = (self.alpha * subjective_weight + 
                                   (1 - self.alpha) * objective_weight)
                compromise_weights[domain] = compromise_weight
            
            # Normalize to ensure sum = 1.0 (handle floating point precision issues)
            total_weight = sum(compromise_weights.values())
            if total_weight > 0:
                compromise_weights = {
                    domain: weight / total_weight 
                    for domain, weight in compromise_weights.items()
                }
            
            # Update current weights and tracking
            self.weights = compromise_weights.copy()
            self.weights_type = f"compromise(α={self.alpha:.2f})"
            self.last_objective_calculation = datetime.utcnow()
            
            logger.info(f"Calculated compromise weights with α={self.alpha:.2f}:")
            logger.info(f"  Subjective: {self.subjective_weights}")
            logger.info(f"  Objective: {objective_weights_dict}")
            logger.info(f"  Compromise: {compromise_weights}")
            
            return compromise_weights
            
        except Exception as e:
            logger.error(f"Error calculating objective weights: {e}")
            logger.info("Falling back to subjective weights")
            self.weights_type = "subjective_fallback"
            return self.subjective_weights.copy()
    
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
    
    def update_weights_from_data(self, assessment_data: List[Dict[str, float]]) -> bool:
        """
        Update weights based on assessment data using compromise approach.
        
        Parameters:
        -----------
        assessment_data : List[Dict[str, float]]
            List of assessment data with domain scores
            
        Returns:
        --------
        bool
            True if weights were successfully updated
        """
        try:
            new_weights = self.calculate_compromise_weights(assessment_data)
            self.weights = new_weights
            logger.info(f"Updated weights using {len(assessment_data)} assessments: {self.weights}")
            return True
        except Exception as e:
            logger.error(f"Failed to update weights from data: {e}")
            return False
    
    def set_alpha(self, alpha: float) -> bool:
        """
        Update the compromise parameter alpha.
        
        Parameters:
        -----------
        alpha : float
            New alpha value (0-1)
            
        Returns:
        --------
        bool
            True if alpha was successfully updated
        """
        if not (0.0 <= alpha <= 1.0):
            logger.error(f"Invalid alpha value: {alpha}. Must be between 0 and 1.")
            return False
        
        self.alpha = alpha
        logger.info(f"Updated alpha parameter to {alpha}")
        return True
    
    def get_weights_info(self) -> Dict[str, any]:
        """Get detailed information about current weights"""
        return {
            "current_weights": self.weights.copy(),
            "weights_type": self.weights_type,
            "alpha": self.alpha,
            "subjective_weights": self.subjective_weights.copy(),
            "objective_weights": self.objective_weights.copy() if self.objective_weights else None,
            "last_objective_calculation": self.last_objective_calculation.isoformat() if self.last_objective_calculation else None,
            "min_assessments_for_objective": self.min_assessments_for_objective
        }
    
    def manual_update_weights(self, new_weights: Dict[str, float]) -> bool:
        """
        Manually update weights with validation (overwrites compromise approach).
        
        Parameters:
        -----------
        new_weights : Dict[str, float]
            New weights dictionary
            
        Returns:
        --------
        bool
            True if weights were successfully updated
        """
        # Validate weights sum to 1.0 (allow small floating point errors)
        total_weight = sum(new_weights.values())
        if abs(total_weight - 1.0) > 0.01:
            logger.error(f"Invalid weights: sum is {total_weight}, should be 1.0")
            return False
        
        # Validate all required domains are present
        required_domains = {"resilience", "sustainability", "human_centricity"}
        if set(new_weights.keys()) != required_domains:
            logger.error(f"Invalid domains. Required: {required_domains}, got: {set(new_weights.keys())}")
            return False
        
        # Update weights
        self.weights = new_weights.copy()
        self.weights_type = "manual_override"
        logger.info(f"Manually updated weights: {self.weights}")
        return True