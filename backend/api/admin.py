from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from services.predictions.match_prediction_service import MatchPredictionService
from services.team_service import TeamService
from services.group_service import GroupService
from services.results_service import ResultsService
from services.stage_manager import StageManager, Stage
from services.database import DBUtils
from models.groups import Group
from models.matches import Match, MatchStatus
from database import get_db

router = APIRouter()

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
    status: str  # scheduled, live_editable, live_locked, finished
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
    print(f"🔍 [DEBUG API] update_match_result endpoint called: match_id={match_id}, request={result_request}")
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
        print(f"✅ [DEBUG API] update_match_result completed: {result}")
        return result
    except ValueError as e:
        print(f"❌ [DEBUG API] ValueError: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ [DEBUG API] Exception: {str(e)}")
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
        
        # Step 2: Update Round of 32 prediction statuses
        print("🔧 Updating Round of 32 prediction statuses...")
        ResultsService.update_round32_statuses(db)
        
        # Step 3: Update prediction statuses for all subsequent knockout stages
        print("🔧 Updating subsequent knockout stage statuses...")
        ResultsService.update_knockout_statuses_after_round32(db)
        
        # Step 4: Update validity for all predictions
        print("🔧 Updating prediction validity...")
        from services.predictions.knockout_service import KnockoutService
        KnockoutService.update_all_predictions_validity(db)
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
        python_path = os.path.join(os.path.dirname(__file__), "..", "venv", "bin", "python")
        
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
        
        # Step 2: Reset validity for all knockout predictions (set to True since no results exist)
        from models.predictions import KnockoutStagePrediction
        knockout_predictions = db.query(KnockoutStagePrediction).all()
        validity_reset_count = 0
        for prediction in knockout_predictions:
            if not prediction.is_team1_valid or not prediction.is_team2_valid:
                prediction.is_team1_valid = True
                prediction.is_team2_valid = True
                validity_reset_count += 1
        
        print(f"✅ Reset validity for {validity_reset_count} knockout predictions")
        
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
    Delete all results and reset scores (admin only)
    This will:
    1. Delete all match results
    2. Delete all group stage results
    3. Delete all third place results
    4. Delete all knockout stage results
    5. Reset validity for all knockout predictions (set to True)
    6. Reset all user scores to zero
    7. Reset all prediction points to zero
    8. Reset all match statuses to scheduled
    """
    try:
        import subprocess
        import os
        
        # Step 1: Delete all results using the existing script
        script_path = os.path.join(os.path.dirname(__file__), "..", "utils", "deletion", "delete_all_results.py")
        python_path = os.path.join(os.path.dirname(__file__), "..", "venv", "bin", "python")
        
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
        
        # Step 2: Reset validity for all knockout predictions (set to True since no results exist)
        from models.predictions import KnockoutStagePrediction
        knockout_predictions = db.query(KnockoutStagePrediction).all()
        validity_reset_count = 0
        for prediction in knockout_predictions:
            if not prediction.is_team1_valid or not prediction.is_team2_valid:
                prediction.is_team1_valid = True
                prediction.is_team2_valid = True
                validity_reset_count += 1
        
        print(f"✅ Reset validity for {validity_reset_count} knockout predictions")
        
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
            "message": "All results deleted and scores reset successfully",
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

@router.delete("/admin/delete-all-knockout-results", response_model=Dict[str, Any])
def delete_all_knockout_results(db: Session = Depends(get_db)):
    """
    Delete all knockout stage results (admin only)
    This will:
    1. Delete all KnockoutStageResult records
    2. Delete all MatchResult records for knockout matches
    3. Reset home_team_id and away_team_id for knockout matches (except Round of 32)
    4. Reset match statuses to scheduled for knockout matches
    """
    try:
        from models.results import KnockoutStageResult, MatchResult
        
        # Count records before deletion
        knockout_result_count = db.query(KnockoutStageResult).count()
        
        # Get all knockout match IDs
        knockout_matches = db.query(Match).filter(
            Match.stage.in_(['round32', 'round16', 'quarter', 'semi', 'final'])
        ).all()
        
        knockout_match_ids = [m.id for m in knockout_matches]
        
        # Count match results for knockout matches
        match_result_count = db.query(MatchResult).filter(
            MatchResult.match_id.in_(knockout_match_ids)
        ).count()
        
        if knockout_result_count == 0 and match_result_count == 0:
            return {
                "message": "No knockout results found to delete",
                "deleted": False,
                "knockout_results_deleted": 0,
                "match_results_deleted": 0,
                "matches_reset": 0
            }
        
        # Delete all knockout stage results
        deleted_knockout_results = db.query(KnockoutStageResult).delete()
        
        # Delete all match results for knockout matches
        deleted_match_results = db.query(MatchResult).filter(
            MatchResult.match_id.in_(knockout_match_ids)
        ).delete()
        
        # Reset teams and status for knockout matches (except Round of 32 which has teams from groups)
        matches_reset = 0
        for match in knockout_matches:
            if match.stage != 'round32':
                # Reset teams for Round of 16 and beyond (they come from previous knockout rounds)
                if match.home_team_id is not None or match.away_team_id is not None:
                    match.home_team_id = None
                    match.away_team_id = None
                    matches_reset += 1
            # Reset status to scheduled
            if match.status != "scheduled":
                match.status = "scheduled"
                matches_reset += 1
        
        # Commit the changes
        db.commit()
        
        return {
            "message": "All knockout results deleted successfully",
            "deleted": True,
            "knockout_results_deleted": deleted_knockout_results,
            "match_results_deleted": deleted_match_results,
            "matches_reset": matches_reset
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