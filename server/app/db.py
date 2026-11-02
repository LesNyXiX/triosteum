"""Подключение к PostgreSQL и транзакции с привязкой к организации."""
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=10)


@contextmanager
def tx(org_id: str | None = None) -> Iterator[Connection]:
    """Транзакция. Если указана организация — база покажет только её строки (Row Level Security)."""
    with engine.begin() as conn:
        if org_id:
            conn.execute(text("SELECT set_config('app.org_id', :o, true)"), {"o": str(org_id)})
        yield conn
