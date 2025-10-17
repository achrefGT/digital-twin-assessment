from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import wraps
from typing import Optional
import logging

from ..database.database_manager import DatabaseManager
from ..services.kafka_service import KafkaService
from ..services.outbox_relayer import OutboxRelayer  
from .exceptions import create_http_exception
from shared.models.exceptions import DigitalTwinAssessmentException
from ..services.redis_base_service import get_redis_base_service as _get_redis_service
from ..cache.assessment_cache_service import get_assessment_cache_service
from ..cache.recommendation_cache_service import get_recommendation_cache_service


# Import auth components
from ..auth.service import AuthService
from ..auth.models import TokenData

logger = logging.getLogger(__name__)

# Global instances
_db_manager: Optional[DatabaseManager] = None
_kafka_service: Optional[KafkaService] = None
_auth_service: Optional[AuthService] = None
_outbox_relayer: Optional[OutboxRelayer] = None
_assessment_cache_service = None
_recommendation_cache_service = None

# Security scheme for token extraction
security = HTTPBearer(auto_error=False)

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

def get_auth_service() -> AuthService:
    """Get authentication service instance"""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService(get_db_manager())
    return _auth_service

def get_outbox_relayer() -> OutboxRelayer: 
    """Get outbox relayer instance"""
    global _outbox_relayer
    if _outbox_relayer is None:
        _outbox_relayer = OutboxRelayer(get_db_manager())
    return _outbox_relayer

def get_redis_service():
    """Get Redis base service instance."""
    return _get_redis_service()

def get_assessment_cache():
    """
    Get assessment cache service instance.
    
    Returns:
        AssessmentCacheService or None if unavailable
    """
    global _assessment_cache_service
    
    if _assessment_cache_service is None:
        try:
            redis_service = get_redis_service()
            _assessment_cache_service = get_assessment_cache_service(redis_service)
            logger.info("✅ Assessment cache service initialized")
        except Exception as e:
            logger.warning(f"Assessment cache service unavailable: {e}")
            return None
    
    return _assessment_cache_service

def get_recommendation_cache():
    """
    Get recommendation cache service instance.
    
    Returns:
        RecommendationCacheService or None if unavailable
    """
    global _recommendation_cache_service
    
    if _recommendation_cache_service is None:
        try:
            redis_service = get_redis_service()
            _recommendation_cache_service = get_recommendation_cache_service(redis_service)
            logger.info("✅ Recommendation cache service initialized")
        except Exception as e:
            logger.warning(f"Recommendation cache service unavailable: {e}")
            return None
    
    return _recommendation_cache_service

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> Optional[TokenData]:
    """Get current user from JWT token - Optional version"""
    
    if not credentials:
        return None
    
    try:
        token_data = auth_service.verify_access_token(credentials.credentials)
        return token_data
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None

async def get_current_user_required(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenData:
    """Get current user from JWT token - Required version"""
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token_data = auth_service.verify_access_token(credentials.credentials)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_roles(*allowed_roles: str):
    """Decorator to require specific user roles"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from function arguments
            current_user = kwargs.get('current_user')
            if not current_user:
                # Look for current_user in args (if passed positionally)
                for arg in args:
                    if isinstance(arg, TokenData):
                        current_user = arg
                        break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

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

async def init_cache_services():
    """
    Initialize all cache services at application startup.
    
    Should be called in app startup event.
    
    Returns:
        dict: Dictionary containing initialized service instances
              Format: {
                  "redis": RedisBaseService instance,
                  "assessment_cache": AssessmentCacheService instance,
                  "recommendation_cache": RecommendationCacheService instance,
                  "status": dict with boolean success flags
              }
    """
    results = {
        "redis": None,
        "assessment_cache": None,
        "recommendation_cache": None,
        "status": {
            "redis_connected": False,
            "assessment_cache_ready": False,
            "recommendation_cache_ready": False
        }
    }
    
    try:
        # Initialize Redis first
        redis_service = get_redis_service()
        
        if not redis_service.connected:
            await redis_service.connect()
        
        results["redis"] = redis_service
        results["status"]["redis_connected"] = redis_service.connected
        logger.info("✅ Redis connected")
        
        # Initialize assessment cache
        assessment_cache = get_assessment_cache()
        if assessment_cache:
            results["assessment_cache"] = assessment_cache
            results["status"]["assessment_cache_ready"] = True
            logger.info("✅ Assessment cache ready")
        
        # Initialize recommendation cache
        recommendation_cache = get_recommendation_cache()
        if recommendation_cache:
            results["recommendation_cache"] = recommendation_cache
            results["status"]["recommendation_cache_ready"] = True
            logger.info("✅ Recommendation cache ready")
        
    except Exception as e:
        logger.error(f"Error initializing cache services: {e}")
        # Ensure we still return the structure even on error
        if results["redis"] is None:
            results["redis"] = get_redis_service()  # Return unconnected instance
    
    return results

async def shutdown_cache_services():
    """
    Shutdown all cache services gracefully.
    
    Should be called in app shutdown event.
    """
    try:
        redis_service = get_redis_service()
        if redis_service and redis_service.connected:
            await redis_service.disconnect()
            logger.info("✅ Redis disconnected")
    except Exception as e:
        logger.error(f"Error shutting down cache services: {e}")