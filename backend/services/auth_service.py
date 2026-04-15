from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import jwt
import bcrypt
import random
import string
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from fastapi import HTTPException, status
from models.user import User
from models.user_scores import UserScores
from models.matches_template import MatchTemplate
from models.results import KnockoutStageResult
from models.predictions import KnockoutStagePrediction
from services.database import DBReader, DBWriter, DBUtils
from services.email_service import EmailService
from services.stage_manager import StageManager

class AuthService:
    """Service for handling user authentication and authorization."""
    
    # JWT Configuration
    SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS = 90  # Covers full World Cup tournament
    
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
    def _initialize_new_user(db: Session, new_user: User) -> None:
        """Post-creation setup: scores, knockout/group/third/match/bonus predictions."""
        # Create user scores entry automatically
        current_stage = StageManager.get_current_stage(db)
        DBWriter.create_user_scores(db, new_user.id, free_changes=current_stage.cumulative_free_changes())
        DBUtils.commit(db)

        # Create empty knockout predictions for the new user
        try:
            from services.predictions.knockout_service import KnockoutService
            created_predictions = KnockoutService.create_user_knockout_predictions(
                db, new_user.id
            )
            KnockoutService.apply_free_bracket_reset_for_new_user(db, new_user.id)
            DBUtils.commit(db)
            print(f"Created {len(created_predictions)} empty knockout predictions for user {new_user.id}")
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Warning: Failed to create knockout predictions for user {new_user.id}: {e}")

        # Create empty group predictions for the new user
        try:
            from services.predictions.group_prediction_service import GroupPredictionService
            created_groups = GroupPredictionService.create_user_group_predictions(db, new_user.id)
            DBUtils.commit(db)
            print(f"Created {created_groups} empty group predictions for user {new_user.id}")
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Warning: Failed to create group predictions for user {new_user.id}: {e}")

        # Create empty third place prediction for the new user
        try:
            from services.predictions.third_place_prediction_service import ThirdPlacePredictionService
            created_third = ThirdPlacePredictionService.create_user_third_place_prediction(db, new_user.id)
            DBUtils.commit(db)
            print(f"Created third place prediction for user {new_user.id}: {created_third}")
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Warning: Failed to create third place prediction for user {new_user.id}: {e}")

        # Create empty match predictions for all group-stage matches
        try:
            from services.predictions.match_prediction_service import MatchPredictionService
            created_match_preds = MatchPredictionService.create_user_match_predictions(db, new_user.id)
            DBUtils.commit(db)
            print(f"Created {created_match_preds} empty match predictions for user {new_user.id}")
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Warning: Failed to create match predictions for user {new_user.id}: {e}")

        # Create empty bonus prediction for the new user
        try:
            from services.predictions.bonus_prediction_service import BonusPredictionService
            BonusPredictionService.get_or_create_bonus_prediction(db, new_user.id)
            DBUtils.commit(db)
            print(f"Created bonus prediction for user {new_user.id}")
        except Exception as e:
            DBUtils.rollback(db)
            print(f"Warning: Failed to create bonus prediction for user {new_user.id}: {e}")

    @staticmethod
    def register_user(
        db: Session, username: str, password: str, name: str, email: str
    ) -> Dict[str, Any]:
        """Register a new user."""
        # Check if username already exists
        existing_user = DBReader.get_user_by_username(db, username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        existing_email = DBReader.get_user_by_email(db, email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        password_hash = AuthService.hash_password(password)
        
        # Create new user
        new_user = DBWriter.create_user(
            db,
            username=username,
            password_hash=password_hash,
            name=name,
            email=email
        )
        
        DBUtils.commit(db)
        DBUtils.refresh(db, new_user)

        AuthService._initialize_new_user(db, new_user)

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
        # Find user by username, or by email (login field may contain either)
        user = DBReader.get_user_by_username(db, username)
        if not user:
            user = DBReader.get_user_by_email(db, username.strip().lower())
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

        if user.password_hash is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account uses Google or Apple sign-in. Please use the social login button.",
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
    def social_auth_google(
        db: Session,
        id_token: str,
        username: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Handle Google Sign-In.
        - Verify the Google ID token
        - If google_id exists in DB → login (return JWT)
        - If email exists in DB (registered normally) → raise 409 with detail "email_exists"
        - If new user → require username+name, create user and return JWT with needs_registration=False
        - If new user but no username provided → return needs_registration=True with google_id and email
        """
        client_ids = [
            x.strip()
            for x in os.environ.get("GOOGLE_CLIENT_ID", "").split(",")
            if x.strip()
        ]
        if not client_ids:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GOOGLE_CLIENT_ID is not configured",
            )
        idinfo = None
        for cid in client_ids:
            try:
                idinfo = google_id_token.verify_oauth2_token(
                    id_token, google_requests.Request(), audience=cid
                )
                break
            except ValueError:
                continue
        if idinfo is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token",
            )

        google_id = idinfo.get("sub")
        if not google_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token",
            )

        email_raw = idinfo.get("email")
        email = email_raw.strip().lower() if email_raw else None

        user_by_google = (
            db.query(User).filter(User.google_id == google_id).first()
        )
        if user_by_google:
            if not user_by_google.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User account is disabled",
                )
            DBWriter.update_user_last_login(db, user_by_google, datetime.utcnow())
            DBUtils.commit(db)
            access_token = AuthService.create_access_token(
                user_by_google.id, user_by_google.username
            )
            return {
                "user_id": user_by_google.id,
                "username": user_by_google.username,
                "name": user_by_google.name,
                "access_token": access_token,
                "token_type": "bearer",
                "needs_registration": False,
            }

        if email:
            existing_email = DBReader.get_user_by_email(db, email)
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="email_exists",
                )

        uname = (username or "").strip()
        display_name = (name or "").strip()
        if not uname or not display_name:
            return {
                "needs_registration": True,
                "google_id": google_id,
                "email": email,
            }

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google",
            )

        existing_username = DBReader.get_user_by_username(db, uname)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )

        new_user = User(
            username=uname,
            password_hash=None,
            name=display_name,
            email=email,
            google_id=google_id,
        )
        db.add(new_user)
        db.flush()
        db.refresh(new_user)
        DBUtils.commit(db)

        AuthService._initialize_new_user(db, new_user)

        access_token = AuthService.create_access_token(new_user.id, new_user.username)
        return {
            "user_id": new_user.id,
            "username": new_user.username,
            "name": new_user.name,
            "access_token": access_token,
            "token_type": "bearer",
            "needs_registration": False,
        }

    @staticmethod
    def social_auth_apple(
        db: Session,
        identity_token: str,
        username: Optional[str] = None,
        name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Handle Apple Sign-In.
        - Verify the Apple identity token (JWT, decode without verification for now — Apple public key verification is complex, use PyJWT decode with options={"verify_signature": False})
        - Extract apple_id (sub field) and email if present
        - If apple_id exists in DB → login (return JWT)
        - If email exists in DB (registered normally) → raise 409 with detail "email_exists"
        - If new user → require username+name, create user and return JWT with needs_registration=False
        - If new user but no username provided → return needs_registration=True with apple_id and email
        """
        try:
            decoded = jwt.decode(
                identity_token,
                "",
                algorithms=["RS256", "ES256", "HS256"],
                options={"verify_signature": False},
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Apple token",
            )

        apple_id = decoded.get("sub")
        if not apple_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Apple token",
            )

        token_email = decoded.get("email")
        resolved_email = (token_email or email or "").strip() or None
        if resolved_email:
            resolved_email = resolved_email.lower()

        user_by_apple = db.query(User).filter(User.apple_id == apple_id).first()
        if user_by_apple:
            if not user_by_apple.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User account is disabled",
                )
            DBWriter.update_user_last_login(db, user_by_apple, datetime.utcnow())
            DBUtils.commit(db)
            access_token = AuthService.create_access_token(
                user_by_apple.id, user_by_apple.username
            )
            return {
                "user_id": user_by_apple.id,
                "username": user_by_apple.username,
                "name": user_by_apple.name,
                "access_token": access_token,
                "token_type": "bearer",
                "needs_registration": False,
            }

        if resolved_email:
            existing_email = DBReader.get_user_by_email(db, resolved_email)
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="email_exists",
                )

        uname = (username or "").strip()
        display_name = (name or "").strip()
        if not uname or not display_name:
            return {
                "needs_registration": True,
                "apple_id": apple_id,
                "email": resolved_email,
            }

        if not resolved_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required to complete registration",
            )

        existing_username = DBReader.get_user_by_username(db, uname)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )

        new_user = User(
            username=uname,
            password_hash=None,
            name=display_name,
            email=resolved_email,
            apple_id=apple_id,
        )
        db.add(new_user)
        db.flush()
        db.refresh(new_user)
        DBUtils.commit(db)

        AuthService._initialize_new_user(db, new_user)

        access_token = AuthService.create_access_token(new_user.id, new_user.username)
        return {
            "user_id": new_user.id,
            "username": new_user.username,
            "name": new_user.name,
            "access_token": access_token,
            "token_type": "bearer",
            "needs_registration": False,
        }

    @staticmethod
    def request_password_reset(db: Session, email: str) -> None:
        """Step 1: user submits email. Always return success (don't reveal if email exists)."""
        user = DBReader.get_user_by_email(db, email)
        if not user:
            return  # Silent — don't reveal email existence

        otp_code = ''.join(random.choices(string.digits, k=6))
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        DBWriter.invalidate_password_reset_tokens(db, user.id)
        DBWriter.create_password_reset_token(db, user.id, otp_code, expires_at)
        DBUtils.commit(db)

        EmailService.send_otp_email(user.email, otp_code, user.username)

    @staticmethod
    def reset_password_with_otp(db: Session, email: str, otp_code: str, new_password: str) -> None:
        """Step 2: user submits OTP + new password."""
        if len(new_password) < 6 or len(new_password) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be 6–20 characters",
            )

        user = DBReader.get_user_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid code or email",
            )

        token = DBReader.get_password_reset_token(db, user.id, otp_code)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired code",
            )

        new_hash = AuthService.hash_password(new_password)
        DBWriter.update_user_password(db, user, new_hash)
        DBWriter.invalidate_password_reset_tokens(db, user.id)
        DBUtils.commit(db)
    
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