from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
import re

from database import get_db
from services.auth_service import AuthService
from models.user import User

router = APIRouter()
security = HTTPBearer()

# Pydantic models for request/response
class UserRegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if len(v) > 20:
            raise ValueError('Username must be at most 20 characters long')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        if len(v) > 50:
            raise ValueError('Password must be at most 50 characters long')
        return v
    
    @validator('name')
    def validate_name(cls, v):
        if len(v) < 2:
            raise ValueError('Name must be at least 2 characters long')
        if len(v) > 50:
            raise ValueError('Name must be at most 50 characters long')
        return v

class UserLoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: int
    username: str
    name: str
    total_points: int
    created_at: str
    last_login: Optional[str] = None

class AuthResponse(BaseModel):
    user_id: int
    username: str
    name: str
    access_token: str
    token_type: str

# Dependency to get current user
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    try:
        token = credentials.credentials
        return AuthService.get_current_user(db, token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

@router.post("/auth/register", response_model=AuthResponse)
def register_user(
    user_data: UserRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user.
    
    - **username**: Unique username (3-20 characters, letters/numbers/underscores only)
    - **password**: Password (6-50 characters)
    - **name**: Display name (2-50 characters)
    """
    try:
        result = AuthService.register_user(
            db=db,
            username=user_data.username,
            password=user_data.password,
            name=user_data.name
        )
        return AuthResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/auth/login", response_model=AuthResponse)
def login_user(
    user_data: UserLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return access token.
    
    - **username**: Username
    - **password**: Password
    """
    try:
        result = AuthService.login_user(
            db=db,
            username=user_data.username,
            password=user_data.password
        )
        return AuthResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.get("/auth/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user information.
    
    Requires valid authentication token.
    """
    return UserResponse(
        user_id=current_user.id,
        username=current_user.username,
        name=current_user.name,
        total_points=current_user.total_points,
        created_at=current_user.created_at.isoformat(),
        last_login=current_user.last_login.isoformat() if current_user.last_login else None
    )

@router.post("/auth/refresh", response_model=AuthResponse)
def refresh_token(
    current_user: User = Depends(get_current_user)
):
    """
    Refresh access token.
    
    Requires valid authentication token.
    """
    try:
        access_token = AuthService.create_access_token(current_user.id, current_user.username)
        return AuthResponse(
            user_id=current_user.id,
            username=current_user.username,
            name=current_user.name,
            access_token=access_token,
            token_type="bearer"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)}"
        )
