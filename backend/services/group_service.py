from sqlalchemy.orm import Session
from models.groups import Group
from models.results import GroupStageResult
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
        
        # מביא את הקבוצות דרך ה-relationships החדשים
        teams = [group.team_1_obj, group.team_2_obj, group.team_3_obj, group.team_4_obj]
        
        return {
            "id": group.id,
            "name": group.name,
            "teams": [
                {"id": team.id, "name": team.name, "position": i+1} 
                for i, team in enumerate(teams) if team is not None
            ]
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
    def create_group_stage_result(db: Session, group_id: int, first_place: int, 
                                second_place: int, third_place: int, fourth_place: int) -> Dict[str, Any]:
        """יוצר תוצאה לבית (כל 4 המקומות בבת אחת)"""
        existing_result = db.query(GroupStageResult).filter(
            GroupStageResult.group_id == group_id
        ).first()
        
        if existing_result:
            return {"error": f"Result for group {group_id} already exists"}
        
        result = GroupStageResult(
            group_id=group_id,
            first_place=first_place,
            second_place=second_place,
            third_place=third_place,
            fourth_place=fourth_place
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {"id": result.id, "created": True}
    
    @staticmethod
    def get_group_stage_results(db: Session, group_id: int) -> Dict[str, Any]:
        """מביא את תוצאות הבית"""
        result = db.query(GroupStageResult).filter(GroupStageResult.group_id == group_id).first()
        
        if not result:
            return {"error": f"No results found for group {group_id}"}
        
        return {
            "id": result.id,
            "group_id": result.group_id,
            "first_place": result.first_place,
            "second_place": result.second_place,
            "third_place": result.third_place,
            "fourth_place": result.fourth_place,
            "created_at": result.created_at
        }
