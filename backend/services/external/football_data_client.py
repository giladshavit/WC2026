import httpx
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

BASE_URL = "https://api.football-data.org/v4"

class FootballDataClient:
    
    def __init__(self):
        self.api_key = os.getenv("FOOTBALL_DATA_API_KEY", "")
        self.headers = {"X-Auth-Token": self.api_key}

    def get_live_matches(self, competition_code: str = "WC") -> list[dict]:
        """Fetch all currently live matches for a competition."""
        try:
            response = httpx.get(
                f"{BASE_URL}/competitions/{competition_code}/matches",
                params={"status": "LIVE"},
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json().get("matches", [])
        except Exception as e:
            logger.error(f"Error fetching live matches: {e}")
            return []

    def get_match(self, external_match_id: int) -> dict | None:
        """Fetch a single match by its football-data.org ID."""
        try:
            response = httpx.get(
                f"{BASE_URL}/matches/{external_match_id}",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching match {external_match_id}: {e}")
            return None

    def get_todays_matches(self, competition_code: str = "WC") -> list[dict]:
        """Fetch all matches for today from the competition."""
        try:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            response = httpx.get(
                f"{BASE_URL}/competitions/{competition_code}/matches",
                params={"dateFrom": today, "dateTo": today},
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json().get("matches", [])
        except Exception as e:
            logger.error(f"Error fetching today's matches: {e}")
            return []

    @staticmethod
    def map_external_status(external_status: str) -> str | None:
        """Map football-data.org status to our internal MatchStatus values."""
        mapping = {
            "IN_PLAY": "live",
            "PAUSED": "live",
            "FINISHED": "finished",
            "SCHEDULED": "scheduled",
            "TIMED": "scheduled",
        }
        return mapping.get(external_status, None)
