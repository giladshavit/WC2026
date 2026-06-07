from sqlalchemy.orm import Session

from models.app_settings import AppSettings


def get_setting(db: Session, key: str, default: str) -> str:
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    return setting.value if setting else default


def set_setting(db: Session, key: str, value: str) -> None:
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    if setting:
        setting.value = value
    else:
        db.add(AppSettings(key=key, value=value))
    db.commit()


def get_stats_ads_enabled(db: Session) -> bool:
    return AppSettings.get_bool(db, "stats_ads_enabled", default=False)


def set_stats_ads_enabled(db: Session, enabled: bool) -> None:
    set_setting(db, "stats_ads_enabled", "true" if enabled else "false")
