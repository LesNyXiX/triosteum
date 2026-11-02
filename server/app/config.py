"""Настройки сервера — из переменных окружения (см. .env.example)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # корень репозитория


def _bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    # подключение ролью triosteum_app — без права обходить построчную защиту
    database_url: str = os.environ.get("DATABASE_URL", "postgresql+psycopg://triosteum_app:app@127.0.0.1:5432/triosteum")
    # подключение владельцем схемы — только для миграций при запуске
    migrate_url: str | None = os.environ.get("MIGRATE_DATABASE_URL")
    app_db_password: str | None = os.environ.get("APP_DB_PASSWORD")
    client_html: Path = Path(os.environ.get("CLIENT_HTML", ROOT / "docs" / "index.html"))
    login_html: Path = Path(__file__).resolve().parent / "static" / "login.html"
    cookie_secure: bool = _bool("COOKIE_SECURE", True)       # в разработке без HTTPS: COOKIE_SECURE=0
    session_days: int = int(os.environ.get("SESSION_DAYS", "30"))
    # адреса, с которых разрешены изменяющие запросы (защита от CSRF); пусто — только тот же хост
    allowed_origins: set[str] = {o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()}
    max_body_bytes: int = int(os.environ.get("MAX_BODY_MB", "20")) * 1024 * 1024
    max_pref_bytes: int = 1024 * 1024
    version_every_sec: int = int(os.environ.get("VERSION_EVERY_SEC", "600"))   # автоснимок не чаще раза в 10 минут
    trust_proxy: bool = _bool("TRUST_PROXY", False)          # за nginx: TRUST_PROXY=1
    login_attempts_per_min: int = int(os.environ.get("LOGIN_ATTEMPTS_PER_MIN", "10"))


settings = Settings()
