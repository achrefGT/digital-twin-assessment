"""
Environmental Life Cycle Assessment (S-LCA) Service

This service processes Environmental sustainability assessments for digital twins.
"""

from .models import (
    ImprovedDigitalTwinConfig,
    map_results_to_categories,
    apply_regional_adjustments,
    apply_industry_scaling,
    normalize_and_score,
    calculate_weighted_scores,
    determine_rating,
    analyze_performance,
    get_recommendations,
    WEIGHTING_SCHEMES,
)

from .score import calculate_elca_score
from .config import settings

__version__ = "1.0.0"
__all__ = [
    ImprovedDigitalTwinConfig,
    "map_results_to_categories",
    "apply_regional_adjustments",
    "apply_industry_scaling",
    "normalize_and_score",
    "calculate_weighted_scores",
    "determine_rating",
    "analyze_performance",
    "get_recommendations",
    "WEIGHTING_SCHEMES",
    "calculate_elca_score",
    "settings"
]