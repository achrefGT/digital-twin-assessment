"""
Life Cycle Cost (LCC) Assessment Service

This service processes Life Cycle Cost assessments for digital twins,
calculating comprehensive economic sustainability scores based on costs, benefits,
and industry-specific factors.
"""

from .models import (
    DigitalTwinCosts,
    DigitalTwinBenefits,
    IndustryType,
    LCCInput,
    LCCResult,
    CostStructure,
    BenefitStructure
)

from .score import calculate_lcc_score
from .config import settings

__version__ = "1.0.0"
__all__ = [
    "DigitalTwinCosts", 
    "DigitalTwinBenefits",
    "IndustryType",
    "LCCInput",
    "LCCResult",
    "CostStructure",
    "BenefitStructure",
    "calculate_lcc_score",
    "settings"
]