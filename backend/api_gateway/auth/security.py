import dataclasses
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Union
from passlib.context import CryptContext
import secrets
import hashlib
from uuid import uuid4
import os

@dataclasses.dataclass
class SecurityConfig:
    """Security configuration with better defaults"""
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    PASSWORD_MIN_LENGTH: int = 8
    MAX_REFRESH_TOKENS_PER_USER: int = int(os.getenv("MAX_REFRESH_TOKENS_PER_USER", "5"))
    
    def __post_init__(self):
        # Validate that SECRET_KEY is set in production
        if not self.SECRET_KEY:
            if os.getenv("ENVIRONMENT", "development") == "production":
                raise ValueError("JWT_SECRET_KEY must be set in production")
            else:
                # Generate a random key for development
                self.SECRET_KEY = secrets.token_urlsafe(32)
                print("WARNING: Using generated SECRET_KEY for development")

# Password hashing
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__rounds=12  # Increase rounds for better security
)

class SecurityManager:
    """Handles JWT tokens and password operations"""
    
    def __init__(self, config: SecurityConfig = None):
        self.config = config or SecurityConfig()
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a plaintext password against its hash"""
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False  # Don't leak information about hash format
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token with better payload structure"""
        to_encode = data.copy()
        
        now = datetime.utcnow()
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=self.config.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": now,
            "nbf": now,  # Not before
            "type": "access",
            "jti": str(uuid4())  # JWT ID for token tracking
        })
        
        encoded_jwt = jwt.encode(to_encode, self.config.SECRET_KEY, algorithm=self.config.ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self) -> str:
        """Create a secure random refresh token"""
        return secrets.token_urlsafe(32)
    
    def hash_refresh_token(self, token: str) -> str:
        """Hash refresh token for secure storage"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token with type checking"""
        try:
            payload = jwt.decode(
                token, 
                self.config.SECRET_KEY, 
                algorithms=[self.config.ALGORITHM],
                options={
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True
                }
            )
            
            # Verify token type
            if payload.get("type") != token_type:
                return None
                
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception:
            return None
    
    def is_token_expired(self, payload: Dict[str, Any]) -> bool:
        """Check if token is expired"""
        exp = payload.get("exp")
        if exp is None:
            return True
        return datetime.fromtimestamp(exp) < datetime.utcnow()

# Create global security manager instance
security_manager = SecurityManager()