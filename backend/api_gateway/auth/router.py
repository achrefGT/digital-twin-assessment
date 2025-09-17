from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

from .models import (
    UserCreate, UserResponse, UserLogin, Token, 
    RefreshTokenRequest, PasswordChange, TokenData
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

@router.post("/change-password")
@handle_exceptions
async def change_password(
    password_data: PasswordChange,
    current_user: TokenData = Depends(get_current_user_required),
    auth_service: AuthService = Depends(get_auth_service)
):
    """Change user password"""
    try:
        success = auth_service.change_password(
            current_user.user_id,
            password_data.current_password,
            password_data.new_password
        )
        return {"message": "Password changed successfully"}
    except InvalidCredentialsException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )