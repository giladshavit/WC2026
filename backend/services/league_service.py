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
    def create_league(db: Session, user_id: int, name: str, description: Optional[str] = None, score_mode: str = "multi") -> Dict[str, Any]:
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
                description=description,
                score_mode=score_mode,
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
                "member_count": 1,
                "score_mode": new_league.score_mode.value if hasattr(new_league.score_mode, 'value') else new_league.score_mode,
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
            from sqlalchemy import func
            from models.league import League, LeagueMembership

            # Single query: get leagues + member counts in one shot
            rows = (
                db.query(
                    League,
                    LeagueMembership.joined_at,
                    func.count(LeagueMembership.id).over(
                        partition_by=LeagueMembership.league_id
                    ).label("member_count"),
                )
                .join(LeagueMembership, League.id == LeagueMembership.league_id)
                .filter(LeagueMembership.user_id == user_id, League.is_active == True)
                .all()
            )

            leagues = []
            print(f"[DEBUG] get_user_leagues called for user_id={user_id}, rows_count={len(rows)}")
            for league, joined_at, member_count in rows:
                leagues.append({
                    "id": league.id,
                    "name": league.name,
                    "description": league.description,
                    "invite_code": league.invite_code,
                    "created_by": league.created_by,
                    "created_at": league.created_at.isoformat(),
                    "member_count": member_count,
                    "joined_at": joined_at.isoformat(),
                    "score_mode": league.score_mode.value if hasattr(league.score_mode, 'value') else league.score_mode,
                })
                print(f"[DEBUG] appended league id={league.id} name={league.name}")

            return leagues

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get user leagues: {str(e)}"
            )
    
    @staticmethod
    def _format_standing_row(
        rank: int,
        user,
        scores,
        membership=None,
        exact_count: int = 0,
        correct_count: int = 0,
        wrong_count: int = 0,
    ) -> Dict[str, Any]:
        return {
            "rank": rank,
            "user_id": user.id,
            "username": user.username,
            "name": user.name,
            "total_points": scores.total_points if scores else 0,
            "matches_points": scores.matches_score if scores else 0,
            "groups_points": scores.groups_score if scores else 0,
            "third_place_points": scores.third_place_score if scores else 0,
            "knockout_points": scores.knockout_score if scores else 0,
            "bonus_points": (scores.bonus_score or 0) if scores else 0,
            "classic_total_points": scores.classic_total_score if scores else 0,
            "penalty": scores.penalty if scores else 0,
            "joined_at": membership.joined_at.isoformat() if membership else None,
            "matches_exact_count": exact_count,
            "matches_correct_count": correct_count,
            "matches_wrong_count": wrong_count,
        }

    @staticmethod
    def get_global_standings(
        db: Session,
        current_user_id: int,
        sort_by: str = "total",
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        score_mode = "multi"  # Global has no league; default to multi
        rows, total = DBReader.get_global_standings_paginated(db, sort_by, page, page_size, score_mode=score_mode)
        offset = (page - 1) * page_size
        standings = [
            LeagueService._format_standing_row(
                offset + i + 1, row[0], row[1],
                exact_count=row[2] if len(row) > 2 else 0,
                correct_count=row[3] if len(row) > 3 else 0,
                wrong_count=row[4] if len(row) > 4 else 0,
            )
            for i, row in enumerate(rows)
        ]
        user_rank = DBReader.get_user_global_rank(db, current_user_id, sort_by, score_mode=score_mode)
        current_user_in_page = next((s for s in standings if s["user_id"] == current_user_id), None)
        if current_user_in_page:
            current_user_entry = current_user_in_page
        else:
            user_row = DBReader.get_user_global_standing_row(db, current_user_id)
            current_user_entry = LeagueService._format_standing_row(
                user_rank, user_row[0], user_row[1],
                exact_count=user_row[2] if user_row and len(user_row) > 2 else 0,
                correct_count=user_row[3] if user_row and len(user_row) > 3 else 0,
                wrong_count=user_row[4] if user_row and len(user_row) > 4 else 0,
            ) if user_row else None

        return {
            "standings": standings,
            "total_count": total,
            "page": page,
            "page_size": page_size,
            "current_user_entry": current_user_entry,
        }

    @staticmethod
    def get_league_standings(
        db: Session,
        league_id: int,
        current_user_id: int,
        sort_by: str = "total",
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        league = DBReader.get_active_league_by_id(db, league_id)
        if not league:
            raise HTTPException(status_code=404, detail="League not found")

        score_mode = league.score_mode.value if hasattr(league.score_mode, 'value') else league.score_mode
        rows, total = DBReader.get_league_standings_paginated(db, league_id, sort_by, page, page_size, score_mode=score_mode)
        offset = (page - 1) * page_size
        standings = [
            LeagueService._format_standing_row(
                offset + i + 1, row[0], row[1], row[2],
                exact_count=row[3] if len(row) > 3 else 0,
                correct_count=row[4] if len(row) > 4 else 0,
                wrong_count=row[5] if len(row) > 5 else 0,
            )
            for i, row in enumerate(rows)
        ]
        user_rank = DBReader.get_user_league_rank(db, current_user_id, league_id, sort_by, score_mode=score_mode)
        current_user_in_page = next((s for s in standings if s["user_id"] == current_user_id), None)
        if current_user_in_page:
            current_user_entry = current_user_in_page
        else:
            user_row = DBReader.get_user_league_standing_row(db, current_user_id, league_id)
            current_user_entry = LeagueService._format_standing_row(
                user_rank, user_row[0], user_row[1], user_row[2],
                exact_count=user_row[3] if user_row and len(user_row) > 3 else 0,
                correct_count=user_row[4] if user_row and len(user_row) > 4 else 0,
                wrong_count=user_row[5] if user_row and len(user_row) > 5 else 0,
            ) if user_row else None

        return {
            "standings": standings,
            "total_count": total,
            "page": page,
            "page_size": page_size,
            "current_user_entry": current_user_entry,
        }
    
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
                "member_count": member_count,
                "score_mode": league.score_mode.value if hasattr(league.score_mode, 'value') else league.score_mode,
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get league info: {str(e)}"
            )

    @staticmethod
    def get_league_match_predictions(db: Session, league_id: int, match_id: int) -> Dict[str, Any]:
        """Get all league members' predictions for a match. Only when match has started (live/finished)."""
        match = DBReader.get_match(db, match_id)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Match not found"
            )
        if match.status == "scheduled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Match has not started yet"
            )

        league = DBReader.get_active_league_by_id(db, league_id)
        if not league:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="League not found"
            )

        rows = DBReader.get_league_match_predictions(db, league_id, match_id)
        match_result = DBReader.get_match_result(db, match_id)

        actual_result = None
        if match_result and match_result.home_team_score is not None and match_result.away_team_score is not None:
            actual_result = {
                "home_score": match_result.home_team_score,
                "away_score": match_result.away_team_score,
            }

        predictions = []
        for user, pred in rows:
            if pred:
                pred_status = pred.status if pred.status else None
                predictions.append({
                    "user_id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "home_score": pred.home_score,
                    "away_score": pred.away_score,
                    "points": pred.points if pred.points is not None else 0,
                    "prediction_status": pred_status,
                    "is_tempted": bool(pred.is_tempted) if pred else False,
                })
            else:
                predictions.append({
                    "user_id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "home_score": None,
                    "away_score": None,
                    "points": 0,
                    "prediction_status": None,
                    "is_tempted": False,
                })

        return {
            "match_id": match_id,
            "match_status": match.status,
            "actual_result": actual_result,
            "predictions": predictions,
        }

    @staticmethod
    def get_global_match_predictions(db: Session, match_id: int) -> Dict[str, Any]:
        """Get all users' predictions for a match (global league). Same shape as get_league_match_predictions."""
        match = DBReader.get_match(db, match_id)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Match not found"
            )
        if match.status == "scheduled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Match has not started yet"
            )

        rows = DBReader.get_global_match_predictions(db, match_id)
        match_result = DBReader.get_match_result(db, match_id)

        actual_result = None
        if match_result and match_result.home_team_score is not None and match_result.away_team_score is not None:
            actual_result = {
                "home_score": match_result.home_team_score,
                "away_score": match_result.away_team_score,
            }

        predictions = []
        for user, pred in rows:
            if pred:
                pred_status = pred.status if pred.status else None
                predictions.append({
                    "user_id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "home_score": pred.home_score,
                    "away_score": pred.away_score,
                    "points": pred.points if pred.points is not None else 0,
                    "prediction_status": pred_status,
                    "is_tempted": bool(pred.is_tempted) if pred else False,
                })
            else:
                predictions.append({
                    "user_id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "home_score": None,
                    "away_score": None,
                    "points": 0,
                    "prediction_status": None,
                    "is_tempted": False,
                })

        return {
            "match_id": match_id,
            "match_status": match.status,
            "actual_result": actual_result,
            "predictions": predictions,
        }

    @staticmethod
    def leave_league(db: Session, user_id: int, league_id: int) -> None:
        """Remove a user from a league."""
        membership = DBReader.get_league_membership(db, league_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="You are not a member of this league"
            )

        league = DBReader.get_active_league_by_id(db, league_id)
        if league and league.created_by == user_id:
            member_count = DBReader.get_league_membership_count(db, league_id)
            if member_count == 1:
                # Last member — delete the league
                DBWriter.delete_league(db, league_id)
            else:
                # Transfer ownership to the earliest-joining other member
                all_memberships = DBReader.get_league_memberships_by_league(db, league_id)
                other_memberships = [m for m in all_memberships if m.user_id != user_id]
                other_memberships.sort(key=lambda m: m.joined_at)
                new_owner_id = other_memberships[0].user_id
                # Update league owner
                DBWriter.update_league_owner(db, league_id, new_owner_id)
                # Remove the leaving member
                DBWriter.delete_league_membership(db, membership)
        else:
            DBWriter.delete_league_membership(db, membership)

        DBUtils.commit(db)
