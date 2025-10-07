from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import wraps
from typing import Optional
import logging

from .database import DatabaseManager
from .kafka_service import KafkaService
from .outbox_relayer import OutboxRelayer  
from .exceptions import create_http_exception
from shared.models.exceptions import DigitalTwinAssessmentException

# Import auth components
from .auth.service import AuthService
from .auth.models import TokenData

logger = logging.getLogger(__name__)

# Global instances
_db_manager: Optional[DatabaseManager] = None
_kafka_service: Optional[KafkaService] = None
_auth_service: Optional[AuthService] = None
_outbox_relayer: Optional[OutboxRelayer] = None  

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