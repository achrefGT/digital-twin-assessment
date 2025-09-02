
"""
Sustainabilty Service Package

Digital Twin Sustainabilty Assessment Service for calculating
sustainabilty scores (environmental, social and economic).
"""

__version__ = "0.1.0"
from .app import app
from .config import settings

__all__ = ["app", "settings"]