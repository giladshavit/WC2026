"""
Datetime utilities for consistent UTC handling.
All match dates are stored as naive UTC in the database.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

# Sheet times are in Israel timezone
SHEET_TIMEZONE = ZoneInfo("Asia/Jerusalem")
UTC = ZoneInfo("UTC")


def israel_time_to_utc(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    """
    Convert Israel local time to UTC (naive, for DB storage).
    """
    dt_il = datetime(year, month, day, hour, minute, tzinfo=SHEET_TIMEZONE)
    dt_utc = dt_il.astimezone(UTC)
    return dt_utc.replace(tzinfo=None)


def datetime_to_utc_iso(dt: datetime | None) -> str | None:
    """
    Serialize datetime to ISO string with Z suffix (UTC).
    Assumes naive datetime is already in UTC.
    """
    if dt is None:
        return None
    iso = dt.isoformat()
    return iso + "Z" if "Z" not in iso and "+" not in iso else iso
