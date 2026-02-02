from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt
import bcrypt
from fastapi import HTTPException, status
from models.user import User
from models.user_scores import UserScores
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult
from models.predictions import KnockoutStagePrediction
from services.database import DBReader, DBWriter, DBUtils

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
        existing_user = DBReader.get_user_by_username(db, username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        
        # Hash password
        password_hash = AuthService.hash_password(password)
        
        # Create new user
        new_user = DBWriter.create_user(
            db,
            username=username,
            password_hash=password_hash,
            name=name,
            email=f"{username}@temp.com"
        )
        
        DBUtils.commit(db)
        DBUtils.refresh(db, new_user)
        
        # Create user scores entry automatically
        DBWriter.create_user_scores(db, new_user.id)
        DBUtils.commit(db)
        
        # Create empty knockout predictions for the new user
        try:
            from services.predictions.knockout_service import KnockoutService
            created_predictions = KnockoutService.create_user_knockout_predictions(
                db, new_user.id
            )
            DBUtils.commit(db)
            print(f"Created {len(created_predictions)} empty knockout predictions for user {new_user.id}")
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Warning: Failed to create knockout predictions for user {new_user.id}: {e}")
        
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
        user = DBReader.get_user_by_username(db, username)
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
        DBWriter.update_user_last_login(db, user, datetime.utcnow())
        DBUtils.commit(db)
        
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
        
        user = DBReader.get_user(db, user_id)
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
    
    @staticmethod
    def _create_empty_knockout_predictions(db: Session, user_id: int) -> None:
        """
        Create empty knockout prediction records for a new user.
        This creates prediction records for all knockout matches without teams.
        First deletes any existing predictions to ensure clean state.
        """
        try:
            # Delete all existing knockout predictions for this user first
            existing_predictions = DBReader.get_knockout_predictions_by_user(
                db, user_id, stage=None, is_draft=False
            )
            
            if existing_predictions:
                for prediction in existing_predictions:
                    DBWriter.delete_knockout_prediction(db, prediction)
                DBUtils.flush(db)
            
            # Get all knockout match templates
            knockout_templates = DBReader.get_match_templates_by_stages_ordered(
                db, ["round32", "round16", "quarter", "semi", "final", "third_place"]
            )
            
            created_count = 0
            skipped_count = 0
            
            for template in knockout_templates:
                # Find the corresponding KnockoutStageResult
                knockout_result = DBReader.get_knockout_result(db, template.id)
                
                if not knockout_result:
                    # If result doesn't exist, skip this template
                    skipped_count += 1
                    continue
                
                # Create empty prediction (no teams, no winner)
                DBWriter.create_knockout_prediction(
                    db,
                    user_id,
                    knockout_result.id,
                    template.id,
                    template.stage,
                    is_draft=False,
                    team1_id=None,
                    team2_id=None,
                    winner_team_id=None,
                    status="gray",
                    is_editable=True
                )
                created_count += 1
            
            DBUtils.commit(db)
            print(f"Created {created_count} empty knockout predictions for user {user_id} (skipped {skipped_count})")
            
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Error creating knockout predictions for user {user_id}: {e}")
            # Don't raise exception - user creation should succeed even if predictions fail