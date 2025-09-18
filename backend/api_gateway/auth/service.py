from datetime import datetime, timedelta
import logging
from typing import List, Optional, Dict, Any
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .models import User, RefreshToken, UserCreate, UserLogin, TokenData, UserRole, ProfileUpdate
from .security import security_manager
from ..database import DatabaseManager
from ..exceptions import DatabaseConnectionException
from shared.models.exceptions import DigitalTwinAssessmentException

logger = logging.getLogger(__name__)

class AuthenticationException(DigitalTwinAssessmentException):
    """Authentication-related exceptions"""
    pass

class UserNotFoundException(AuthenticationException):
    """User not found exception"""
    pass

class InvalidCredentialsException(AuthenticationException):
    """Invalid credentials exception"""
    pass

class TokenExpiredException(AuthenticationException):
    """Token expired exception"""
    pass

class AuthService:
    """Authentication service handling user operations"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.security = security_manager
    
    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        with self.db_manager.get_session() as session:
            # Check if user already exists
            existing_user = session.query(User).filter(
                or_(User.email == user_data.email, User.username == user_data.username)
            ).first()
            
            if existing_user:
                raise AuthenticationException("User with this email or username already exists")
            
            # Create new user
            hashed_password = self.security.get_password_hash(user_data.password)
            
            user = User(
                user_id=str(uuid4()),
                email=user_data.email.lower(),
                username=user_data.username.lower(),
                hashed_password=hashed_password,
                first_name=user_data.first_name,
                last_name=user_data.last_name,
                role=UserRole.USER.value
            )
            
            session.add(user)
            session.flush()
            
            # Detach from session
            session.expunge(user)
            return user
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with username/email and password"""
        with self.db_manager.get_session() as session:
            # Find user by username or email
            user = session.query(User).filter(
                or_(
                    User.username == username.lower(),
                    User.email == username.lower()
                )
            ).first()
            
            # Always hash password to prevent timing attacks
            if not user:
                # Hash dummy password to maintain consistent timing
                self.security.get_password_hash("dummy_password_to_prevent_timing_attack")
                return None
            
            if not user.is_active:
                return None
            
            if not self.security.verify_password(password, user.hashed_password):
                return None
            
            # Update last login
            user.last_login = datetime.utcnow()
            session.commit()
            
            # Detach from session
            session.expunge(user)
            return user
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        with self.db_manager.get_session() as session:
            user = session.query(User).filter(User.user_id == user_id).first()
            if user:
                session.expunge(user)
            return user
    
    def update_user_profile(self, user_id: str, profile_data: ProfileUpdate) -> Optional[User]:
        """Update user profile information"""
        logger.info(f"Updating profile for user: {user_id}")
        
        with self.db_manager.get_session() as session:
            user = session.query(User).filter(User.user_id == user_id).first()
            
            if not user:
                logger.error(f"User not found: {user_id}")
                raise UserNotFoundException("User not found")
            
            # Update fields only if they are provided and different
            updated = False
            
            if profile_data.first_name is not None and profile_data.first_name != user.first_name:
                user.first_name = profile_data.first_name
                updated = True
                logger.info(f"Updated first_name for user {user_id}: {profile_data.first_name}")
            
            if profile_data.last_name is not None and profile_data.last_name != user.last_name:
                user.last_name = profile_data.last_name
                updated = True
                logger.info(f"Updated last_name for user {user_id}: {profile_data.last_name}")
            
            if updated:
                user.updated_at = datetime.utcnow()
                session.commit()
                logger.info(f"Profile update committed for user: {user_id}")
            else:
                logger.info(f"No profile changes detected for user: {user_id}")
            
            # Detach from session
            session.expunge(user)
            return user
    
    def create_tokens(self, user: User, device_info: Optional[str] = None,
                     ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Dict[str, Any]:
        """Create access and refresh tokens for user"""
        
        # Create access token
        access_token_data = {
            "sub": user.user_id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "scopes": self._get_user_scopes(user)
        }
        
        access_token = self.security.create_access_token(access_token_data)
        
        # Create refresh token
        refresh_token = self.security.create_refresh_token()
        refresh_token_hash = self.security.hash_refresh_token(refresh_token)
        
        # Store refresh token in database
        with self.db_manager.get_session() as session:
            refresh_token_record = RefreshToken(
                token_id=str(uuid4()),
                user_id=user.user_id,
                token_hash=refresh_token_hash,
                device_info=device_info,
                ip_address=ip_address,
                user_agent=user_agent,
                expires_at=datetime.utcnow() + timedelta(days=self.security.config.REFRESH_TOKEN_EXPIRE_DAYS)
            )
            
            session.add(refresh_token_record)
            session.commit()
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": self.security.config.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Create new access token using refresh token"""
        refresh_token_hash = self.security.hash_refresh_token(refresh_token)
        
        with self.db_manager.get_session() as session:
            # Find refresh token
            token_record = session.query(RefreshToken).filter(
                RefreshToken.token_hash == refresh_token_hash,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            ).first()
            
            if not token_record:
                raise TokenExpiredException("Invalid or expired refresh token")
            
            # Get user
            user = session.query(User).filter(User.user_id == token_record.user_id).first()
            if not user or not user.is_active:
                raise UserNotFoundException("User not found or inactive")
            
            # Create new access token
            access_token_data = {
                "sub": user.user_id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "scopes": self._get_user_scopes(user)
            }
            
            access_token = self.security.create_access_token(access_token_data)
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,  # Keep same refresh token
                "token_type": "bearer",
                "expires_in": self.security.config.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            }
    
    def revoke_refresh_token(self, refresh_token: str) -> bool:
        """Revoke a refresh token"""
        refresh_token_hash = self.security.hash_refresh_token(refresh_token)
        
        with self.db_manager.get_session() as session:
            token_record = session.query(RefreshToken).filter(
                RefreshToken.token_hash == refresh_token_hash
            ).first()
            
            if token_record:
                token_record.is_revoked = True
                session.commit()
                return True
            
            return False
    
    def revoke_all_user_tokens(self, user_id: str) -> int:
        """Revoke all refresh tokens for a user"""
        with self.db_manager.get_session() as session:
            count = session.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False
            ).update({"is_revoked": True})
            
            session.commit()
            return count
    
    def verify_access_token(self, token: str) -> Optional[TokenData]:
        """Verify access token and return token data"""
        payload = self.security.verify_token(token)
        
        if not payload:
            return None
        
        if payload.get("type") != "access":
            return None
        
        if self.security.is_token_expired(payload):
            return None
        
        return TokenData(
            user_id=payload.get("sub"),
            username=payload.get("username"),
            email=payload.get("email"),
            role=payload.get("role"),
            scopes=payload.get("scopes", [])
        )
    
    def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        """Change user password with debug logging"""
        logger.info(f"Attempting password change for user: {user_id}")
        
        with self.db_manager.get_session() as session:
            user = session.query(User).filter(User.user_id == user_id).first()
            
            if not user:
                logger.error(f"User not found: {user_id}")
                raise UserNotFoundException("User not found")
            
            # Verify current password
            if not self.security.verify_password(current_password, user.hashed_password):
                logger.warning(f"Invalid current password for user: {user_id}")
                raise InvalidCredentialsException("Current password is incorrect")
            
            # Validate new password
            if len(new_password) < 8:
                logger.error(f"New password too short for user: {user_id}")
                raise ValueError("New password must be at least 8 characters long")
            
            # Update password
            user.hashed_password = self.security.get_password_hash(new_password)
            user.updated_at = datetime.utcnow()
            
            session.commit()
            logger.info(f"Password changed successfully for user: {user_id}")
            
            # Revoke all refresh tokens for security
            revoked_count = self.revoke_all_user_tokens(user_id)
            logger.info(f"Revoked {revoked_count} refresh tokens for user: {user_id}")
            
            return True
    
    def _get_user_scopes(self, user: User) -> List[str]:
        """Get user scopes based on role"""
        base_scopes = ["read:profile", "write:profile"]
        
        if user.role == UserRole.ADMIN.value:
            return base_scopes + ["admin:all", "read:users", "write:users"]
        elif user.role == UserRole.ASSESSOR.value:
            return base_scopes + ["read:assessments", "write:assessments"]
        else:
            return base_scopes