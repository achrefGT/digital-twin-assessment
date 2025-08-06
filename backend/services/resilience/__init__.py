
"""
Resilience Service Package

Digital Twin Resilience Assessment Service for calculating
resilience scores based on risk assessments across multiple domains.
"""

__version__ = "0.1.0"
from .app import app
from .config import settings

__all__ = ["app", "settings"]