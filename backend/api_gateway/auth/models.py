from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr, Field, validator
from enum import Enum
from uuid import uuid4

# Import your existing Base from models.py
from ..database.models import Base

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"

class User(Base):
    """Database model for users"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False, default=lambda: str(uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Profile information
    first_name = Column(String)
    last_name = Column(String)
    role = Column(String, default=UserRole.USER.value)
    
    # OAuth2 fields
    oauth_provider = Column(String)  # google, github, etc.
    oauth_id = Column(String)
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Metadata
    meta_data = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)

class RefreshToken(Base):
    """Database model for refresh tokens"""
    __tablename__ = "refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(String, unique=True, index=True, nullable=False, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey('users.user_id'), index=True, nullable=False)
    token_hash = Column(String, nullable=False)
    
    # Token metadata
    device_info = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Status
    is_revoked = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

# Pydantic models for API
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    
    @validator('username')
    def validate_username(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain alphanumeric characters, hyphens, and underscores')
        return v.lower()

class UserResponse(BaseModel):
    user_id: str
    email: str
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenData(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    scopes: List[str] = []

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

# Fixed model for profile updates
class ProfileUpdate(BaseModel):
    first_name: Optional[Union[str, None]] = Field(None, max_length=100)
    last_name: Optional[Union[str, None]] = Field(None, max_length=100)
    
    @validator('first_name', pre=True)
    def validate_first_name(cls, v):
        # Handle None, empty strings, and whitespace-only strings
        if v is None:
            return None
        if isinstance(v, str):
            stripped = v.strip()
            return None if stripped == '' else stripped
        return v
    
    @validator('last_name', pre=True) 
    def validate_last_name(cls, v):
        # Handle None, empty strings, and whitespace-only strings
        if v is None:
            return None
        if isinstance(v, str):
            stripped = v.strip()
            return None if stripped == '' else stripped
        return v