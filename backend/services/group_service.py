from sqlalchemy.orm import Session
from models.groups import Group, GroupResult
from models.team import Team
from typing import List, Dict, Any
import json

class GroupService:
    @staticmethod
    def create_group(db: Session, name: str) -> Dict[str, Any]:
        """יוצר בית חדש"""
        existing_group = db.query(Group).filter(Group.name == name).first()
        if existing_group:
            return {"error": f"Group {name} already exists"}
        
        group = Group(name=name)
        db.add(group)
        db.commit()
        db.refresh(group)
        
        return {"id": group.id, "name": group.name, "created": True}
    
    @staticmethod
    def get_all_groups(db: Session) -> List[Dict[str, Any]]:
        """מביא את כל הבתים"""
        groups = db.query(Group).all()
        return [{"id": group.id, "name": group.name} for group in groups]
    
    @staticmethod
    def get_group_with_teams(db: Session, group_name: str) -> Dict[str, Any]:
        """מביא בית עם הקבוצות שלו"""
        group = db.query(Group).filter(Group.name == group_name).first()
        if not group:
            return {"error": f"Group {group_name} not found"}
        
        # מביא את הקבוצות מהמשחקים
        from models.matches import GroupStageMatch
        
        matches = db.query(GroupStageMatch).filter(GroupStageMatch.group == group_name).all()
        teams = set()
        
        for match in matches:
            teams.add(match.home_team_id)
            teams.add(match.away_team_id)
        
        team_objects = db.query(Team).filter(Team.id.in_(list(teams))).all()
        
        return {
            "id": group.id,
            "name": group.name,
            "teams": [{"id": team.id, "name": team.name, "country_code": team.country_code} for team in team_objects]
        }
    
    @staticmethod
    def get_all_groups_with_teams(db: Session) -> List[Dict[str, Any]]:
        """מביא את כל הבתים עם הקבוצות שלהם"""
        groups = db.query(Group).all()
        result = []
        
        for group in groups:
            group_data = GroupService.get_group_with_teams(db, group.name)
            if "error" not in group_data:
                result.append(group_data)
        
        return result
    
    @staticmethod
    def create_group_result(db: Session, group_id: int, team_id: int, position: int, 
                          points: int = 0, goals_for: int = 0, goals_against: int = 0) -> Dict[str, Any]:
        """יוצר תוצאה לבית"""
        existing_result = db.query(GroupResult).filter(
            GroupResult.group_id == group_id,
            GroupResult.team_id == team_id
        ).first()
        
        if existing_result:
            return {"error": f"Result for team {team_id} in group {group_id} already exists"}
        
        goal_difference = goals_for - goals_against
        
        result = GroupResult(
            group_id=group_id,
            team_id=team_id,
            position=position,
            points=points,
            goals_for=goals_for,
            goals_against=goals_against,
            goal_difference=goal_difference
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {"id": result.id, "created": True}
    
    @staticmethod
    def get_group_results(db: Session, group_id: int) -> List[Dict[str, Any]]:
        """מביא את תוצאות הבית"""
        results = db.query(GroupResult).filter(GroupResult.group_id == group_id).order_by(GroupResult.position).all()
        
        return [{
            "id": result.id,
            "team_id": result.team_id,
            "position": result.position,
            "points": result.points,
            "goals_for": result.goals_for,
            "goals_against": result.goals_against,
            "goal_difference": result.goal_difference
        } for result in results]
