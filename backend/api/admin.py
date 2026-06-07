from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from services.auth_service import AuthService
from services.predictions.match_prediction_service import MatchPredictionService
from services.team_service import TeamService
from services.group_service import GroupService
from services.results_service import ResultsService
from services.stage_manager import StageManager, Stage
from services.database import DBReader, DBWriter, DBUtils
from models.groups import Group
from models.matches import Match, MatchStatus
from models.team import Team
from models.user import User
from database import get_db
from services.settings_service import get_stats_ads_enabled, set_stats_ads_enabled

router = APIRouter()
security = HTTPBearer()


def get_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        user = AuthService.get_current_user(db, credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    if user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user

# Pydantic models for request validation
class GroupStageMatchRequest(BaseModel):
    pass  # deprecated

class KnockoutMatchRequest(BaseModel):
    pass  # deprecated

class TeamRequest(BaseModel):
    name: str

class MultipleTeamsRequest(BaseModel):
    teams: List[TeamRequest]

class UpdateTeamGroupRequest(BaseModel):
    team_id: int
    group_letter: str
    group_position: int


class AdminSettingsRequest(BaseModel):
    stats_ads_enabled: bool


@router.put("/admin/settings", response_model=Dict[str, Any])
def update_admin_settings(
    request: AdminSettingsRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    set_stats_ads_enabled(db, request.stats_ads_enabled)
    return {"stats_ads_enabled": get_stats_ads_enabled(db)}


@router.post("/admin/teams", response_model=Dict[str, Any])
def create_team(team_request: TeamRequest, db: Session = Depends(get_db)):
    """
    Create a new team (admin only)
    """
    result = TeamService.create_team(
        db, 
        team_request.name
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/admin/teams/batch", response_model=Dict[str, Any])
def create_multiple_teams(teams_request: MultipleTeamsRequest, db: Session = Depends(get_db)):
    """
    Create multiple teams at once (admin only)
    """
    teams_data = [
        {
            "name": team.name
        }
        for team in teams_request.teams
    ]
    
    result = TeamService.create_multiple_teams(db, teams_data)
    return result

@router.put("/admin/teams/{team_id}/group", response_model=Dict[str, Any])
def update_team_group(team_id: int, group_request: UpdateTeamGroupRequest, db: Session = Depends(get_db)):
    """
    Update a team with its group information (admin only)
    """
    result = TeamService.update_team_group(
        db, 
        team_id, 
        group_request.group_letter, 
        group_request.group_position
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/teams", response_model=List[Dict[str, Any]])
def get_all_teams(db: Session = Depends(get_db)):
    """
    Get all teams (admin only)
    """
    return TeamService.get_all_teams(db)

@router.post("/admin/matches/group-stage", response_model=Dict[str, Any])
def create_group_stage_match():
    raise HTTPException(status_code=410, detail="Deprecated: matches are created by scripts")

@router.post("/admin/matches/knockout", response_model=Dict[str, Any])
def create_knockout_match():
    raise HTTPException(status_code=410, detail="Deprecated: matches are created by scripts")

# Group management endpoints
@router.post("/admin/groups", response_model=Dict[str, Any])
def create_group(group_name: str, db: Session = Depends(get_db)):
    """
    Create a new group (admin only)
    """
    result = GroupService.create_group(db, group_name)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/groups", response_model=List[Dict[str, Any]])
def get_all_groups(db: Session = Depends(get_db)):
    """
    Get all groups (admin only)
    """
    return GroupService.get_all_groups(db)

@router.post("/admin/groups/{group_id}/results", response_model=Dict[str, Any])
def create_group_result(
    group_id: int,
    team_id: int,
    position: int,
    points: int = 0,
    goals_for: int = 0,
    goals_against: int = 0,
    db: Session = Depends(get_db)
):
    """
    Create a result for a group (admin only)
    """
    result = GroupService.create_group_result(
        db, group_id, team_id, position, points, goals_for, goals_against
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/admin/groups/{group_id}/results", response_model=List[Dict[str, Any]])
def get_group_results(group_id: int, db: Session = Depends(get_db)):
    """
    Get group results (admin only)
    """
    return GroupService.get_group_results(db, group_id)

class UpdateGroupRequest(BaseModel):
    team_1: int
    team_2: int
    team_3: int
    team_4: int

class MatchResultRequest(BaseModel):
    home_team_score: int
    away_team_score: int
    home_team_score_120: Optional[int] = None
    away_team_score_120: Optional[int] = None
    home_team_penalties: Optional[int] = None
    away_team_penalties: Optional[int] = None
    outcome_type: str = "regular"

class MatchStatusRequest(BaseModel):
    status: str  # scheduled, live, finished
    outcome_type: str = "regular"

class GroupStageResultRequest(BaseModel):
    first_place_team_id: int
    second_place_team_id: int
    third_place_team_id: int
    fourth_place_team_id: int


class ThirdPlaceResultRequest(BaseModel):
    first_team_qualifying: int
    second_team_qualifying: int
    third_team_qualifying: int
    fourth_team_qualifying: int
    fifth_team_qualifying: int
    sixth_team_qualifying: int
    seventh_team_qualifying: int
    eighth_team_qualifying: int

@router.put("/admin/groups/{group_name}", response_model=Dict[str, Any])
def update_group(group_name: str, update_request: UpdateGroupRequest, db: Session = Depends(get_db)):
    """
    Update a group with its teams (admin only)
    """
    # Find group by name
    group = db.query(Group).filter(Group.name == group_name).first()
    if not group:
        raise HTTPException(status_code=404, detail=f"Group {group_name} not found")
    
    # Update teams
    group.team_1 = update_request.team_1
    group.team_2 = update_request.team_2
    group.team_3 = update_request.team_3
    group.team_4 = update_request.team_4
    
    db.commit()
    db.refresh(group)
    
    return {"id": group.id, "name": group.name, "updated": True}

# Match results endpoints
@router.get("/admin/matches/results", response_model=List[Dict[str, Any]])
def get_all_matches_with_results(db: Session = Depends(get_db)):
    """
    Get all matches with their current results (admin only)
    Only returns matches where both teams are defined
    """
    return ResultsService.get_all_matches_with_results(db)

@router.put("/admin/matches/{match_id}/result", response_model=Dict[str, Any])
def update_match_result(
    match_id: int, 
    result_request: MatchResultRequest, 
    db: Session = Depends(get_db)
):
    """
    Update or create a match result (admin only)
    """
    try:
        result = ResultsService.update_match_result(
            db=db,
            match_id=match_id,
            home_team_score=result_request.home_team_score,
            away_team_score=result_request.away_team_score,
            home_team_score_120=result_request.home_team_score_120,
            away_team_score_120=result_request.away_team_score_120,
            home_team_penalties=result_request.home_team_penalties,
            away_team_penalties=result_request.away_team_penalties,
            outcome_type=result_request.outcome_type
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/admin/matches/{match_id}/status", response_model=Dict[str, Any])
def update_match_status(
    match_id: int, 
    status_request: MatchStatusRequest, 
    db: Session = Depends(get_db)
):
    """
    Update match status (admin only)
    """
    try:
        # Validate status
        valid_statuses = [status.value for status in MatchStatus]
        if status_request.status not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status. Must be one of: {valid_statuses}"
            )
        
        result = MatchPredictionService.update_match_status(
            db=db,
            match_id=match_id,
            status=status_request.status
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Knockout results endpoints
@router.get("/admin/knockout/results", response_model=List[Dict[str, Any]])
def get_knockout_matches_with_results(db: Session = Depends(get_db)):
    """
    Get all knockout matches with their current results (admin only)
    Only returns matches where both teams are defined
    """
    return ResultsService.get_knockout_matches_with_results(db)

class KnockoutResultRequest(BaseModel):
    match_id: int
    team_1_id: int
    team_2_id: int
    winner_team_id: int

@router.put("/admin/knockout/result", response_model=Dict[str, Any])
def update_knockout_result(
    result_request: KnockoutResultRequest,
    db: Session = Depends(get_db)
):
    """
    Update or create a knockout stage result (admin only).
    This will:
    - Set match is_editable to False
    - Update/create knockout result
    - Process all predictions (award points if correct, invalidate if wrong)
    """
    try:
        result = ResultsService.update_knockout_result(
            db,
            result_request.match_id,
            result_request.team_1_id,
            result_request.team_2_id,
            result_request.winner_team_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Error updating knockout result: {str(e)}")

# Group results endpoints
@router.get("/admin/groups/results", response_model=List[Dict[str, Any]])
def get_all_groups_with_results(db: Session = Depends(get_db)):
    """
    Get all groups with their current results (admin only)
    """
    return ResultsService.get_all_groups_with_results(db)

@router.put("/admin/groups/{group_id}/result", response_model=Dict[str, Any])
def update_group_stage_result(
    group_id: int,
    result_request: GroupStageResultRequest,
    db: Session = Depends(get_db)
):
    """
    Update or create a group stage result (admin only)
    """
    try:
        result = ResultsService.update_group_stage_result(
            db=db,
            group_id=group_id,
            first_place_team_id=result_request.first_place_team_id,
            second_place_team_id=result_request.second_place_team_id,
            third_place_team_id=result_request.third_place_team_id,
            fourth_place_team_id=result_request.fourth_place_team_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/admin/third-place/results", response_model=Dict[str, Any])
def get_third_place_results(db: Session = Depends(get_db)):
    """
    Get current third place qualifying results (admin only)
    """
    return ResultsService.get_third_place_results(db)


@router.put("/admin/third-place/results", response_model=Dict[str, Any])
def update_third_place_result(
    request: ThirdPlaceResultRequest,
    db: Session = Depends(get_db)
):
    """
    Update or create third place qualifying results (admin only)
    """
    try:
        result = ResultsService.update_third_place_result(
            db=db,
            first_team_qualifying=request.first_team_qualifying,
            second_team_qualifying=request.second_team_qualifying,
            third_team_qualifying=request.third_team_qualifying,
            fourth_team_qualifying=request.fourth_team_qualifying,
            fifth_team_qualifying=request.fifth_team_qualifying,
            sixth_team_qualifying=request.sixth_team_qualifying,
            seventh_team_qualifying=request.seventh_team_qualifying,
            eighth_team_qualifying=request.eighth_team_qualifying
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Stage management endpoints
@router.get("/admin/stage/current")
def get_current_stage(db: Session = Depends(get_db)):
    """
    Get current tournament stage (admin only)
    """
    current_stage = StageManager.get_current_stage(db)
    return {
        "stage": current_stage.name,
        "stage_value": current_stage.value,
        "penalty": current_stage.get_penalty_for()
    }

@router.put("/admin/stage/update")
def update_tournament_stage(stage: str, db: Session = Depends(get_db)):
    """
    Update tournament stage to specific stage (admin only)
    """
    try:
        new_stage = Stage[stage.upper()]
        StageManager.set_current_stage(new_stage, db)
        return {
            "message": f"Stage updated to {stage}",
            "stage": new_stage.name,
            "stage_value": new_stage.value,
            "penalty": new_stage.get_penalty_for()
        }
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid stage")

@router.post("/admin/stage/advance")
def advance_tournament_stage(db: Session = Depends(get_db)):
    """
    Advance tournament stage by one (admin only)
    """ 
    new_stage = StageManager.advance_stage(db)
    return {
        "message": f"Stage advanced to {new_stage.name}",
        "stage": new_stage.name,
        "stage_value": new_stage.value,
        "penalty": new_stage.get_penalty_for()
    }

@router.post("/admin/stage/advance-to-group-stage")
def advance_to_group_stage(db: Session = Depends(get_db)):
    """
    Advance directly to GROUP_CYCLE_1 (first group stage cycle) if currently at PRE_GROUP_STAGE (admin only)
    """
    current_stage = StageManager.get_current_stage(db)

    if current_stage == Stage.PRE_GROUP_STAGE:
        StageManager.set_current_stage(Stage.GROUP_CYCLE_1, db)
        return {
            "message": "Stage advanced to GROUP_CYCLE_1 (Group Stage Cycle 1)",
            "stage": "GROUP_CYCLE_1",
            "stage_value": Stage.GROUP_CYCLE_1.value,
            "penalty": Stage.GROUP_CYCLE_1.get_penalty_for(),
            "previous_stage": "PRE_GROUP_STAGE"
        }
    else:
        return {
            "message": f"Already past PRE_GROUP_STAGE. Current stage: {current_stage.name}",
            "stage": current_stage.name,
            "stage_value": current_stage.value,
            "penalty": current_stage.get_penalty_for(),
            "skipped": True
        }

@router.post("/admin/stage/reset")
def reset_tournament_stage(db: Session = Depends(get_db)):
    """
    Reset tournament stage to beginning and make all predictions editable (admin only)
    """
    new_stage = StageManager.reset_stage(db)
    return {
        "message": "Tournament stage reset to beginning",
        "stage": new_stage.name,
        "stage_value": new_stage.value,
        "penalty": new_stage.get_penalty_for()
    }

@router.post("/admin/bracket/rebuild-round32", response_model=Dict[str, Any])
def rebuild_round32_bracket(db: Session = Depends(get_db)):
    """
    Rebuild Round of 32 bracket from results and update prediction statuses (admin only)
    This will:
    1. Build Round of 32 bracket from group and third place results
    2. Update Round of 32 prediction statuses
    3. Update prediction statuses for all subsequent knockout stages
    4. Update validity for all predictions (red/green indicators)
    """
    try:
        # Step 1: Build Round of 32 bracket from results
        print("🔧 Building Round of 32 bracket from results...")
        bracket_result = ResultsService.build_round32_bracket_from_results(db)
        print(f"✅ Bracket built: {bracket_result['matches_created']} created, {bracket_result['matches_updated']} updated")
        
        # Step 4: Update validity for all predictions
        print("🔧 Updating prediction validity...")
        from services.predictions.knockout_service import KnockoutService
        KnockoutService.initialize_all_knockout_statuses(db)
        db.commit()
        
        return {
            "message": "Round of 32 bracket rebuilt and all knockout statuses updated successfully",
            "bracket_rebuilt": True,
            "bracket_summary": bracket_result,
            "round32_statuses_updated": True,
            "subsequent_statuses_updated": True,
            "validity_updated": True
        }
        
    except Exception as e:
        print(f"❌ Error in rebuild_round32_bracket: {e}")
        from services.database import DBUtils
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Bonus prediction settle endpoints (admin only)
class BonusResultsRequest(BaseModel):
    g1_correct: Optional[str] = None
    g2_correct: Optional[str] = None
    g3_correct: Optional[str] = None
    g4_correct: Optional[str] = None
    g5_correct: Optional[str] = None
    g6_correct: Optional[str] = None
    k1_correct: Optional[str] = None
    k2_correct: Optional[str] = None
    k3_correct: Optional[str] = None
    t1_correct: Optional[str] = None
    t2_correct: Optional[str] = None
    t3_correct: Optional[str] = None


class BonusInterimRequest(BaseModel):
    g1_interim: Optional[str] = None
    g2_interim: Optional[str] = None
    g3_interim: Optional[str] = None
    g4_interim: Optional[str] = None
    g5_interim: Optional[str] = None
    g6_interim: Optional[str] = None
    k1_interim: Optional[str] = None
    k2_interim: Optional[str] = None
    k3_interim: Optional[str] = None
    t1_interim: Optional[str] = None
    t2_interim: Optional[str] = None
    t3_interim: Optional[str] = None


@router.post("/admin/bonus/settle-question", response_model=Dict[str, Any])
def settle_bonus_question(
    field_key: str = Body(...),
    correct_value: Optional[str] = Body(None),
    correct_values: Optional[list[str]] = Body(None),
    db: Session = Depends(get_db),
):
    """
    Grade all users for a single bonus question.
    field_key: g1..t2
    correct_values: list of correct answer strings (e.g. ["3"] or ["3","7"] for ties)
    correct_value: deprecated, use correct_values; if correct_values not provided, wraps this in a list
    """
    from services.predictions import BonusService

    if correct_values is not None:
        values = correct_values
    elif correct_value is not None:
        values = [correct_value]
    else:
        raise HTTPException(status_code=400, detail="Either correct_value or correct_values required")
    result = BonusService.settle_bonus_question(db, field_key, values)
    return result


@router.get("/admin/bonus/results", response_model=Dict[str, Any])
def get_bonus_results(db: Session = Depends(get_db)):
    """Get currently stored correct answers and interim values for all bonus questions (admin only)."""
    from models.results import BonusResults
    row = db.query(BonusResults).filter_by(id=1).first()
    fields = ["g1", "g2", "g3", "g4", "g5", "g6", "k1", "k2", "k3", "t1", "t2", "t3"]
    result = {}
    if not row:
        for f in fields:
            result[f"{f}_correct"] = None
            result[f"{f}_interim"] = None
    else:
        for f in fields:
            result[f"{f}_correct"] = getattr(row, f"{f}_correct", None)
            result[f"{f}_interim"] = getattr(row, f"{f}_interim", None)
    return result


@router.put("/admin/bonus/results", response_model=Dict[str, Any])
def update_bonus_results(
    request: BonusResultsRequest,
    db: Session = Depends(get_db),
):
    """
    Update correct answers for bonus questions and re-settle all predictions.
    Only fields provided in the request body are updated.
    Calls settle_bonus_question with force=True so corrections overwrite previous settlements.
    """
    from models.results import BonusResults
    from services.predictions import BonusService
    
    fields = ["g1", "g2", "g3", "g4", "g5", "g6", "k1", "k2", "k3", "t1", "t2", "t3"]

    row = db.query(BonusResults).filter_by(id=1).first()
    if not row:
        row = BonusResults(id=1)
        db.add(row)
        db.flush()

    updated_fields = []
    request_dict = request.model_dump()

    for field in fields:
        new_val = request_dict.get(f"{field}_correct")
        if new_val is None or new_val == "":
            continue  # skip fields not provided

        old_val = getattr(row, f"{field}_correct", None)
        setattr(row, f"{field}_correct", new_val)
        db.flush()

        correct_values = [v.strip() for v in new_val.split(",")]
        BonusService.settle_bonus_question(db, field, correct_values, force=True)

        updated_fields.append({
            "field": field,
            "old_value": old_val,
            "new_value": new_val,
        })

    DBUtils.commit(db)
    db.refresh(row)
    return {
        "updated": True,
        "fields_updated": len(updated_fields),
        "details": updated_fields,
    }


@router.put("/admin/bonus/interim", response_model=Dict[str, Any])
def update_bonus_interim(
    request: BonusInterimRequest,
    db: Session = Depends(get_db),
):
    """Update interim (live/current) values for bonus questions. Display-only, no scoring."""
    from services.database import DBWriter, DBUtils
    fields = ["g1", "g2", "g3", "g4", "g5", "g6", "k1", "k2", "k3", "t1", "t2", "t3"]
    updates = {}
    request_dict = request.model_dump()
    for f in fields:
        val = request_dict.get(f"{f}_interim")
        if val is not None:  # only update provided fields (None means "don't touch")
            updates[f] = val if val != "" else None
    if updates:
        DBWriter.set_bonus_interim_values_bulk(db, updates)
        DBUtils.commit(db)
    return {"updated": True, "fields_updated": len(updates), "updates": updates}


def _reset_knockout_results(db: Session) -> dict:
    """
    Reset knockout stage results and related match state to init state.
    Mirrors the state created by utils/start_game/create_knockout_results.py and create_matches.py.
    - KnockoutStageResult: reset team_1, team_2, winner_team_id to None (rows must NOT be deleted)
    - All knockout matches (round32 through final): reset home_team_id, away_team_id to None, status to 'not_scheduled'
    - Delete all MatchResult rows for knockout matches (IDs 73-104)
    - Reset is_eliminated for all teams to False
    """
    from models.results import KnockoutStageResult, MatchResult
    from models.matches import Match
    from models.team import Team

    KNOCKOUT_STAGES = ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place']

    # 1. Reset KnockoutStageResult rows
    knockout_results = db.query(KnockoutStageResult).all()
    for kr in knockout_results:
        kr.team_1 = None
        kr.team_2 = None
        kr.winner_team_id = None

    # 2. Reset knockout Match rows
    knockout_matches = db.query(Match).filter(Match.stage.in_(KNOCKOUT_STAGES)).all()
    knockout_match_ids = [m.id for m in knockout_matches]
    for match in knockout_matches:
        match.home_team_id = None
        match.away_team_id = None
        match.status = 'not_scheduled'

    # 3. Delete MatchResult rows for knockout matches
    deleted_match_results = db.query(MatchResult).filter(
        MatchResult.match_id.in_(knockout_match_ids)
    ).delete(synchronize_session=False)

    # 4. Reset is_eliminated for all teams
    eliminated_teams = db.query(Team).filter(Team.is_eliminated == True).all()
    for team in eliminated_teams:
        team.is_eliminated = False

    # 5. Reset knockout predictions to pre-result state (bulk, no loop)
    predictions_reset = DBWriter.reset_knockout_predictions_to_pre_result_state(db)

    db.flush()
    return {
        "knockout_results_reset": len(knockout_results),
        "knockout_matches_reset": len(knockout_matches),
        "match_results_deleted": deleted_match_results,
        "predictions_reset": predictions_reset,
    }


def _reset_all_results(db: Session) -> dict:
    """
    Reset ALL tournament results to init state.
    - GroupStageResult: delete all rows (not part of init state)
    - ThirdPlaceResult: delete all rows (not part of init state)
    - MatchResult: delete all rows (group + knockout)
    - KnockoutStageResult: reset to None (rows must NOT be deleted)
    - All knockout matches: reset home_team_id, away_team_id, status
    - is_eliminated: reset to False for all teams
    """
    from models.results import KnockoutStageResult, MatchResult, GroupStageResult, ThirdPlaceResult
    from models.matches import Match
    from models.team import Team

    KNOCKOUT_STAGES = ['round32', 'round16', 'quarter', 'semi', 'final', 'third_place']

    # 0. Clear FK from matches_template to allow knockout_stage_results reset (PostgreSQL)
    from sqlalchemy import text
    db.execute(text("UPDATE matches_template SET knockout_result_id = NULL"))

    # 1. Delete GroupStageResult rows
    deleted_group = db.query(GroupStageResult).delete(synchronize_session=False)

    # 2. Delete ThirdPlaceResult rows
    deleted_third_place = db.query(ThirdPlaceResult).delete(synchronize_session=False)

    # 3. Delete all MatchResult rows
    deleted_match_results = db.query(MatchResult).delete(synchronize_session=False)

    # 4. Reset KnockoutStageResult rows
    knockout_results = db.query(KnockoutStageResult).all()
    for kr in knockout_results:
        kr.team_1 = None
        kr.team_2 = None
        kr.winner_team_id = None

    # 5. Reset knockout Match rows
    knockout_matches = db.query(Match).filter(Match.stage.in_(KNOCKOUT_STAGES)).all()
    for match in knockout_matches:
        match.home_team_id = None
        match.away_team_id = None
        match.status = 'not_scheduled'

    # 6. Reset is_eliminated for all teams
    eliminated_teams = db.query(Team).filter(Team.is_eliminated == True).all()
    for team in eliminated_teams:
        team.is_eliminated = False

    db.flush()
    return {
        "group_results_deleted": deleted_group,
        "third_place_results_deleted": deleted_third_place,
        "match_results_deleted": deleted_match_results,
        "knockout_results_reset": len(knockout_results),
        "knockout_matches_reset": len(knockout_matches),
    }


@router.post("/admin/reset-all-results", response_model=Dict[str, Any])
def reset_all_results_and_scores(db: Session = Depends(get_db)):
    """
    Reset all results and user scores (admin only)
    This will:
    1. Delete all match results
    2. Delete all group stage results
    3. Delete all third place results
    4. Delete all knockout stage results
    5. Reset validity for all knockout predictions (set to True)
    6. Reset all user scores to zero
    7. Reset all match statuses to scheduled
    """
    try:
        import subprocess
        import os
        
        # Step 1: Delete all results using the existing script
        script_path = os.path.join(os.path.dirname(__file__), "..", "utils", "deletion", "delete_all_results.py")
        import sys
        python_path = sys.executable
        
        print(f"🔧 Running delete_all_results script...")
        print(f"Script path: {script_path}")
        print(f"Python path: {python_path}")
        
        process_result = subprocess.run(
            [python_path, script_path],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(__file__))
        )
        
        print(f"Script return code: {process_result.returncode}")
        if process_result.stdout:
            print(f"Script stdout: {process_result.stdout}")
        if process_result.stderr:
            print(f"Script stderr: {process_result.stderr}")
        
        if process_result.returncode != 0:
            raise Exception(f"Script failed with return code {process_result.returncode}: {process_result.stderr}")
        
        # Step 2: Recalculate knockout statuses using reachable logic
        from services.predictions.knockout_service import KnockoutService
        KnockoutService.initialize_all_knockout_statuses(db)
        validity_reset_count = 0
        print("✅ Recalculated knockout prediction statuses")
        
        # Step 3: Reset all user scores and prediction points
        scores_result = ResultsService.reset_all_user_scores(db)
        
        # Step 4: Reset match statuses to scheduled
        matches = db.query(Match).all()
        match_count = 0
        for match in matches:
            if match.status != "scheduled":
                match.status = "scheduled"
                match_count += 1
        
        db.commit()
        
        return {
            "message": "All results and scores reset successfully",
            "results_deleted": True,
            "knockout_validity_reset": validity_reset_count,
            "users_reset": scores_result["users_reset"],
            "match_predictions_reset": scores_result["match_predictions_reset"],
            "group_predictions_reset": scores_result["group_predictions_reset"],
            "third_place_predictions_reset": scores_result["third_place_predictions_reset"],
            "knockout_predictions_reset": scores_result["knockout_predictions_reset"],
            "matches_reset": match_count
        }
        
    except Exception as e:
        print(f"❌ Error in reset_all_results_and_scores: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/admin/delete-all-results", response_model=Dict[str, Any])
def delete_all_results_only(db: Session = Depends(get_db)):
    """
    Reset all tournament results to init state and reset user scores (admin only).
    See _reset_all_results for DB changes; then ResultsService.reset_all_user_scores.
    """
    try:
        reset_stats = _reset_all_results(db)
        scores_result = ResultsService.reset_all_user_scores(db)
        db.commit()
        return {
            "message": "All results deleted and scores reset successfully",
            "results_deleted": True,
            "group_results_deleted": reset_stats["group_results_deleted"],
            "third_place_results_deleted": reset_stats["third_place_results_deleted"],
            "match_results_deleted": reset_stats["match_results_deleted"],
            "knockout_results_reset": reset_stats["knockout_results_reset"],
            "knockout_matches_reset": reset_stats["knockout_matches_reset"],
            "users_reset": scores_result["users_reset"],
            "match_predictions_reset": scores_result["match_predictions_reset"],
            "group_predictions_reset": scores_result["group_predictions_reset"],
            "third_place_predictions_reset": scores_result["third_place_predictions_reset"],
            "knockout_predictions_reset": scores_result["knockout_predictions_reset"],
        }
        
    except Exception as e:
        print(f"❌ Error in delete_all_results_only: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/admin/delete-all-predictions", response_model=Dict[str, Any])
def delete_all_predictions(db: Session = Depends(get_db)):
    """
    Delete all predictions from all prediction tables (admin only)
    This will:
    1. Delete all match predictions
    2. Delete all group stage predictions
    3. Delete all third place predictions
    4. Delete all knockout stage predictions
    """
    try:
        from models.predictions import MatchPrediction, GroupStagePrediction, ThirdPlacePrediction, KnockoutStagePrediction
        
        # Count records before deletion
        match_pred_count = db.query(MatchPrediction).count()
        group_pred_count = db.query(GroupStagePrediction).count()
        third_place_pred_count = db.query(ThirdPlacePrediction).count()
        knockout_pred_count = db.query(KnockoutStagePrediction).count()
        
        total_before = match_pred_count + group_pred_count + third_place_pred_count + knockout_pred_count
        
        if total_before == 0:
            return {
                "message": "No predictions found to delete",
                "deleted": False,
                "match_predictions_deleted": 0,
                "group_predictions_deleted": 0,
                "third_place_predictions_deleted": 0,
                "knockout_predictions_deleted": 0
            }
        
        # Delete all predictions
        deleted_match = db.query(MatchPrediction).delete()
        deleted_group = db.query(GroupStagePrediction).delete()
        deleted_third_place = db.query(ThirdPlacePrediction).delete()
        deleted_knockout = db.query(KnockoutStagePrediction).delete()
        
        # Commit the changes
        db.commit()
        
        total_deleted = deleted_match + deleted_group + deleted_third_place + deleted_knockout
        
        return {
            "message": "All predictions deleted successfully",
            "deleted": True,
            "match_predictions_deleted": deleted_match,
            "group_predictions_deleted": deleted_group,
            "third_place_predictions_deleted": deleted_third_place,
            "knockout_predictions_deleted": deleted_knockout,
            "total_deleted": total_deleted
        }
    except Exception as e:
        print(f"❌ Error in delete_all_predictions: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/admin/backfill-match-predictions", response_model=Dict[str, Any])
def backfill_match_predictions(db: Session = Depends(get_db)):
    """
    One-time migration: create missing MatchPrediction rows for existing users.
    Creates empty predictions (home_score=None, away_score=None) for all group-stage
    matches for users who don't have them. Idempotent.
    """
    try:
        from utils.backfill_missing_match_predictions import backfill_missing_match_predictions
        result = backfill_missing_match_predictions(db)
        return {
            "message": "Backfill completed",
            "users_processed": result["users_processed"],
            "total_created": result["total_created"],
        }
    except Exception as e:
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/delete-all-knockout-predictions", response_model=Dict[str, Any])
def delete_all_knockout_predictions(db: Session = Depends(get_db)):
    """
    Delete all knockout stage predictions (admin only)
    """
    try:
        from models.predictions import KnockoutStagePrediction
        
        # Count records before deletion
        knockout_pred_count = db.query(KnockoutStagePrediction).count()
        
        if knockout_pred_count == 0:
            return {
                "message": "No knockout predictions found to delete",
                "deleted": False,
                "knockout_predictions_deleted": 0
            }
        
        # Delete all knockout predictions
        deleted_knockout = db.query(KnockoutStagePrediction).delete()
        
        # Commit the changes
        db.commit()
        
        return {
            "message": "All knockout predictions deleted successfully",
            "deleted": True,
            "knockout_predictions_deleted": deleted_knockout
        }
        
    except Exception as e:
        print(f"❌ Error in delete_all_knockout_predictions: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.delete("/admin/delete-user-knockout-predictions", response_model=Dict[str, Any])
def delete_user_knockout_predictions(
    user_id: int = 1,  # TODO: should come from authentication
    db: Session = Depends(get_db)
):
    """
    Delete all knockout predictions and third place predictions (not drafts) for a specific user (admin only)
    """
    try:
        from models.predictions import KnockoutStagePrediction, ThirdPlacePrediction

        knockout_pred_count = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id
        ).count()
        third_place_count = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).count()

        if knockout_pred_count == 0 and third_place_count == 0:
            return {
                "message": f"No knockout/third place predictions found for user {user_id}",
                "deleted": False,
                "knockout_predictions_deleted": 0,
                "third_place_predictions_deleted": 0,
                "total_deleted": 0
            }

        deleted_knockout = db.query(KnockoutStagePrediction).filter(
            KnockoutStagePrediction.user_id == user_id
        ).delete()
        deleted_third_place = db.query(ThirdPlacePrediction).filter(
            ThirdPlacePrediction.user_id == user_id
        ).delete()

        db.commit()

        return {
            "message": f"Deleted user {user_id} knockout/third place predictions successfully",
            "deleted": True,
            "knockout_predictions_deleted": deleted_knockout,
            "third_place_predictions_deleted": deleted_third_place,
            "total_deleted": deleted_knockout + deleted_third_place
        }
    except Exception as e:
        print(f"❌ Error in delete_user_knockout_predictions: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.delete("/admin/delete-all-knockout-results", response_model=Dict[str, Any])
def delete_all_knockout_results(db: Session = Depends(get_db)):
    """
    Reset knockout results and related match state to init state, then reset user scores (admin only).
    See _reset_knockout_results for DB changes; then ResultsService.reset_all_user_scores.
    """
    try:
        reset_stats = _reset_knockout_results(db)
        scores_result = ResultsService.reset_all_user_scores(db)
        db.commit()
        return {
            "message": "All knockout results reset successfully",
            "deleted": True,
            "knockout_results_reset": reset_stats["knockout_results_reset"],
            "knockout_matches_reset": reset_stats["knockout_matches_reset"],
            "match_results_deleted": reset_stats["match_results_deleted"],
            "users_reset": scores_result["users_reset"],
            "match_predictions_reset": scores_result["match_predictions_reset"],
            "group_predictions_reset": scores_result["group_predictions_reset"],
            "third_place_predictions_reset": scores_result["third_place_predictions_reset"],
            "knockout_predictions_reset": scores_result["knockout_predictions_reset"],
        }
        
    except Exception as e:
        print(f"❌ Error in delete_all_knockout_results: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/admin/rebuild-knockout-from-predictions", response_model=Dict[str, Any])
def rebuild_knockout_from_predictions(
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """
    Rebuild knockout bracket from existing predictions (admin only)
    Creates next stage predictions from existing predictions with winners
    """
    try:
        from services.database import DBReader, DBUtils
        
        # Get all predictions with winners, ordered by stage
        predictions = DBReader.get_knockout_predictions_by_user(db, user_id, stage=None, is_draft=False)
        predictions = [p for p in predictions if p.winner_team_id is not None]
        predictions.sort(key=lambda p: p.template_match_id)
        
        missing_count = 0
        
        for prediction in predictions:
            # Get the template for this prediction
            template = DBReader.get_match_template(db, prediction.template_match_id)
            
            if not template:
                continue
            
            # Check if this prediction has a next stage
            if not template.winner_next_knockout_match:
                continue
            
            # Next stage predictions should already exist
            next_prediction = DBReader.get_knockout_prediction(
                db, prediction.user_id, template.winner_next_knockout_match, is_draft=False
            )
            if not next_prediction:
                missing_count += 1
        
        DBUtils.commit(db)
        
        return {
            "success": True,
            "message": f"Rebuilt knockout bracket for user {user_id}",
            "missing_predictions": missing_count,
            "processed_predictions": len(predictions)
        }
        
    except Exception as e:
        print(f"❌ Error in rebuild_knockout_from_predictions: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

class CreateRandomResultsRequest(BaseModel):
    update_existing: bool = False

@router.post("/admin/generate-test-users", response_model=Dict[str, Any])
def generate_test_users(
    count: int = 50,
    db: Session = Depends(get_db)
):
    """
    Generate `count` fake test users with fully randomized predictions.
    Intended for local testing only.
    """
    from services.test_data_service import generate_test_users_with_predictions
    result = generate_test_users_with_predictions(db, count)
    return result


@router.post("/admin/create-test-users-draws", response_model=Dict[str, Any])
def create_test_users_draw_predictions(
    count: int = 50,
    db: Session = Depends(get_db)
):
    """
    Generate `count` fake test users with draw-only match predictions.
    All match predictions are draws (0-0, 1-1, 2-2, 3-3).
    Group, third place, knockout predictions: same as random variant.
    Intended for local testing only.
    """
    from services.test_data_service import generate_test_users_with_draw_predictions
    result = generate_test_users_with_draw_predictions(db, count)
    return result


@router.delete("/admin/delete-test-users", response_model=Dict[str, Any])
def delete_test_users(db: Session = Depends(get_db)):
    """Delete all users whose username starts with 'bot_' (admin only)"""
    from models.user import User

    bot_users = db.query(User).filter(User.username.like('bot_%')).all()
    deleted_count = 0
    errors = 0

    for user in bot_users:
        try:
            DBWriter.delete_user_account(db, user.id)
            deleted_count += 1
        except Exception as e:
            print(f"Error deleting bot user {user.id}: {e}")
            errors += 1

    return {
        "message": f"Deleted {deleted_count} bot users",
        "deleted": deleted_count,
        "errors": errors
    }


@router.post("/admin/create-random-group-and-third-place-results", response_model=Dict[str, Any])
def create_random_group_and_third_place_results(
    request: CreateRandomResultsRequest,
    db: Session = Depends(get_db)
):
    """
    Create random group stage results and third place results (admin only)
    This will:
    1. Create random results for all groups (randomly shuffle teams 1-4)
    2. Create random third place qualifying results from the 3rd place teams
    """
    import random
    
    try:
        from models.groups import Group
        from models.results import GroupStageResult, ThirdPlaceResult
        from models.team import Team
        
        groups_created = 0
        groups_updated = 0
        groups_skipped = 0
        groups_errors = 0
        
        # Step 1: Create random group results
        print("🎲 Creating random group stage results...")
        groups = db.query(Group).order_by(Group.name).all()
        
        for group in groups:
            # Get teams in this group
            teams = [
                group.team_1_obj,
                group.team_2_obj,
                group.team_3_obj,
                group.team_4_obj
            ]
            
            # Filter out None values
            teams = [team for team in teams if team is not None]
            
            if len(teams) != 4:
                print(f"  ❌ Group {group.name} has {len(teams)} teams instead of 4")
                groups_errors += 1
                continue
            
            # Check if result already exists
            existing_result = db.query(GroupStageResult).filter(
                GroupStageResult.group_id == group.id
            ).first()
            
            if existing_result and not request.update_existing:
                print(f"  ⚠️  Result already exists for group {group.name}, skipping...")
                groups_skipped += 1
                continue
            
            # Shuffle teams randomly
            shuffled_teams = teams.copy()
            random.shuffle(shuffled_teams)
            
            # Assign positions
            first_place = shuffled_teams[0].id
            second_place = shuffled_teams[1].id
            third_place = shuffled_teams[2].id
            fourth_place = shuffled_teams[3].id
            
            try:
                # Create or update result
                ResultsService.update_group_stage_result(
                    db=db,
                    group_id=group.id,
                    first_place_team_id=first_place,
                    second_place_team_id=second_place,
                    third_place_team_id=third_place,
                    fourth_place_team_id=fourth_place
                )
                
                if existing_result:
                    groups_updated += 1
                else:
                    groups_created += 1
                    
            except Exception as e:
                print(f"  ❌ Error creating result for group {group.name}: {e}")
                groups_errors += 1
                DBUtils.rollback(db)
        
        # Step 2: Get all third place teams from group results
        print("\n🎲 Creating random third place qualifying results...")
        third_place_teams = ResultsService.get_third_place_teams_from_groups(db)
        
        if len(third_place_teams) < 8:
            DBUtils.rollback(db)
            raise HTTPException(
                status_code=400,
                detail=f"Not enough third place teams found. Need 8, found {len(third_place_teams)}. Please ensure all groups have results."
            )
        
        # Shuffle third place teams randomly
        shuffled_third_place = third_place_teams.copy()
        random.shuffle(shuffled_third_place)
        
        # Check if third place result already exists
        existing_third_place = db.query(ThirdPlaceResult).first()
        
        if existing_third_place and not request.update_existing:
            DBUtils.rollback(db)
            raise HTTPException(
                status_code=400,
                detail="Third place result already exists. Use update_existing=true to update it."
            )
        
        # Create or update third place result
        try:
            ResultsService.update_third_place_result(
                db=db,
                first_team_qualifying=shuffled_third_place[0]["id"],
                second_team_qualifying=shuffled_third_place[1]["id"],
                third_team_qualifying=shuffled_third_place[2]["id"],
                fourth_team_qualifying=shuffled_third_place[3]["id"],
                fifth_team_qualifying=shuffled_third_place[4]["id"],
                sixth_team_qualifying=shuffled_third_place[5]["id"],
                seventh_team_qualifying=shuffled_third_place[6]["id"],
                eighth_team_qualifying=shuffled_third_place[7]["id"]
            )
            
            third_place_created = not existing_third_place
            third_place_updated = bool(existing_third_place)
            
        except Exception as e:
            DBUtils.rollback(db)
            raise HTTPException(status_code=500, detail=f"Error creating third place result: {str(e)}")
        
        db.commit()
        
        # Step 3: Build Round of 32 bracket from the results
        print("\n🏆 Building Round of 32 bracket from results...")
        bracket_built = False
        bracket_error = None
        bracket_summary = None
        
        try:
            bracket_result = ResultsService.build_round32_bracket_from_results(db)
            bracket_built = True
            bracket_summary = bracket_result
            print(f"✅ Round of 32 bracket built successfully: {bracket_result['matches_created']} created, {bracket_result['matches_updated']} updated")
        except Exception as e:
            bracket_error = str(e)
            print(f"⚠️  Warning: Failed to build bracket: {bracket_error}")
        
        return {
            "message": "Random group and third place results created successfully",
            "groups": {
                "created": groups_created,
                "updated": groups_updated,
                "skipped": groups_skipped,
                "errors": groups_errors,
                "total": len(groups)
            },
            "third_place": {
                "created": third_place_created,
                "updated": third_place_updated,
                "teams_assigned": 8
            },
            "bracket": {
                "built": bracket_built,
                "error": bracket_error,
                "summary": bracket_summary
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in create_random_group_and_third_place_results: {e}")
        DBUtils.rollback(db)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")