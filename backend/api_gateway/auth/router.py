from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import logging

from .models import (
    UserCreate, UserResponse, UserLogin, Token, 
    RefreshTokenRequest, PasswordChange, TokenData, ProfileUpdate
)
from .service import AuthService, AuthenticationException, InvalidCredentialsException
from ..dependencies import (
    get_db_manager, 
    handle_exceptions, 
    get_current_user_optional,  
    get_current_user_required   
)

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()
logger = logging.getLogger(__name__)

def get_auth_service() -> AuthService:
    """Get authentication service instance"""
    return AuthService(get_db_manager())

def get_request_info(request: Request) -> Dict[str, Any]:
    """Extract request information for token metadata"""
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "device_info": request.headers.get("x-device-info")
    }

@router.post("/register", response_model=UserResponse)
@handle_exceptions
async def register(
    user_data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Register a new user"""
    try:
        user = auth_service.create_user(user_data)
        return UserResponse.from_orm(user)
    except AuthenticationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/login", response_model=Token)
@handle_exceptions
async def login(
    user_credentials: UserLogin,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Login user and return tokens"""
    user = auth_service.authenticate_user(
        user_credentials.username, 
        user_credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    request_info = get_request_info(request)
    tokens = auth_service.create_tokens(user, **request_info)
    
    return Token(**tokens)

@router.post("/refresh", response_model=Token)
@handle_exceptions
async def refresh_token(
    token_request: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Refresh access token"""
    try:
        tokens = auth_service.refresh_access_token(token_request.refresh_token)
        return Token(**tokens)
    except AuthenticationException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/logout")
@handle_exceptions
async def logout(
    token_request: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """Logout user by revoking refresh token"""
    success = auth_service.revoke_refresh_token(token_request.refresh_token)
    return {"message": "Successfully logged out" if success else "Token not found"}

@router.get("/me", response_model=UserResponse)
@handle_exceptions
async def get_current_user_info(
    current_user: TokenData = Depends(get_current_user_required),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Get current user information"""
    user = auth_service.get_user_by_id(current_user.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.from_orm(user)

@router.put("/profile", response_model=UserResponse)
@handle_exceptions
async def update_profile(
    request: Request,
    current_user: TokenData = Depends(get_current_user_required),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Update user profile information"""
    try:
        logger.info(f"Profile update request from user: {current_user.user_id}")
        
        # Parse JSON manually
        try:
            data = await request.json()
            logger.info(f"Raw profile data received: {data}")
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON in request body"
            )
        
        # Validate and create ProfileUpdate object
        try:
            profile_data = ProfileUpdate(**data)
            logger.info(f"Parsed profile data: {profile_data.dict()}")
        except Exception as e:
            logger.error(f"Failed to validate profile data: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid profile data: {str(e)}"
            )
        
        user = auth_service.update_user_profile(current_user.user_id, profile_data)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"Profile updated successfully for user: {current_user.user_id}")
        return UserResponse.from_orm(user)
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Profile update failed for user {current_user.user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )
    
@router.post("/change-password")
async def change_password(
    request: Request,
    current_user: TokenData = Depends(get_current_user_required),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Change user password with enhanced debugging"""
    try:
        # Log the incoming request
        logger.info(f"Password change request from user: {current_user.user_id}")
        
        # Get and validate the request data manually for better error handling
        try:
            data = await request.json()
            logger.info(f"Request data keys: {list(data.keys())}")
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON in request body"
            )
        
        # Extract fields
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        # Validate required fields
        if not current_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="current_password is required"
            )
        
        if not new_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="new_password is required"
            )
        
        # Validate password length
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="new_password must be at least 8 characters long"
            )
        
        # Validate current user
        if not current_user or not current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        # Change password
        success = auth_service.change_password(
            current_user.user_id,
            current_password,
            new_password
        )
        
        if success:
            logger.info(f"Password changed successfully for user: {current_user.user_id}")
            return {"message": "Password changed successfully", "success": True}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to change password"
            )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except InvalidCredentialsException as e:
        logger.warning(f"Invalid credentials for user: {current_user.user_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    except Exception as e:
        logger.error(f"Unexpected error in change_password: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# Debug endpoint to test authentication
@router.get("/debug/me")
async def debug_current_user(
    current_user: TokenData = Depends(get_current_user_required)
):
    """Debug endpoint to check current user"""
    return {
        "user_id": current_user.user_id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "scopes": current_user.scopes
    }