import random
import string
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from models.league import League, LeagueMembership
from models.user import User
from models.user_scores import UserScores
from services.database import DBReader, DBWriter, DBUtils

class LeagueService:
    
    @staticmethod
    def generate_invite_code() -> str:
        """Generate a unique 8-character invite code."""
        while True:
            # Generate 8-character code with uppercase letters and numbers
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            return code
    
    @staticmethod
    def create_league(db: Session, user_id: int, name: str, description: Optional[str] = None) -> Dict[str, Any]:
        """Create a new league and automatically join the creator."""
        try:
            # Generate unique invite code
            invite_code = LeagueService.generate_invite_code()
            
            # Check if code already exists (very unlikely but safe)
            while DBReader.get_league_by_invite_code(db, invite_code):
                invite_code = LeagueService.generate_invite_code()
            
            # Create the league
            new_league = DBWriter.create_league(
                db,
                name=name,
                created_by=user_id,
                invite_code=invite_code,
                description=description
            )
            
            DBUtils.commit(db)
            DBUtils.refresh(db, new_league)
            
            # Automatically join the creator to the league
            DBWriter.create_league_membership(db, new_league.id, user_id)
            DBUtils.commit(db)
            
            return {
                "id": new_league.id,
                "name": new_league.name,
                "description": new_league.description,
                "invite_code": new_league.invite_code,
                "created_by": new_league.created_by,
                "created_at": new_league.created_at.isoformat(),
                "member_count": 1
            }
            
        except Exception as e:
            DBUtils.rollback(db)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create league: {str(e)}"
            )
    
    @staticmethod
    def join_league_by_code(db: Session, user_id: int, invite_code: str) -> Dict[str, Any]:
        """Join a league using an invite code."""
        try:
            # Find the league by invite code
            league = DBReader.get_active_league_by_invite_code(db, invite_code)
            
            if not league:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Invalid or inactive invite code"
                )
            
            # Check if user is already a member
            existing_membership = DBReader.get_league_membership(db, league.id, user_id)
            
            if existing_membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already a member of this league"
                )
            
            # Add user to the league
            membership = DBWriter.create_league_membership(db, league.id, user_id)
            DBUtils.commit(db)
            
            return {
                "league_id": league.id,
                "league_name": league.name,
                "joined_at": membership.joined_at.isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            DBUtils.rollback(db)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to join league: {str(e)}"
            )
    
    @staticmethod
    def get_user_leagues(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """Get all leagues that a user is a member of."""
        try:
            memberships = DBReader.get_league_memberships_by_user(db, user_id)
            
            leagues = []
            for membership in memberships:
                league = membership.league
                if league and league.is_active:
                    # Count members
                    member_count = DBReader.get_league_membership_count(db, league.id)
                    
                    leagues.append({
                        "id": league.id,
                        "name": league.name,
                        "description": league.description,
                        "invite_code": league.invite_code,
                        "created_by": league.created_by,
                        "created_at": league.created_at.isoformat(),
                        "member_count": member_count,
                        "joined_at": membership.joined_at.isoformat()
                    })
            
            return leagues
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get user leagues: {str(e)}"
            )
    
    @staticmethod
    def get_global_standings(db: Session) -> List[Dict[str, Any]]:
        """Get global standings (all users from user_scores)."""
        try:
            # Get all users with their scores using LEFT JOIN, ordered by total points descending
            standings = DBReader.get_global_standings(db)
            
            result = []
            for rank, (user, scores) in enumerate(standings, 1):
                # Handle users without scores (scores will be None)
                total_points = scores.total_points if scores else 0
                matches_points = scores.matches_score if scores else 0
                groups_points = scores.groups_score if scores else 0
                third_place_points = scores.third_place_score if scores else 0
                knockout_points = scores.knockout_score if scores else 0
                
                result.append({
                    "rank": rank,
                    "user_id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "total_points": total_points,
                    "matches_points": matches_points,
                    "groups_points": groups_points,
                    "third_place_points": third_place_points,
                    "knockout_points": knockout_points
                })
            
            return result
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get global standings: {str(e)}"
            )
    
    @staticmethod
    def get_league_standings(db: Session, league_id: int) -> List[Dict[str, Any]]:
        """Get league standings (only league members with their scores)."""
        try:
            # Verify league exists
            league = DBReader.get_active_league_by_id(db, league_id)
            
            if not league:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="League not found"
                )
            
            # Get league members with their scores using LEFT JOIN
            standings = DBReader.get_league_standings(db, league_id)
            
            result = []
            for rank, (user, scores, membership) in enumerate(standings, 1):
                # Handle users without scores (scores will be None)
                total_points = scores.total_points if scores else 0
                matches_points = scores.matches_score if scores else 0
                groups_points = scores.groups_score if scores else 0
                third_place_points = scores.third_place_score if scores else 0
                knockout_points = scores.knockout_score if scores else 0
                
                result.append({
                    "rank": rank,
                    "user_id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "total_points": total_points,
                    "matches_points": matches_points,
                    "groups_points": groups_points,
                    "third_place_points": third_place_points,
                    "knockout_points": knockout_points,
                    "joined_at": membership.joined_at.isoformat()
                })
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get league standings: {str(e)}"
            )
    
    @staticmethod
    def get_league_info(db: Session, league_id: int) -> Dict[str, Any]:
        """Get basic league information."""
        try:
            league = DBReader.get_active_league_by_id(db, league_id)
            
            if not league:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="League not found"
                )
            
            # Count members
            member_count = DBReader.get_league_membership_count(db, league_id)
            
            return {
                "id": league.id,
                "name": league.name,
                "description": league.description,
                "invite_code": league.invite_code,
                "created_by": league.created_by,
                "created_at": league.created_at.isoformat(),
                "member_count": member_count
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get league info: {str(e)}"
            )
