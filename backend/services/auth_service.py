from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt
import bcrypt
from fastapi import HTTPException, status
from models.user import User
from models.user_scores import UserScores

class AuthService:
    """Service for handling user authentication and authorization."""
    
    # JWT Configuration
    SECRET_KEY = "your-secret-key-here"  # In production, use environment variable
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS = 60  # 2 months as requested
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    @staticmethod
    def create_access_token(user_id: int, username: str) -> str:
        """Create a JWT access token."""
        expire = datetime.utcnow() + timedelta(days=AuthService.ACCESS_TOKEN_EXPIRE_DAYS)
        payload = {
            "user_id": user_id,
            "username": username,
            "exp": expire,
            "type": "access"
        }
        token = jwt.encode(payload, AuthService.SECRET_KEY, algorithm=AuthService.ALGORITHM)
        return token
    
    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, AuthService.SECRET_KEY, algorithms=[AuthService.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except (jwt.JWTError, jwt.InvalidTokenError, jwt.DecodeError, Exception) as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    @staticmethod
    def register_user(db: Session, username: str, password: str, name: str) -> Dict[str, Any]:
        """Register a new user."""
        # Check if username already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        
        # Hash password
        password_hash = AuthService.hash_password(password)
        
        # Create new user
        new_user = User(
            username=username,
            password_hash=password_hash,
            name=name,
            email=f"{username}@temp.com"  # Temporary email for now
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create user scores entry automatically
        user_scores = UserScores(
            user_id=new_user.id,
            matches_score=0,
            groups_score=0,
            third_place_score=0,
            knockout_score=0,
            penalty=0,
            total_points=0
        )
        
        db.add(user_scores)
        db.commit()
        
        # Create access token
        access_token = AuthService.create_access_token(new_user.id, new_user.username)
        
        return {
            "user_id": new_user.id,
            "username": new_user.username,
            "name": new_user.name,
            "access_token": access_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    def login_user(db: Session, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user and return access token."""
        # Find user by username
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )
        
        # Verify password
        if not AuthService.verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        # Create access token
        access_token = AuthService.create_access_token(user.id, user.username)
        
        return {
            "user_id": user.id,
            "username": user.username,
            "name": user.name,
            "access_token": access_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    def get_current_user(db: Session, token: str) -> User:
        """Get current user from token."""
        payload = AuthService.verify_token(token)
        user_id = payload.get("user_id")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )
        
        return user
