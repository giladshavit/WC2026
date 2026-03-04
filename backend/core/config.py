import os
from dotenv import load_dotenv

load_dotenv()

FOOTBALL_DATA_API_KEY: str = os.getenv("FOOTBALL_DATA_API_KEY", "")
