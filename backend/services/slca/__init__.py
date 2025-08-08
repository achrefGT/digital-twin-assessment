"""
Social Life Cycle Assessment (S-LCA) Service

This service processes social sustainability assessments for digital twins,
calculating scores based on safety, worker satisfaction, community engagement,
job creation, and other social indicators across multiple stakeholder groups.
"""

from .models import (
    SLCAInput,
    SLCAResult,
    SocialIndicators,
    StakeholderGroup,
    STAKEHOLDER_DESCRIPTIONS,
    DEFAULT_WEIGHTINGS
)

from .score import calculate_slca_score
from .config import settings

__version__ = "1.0.0"
__all__ = [
    "SLCAInput",
    "SLCAResult",
    "SocialIndicators",
    "StakeholderGroup",
    "STAKEHOLDER_DESCRIPTIONS",
    "DEFAULT_WEIGHTINGS",
    "calculate_slca_score",
    "settings"
]