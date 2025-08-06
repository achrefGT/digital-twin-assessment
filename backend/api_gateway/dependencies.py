from fastapi import HTTPException, status
from functools import wraps
from typing import Optional
import logging

from .database import DatabaseManager
from .kafka_service import KafkaService
from .exceptions import create_http_exception
from shared.models.exceptions import DigitalTwinAssessmentException

logger = logging.getLogger(__name__)

# Global instances - In production, consider using a proper DI container
_db_manager: Optional[DatabaseManager] = None
_kafka_service: Optional[KafkaService] = None


def get_db_manager() -> DatabaseManager:
    """Get database manager instance"""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


def get_kafka_service() -> KafkaService:
    """Get Kafka service instance"""
    global _kafka_service
    if _kafka_service is None:
        _kafka_service = KafkaService(get_db_manager())
    return _kafka_service


async def get_current_user() -> Optional[str]:
    """Get current user - placeholder for future authentication"""
    # For now, return None since we're not implementing auth yet
    return None


def handle_exceptions(func):
    """Decorator to handle custom exceptions and convert to HTTP exceptions"""
    @wraps(func)  
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except DigitalTwinAssessmentException as e:
            raise create_http_exception(e)
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )
    return wrapper