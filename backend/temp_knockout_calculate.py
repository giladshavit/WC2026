    @staticmethod
    def calculate_knockout_prediction_points(prediction: KnockoutStagePrediction, result: KnockoutStageResult, stage: str) -> int:
        """
        Calculate points for a knockout stage prediction.
        Points are awarded based on correct winner prediction and stage.
        """
        # Get the points for this stage
        stage_points = ScoringService.KNOCKOUT_SCORING_RULES.get(stage, 0)
        
        # Calculate points based on correct winner
        if prediction.winner_team_id == result.winner_team_id:
            # Correct winner prediction
            return stage_points
        else:
            # Wrong prediction
            return 0
