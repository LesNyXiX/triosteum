"""Миграции базы: применяет server/db/NNN_*.sql по порядку, каждую один раз.

Запускается владельцем схемы (MIGRATE_DATABASE_URL), а не ролью приложения.
Отдельно:  python -m app.migrate  (из папки server/)
"""
import os
import sys
from pathlib import Path

import psycopg

DB_DIR = Path(__file__).resolve().parents[1] / "db"


def _plain(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def run(url: str, app_password: str | None = None) -> list[str]:
    done: list[str] = []
    with psycopg.connect(_plain(url), autocommit=True) as conn:
        conn.execute("SELECT pg_advisory_lock(87213)")          # два процесса не мигрируют одновременно
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())")
            applied = {r[0] for r in conn.execute("SELECT name FROM schema_migrations")}
            for f in sorted(DB_DIR.glob("[0-9][0-9][0-9]_*.sql")):
                if f.name in applied:
                    continue
                with conn.transaction():
                    conn.execute(f.read_text(encoding="utf-8"))
                    conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (f.name,))
                done.append(f.name)
            if app_password:
                conn.execute(psycopg.sql.SQL("ALTER ROLE triosteum_app PASSWORD {}").format(psycopg.sql.Literal(app_password)))
        finally:
            conn.execute("SELECT pg_advisory_unlock(87213)")
    return done


if __name__ == "__main__":
    url = os.environ.get("MIGRATE_DATABASE_URL") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not url:
        sys.exit("Укажите MIGRATE_DATABASE_URL")
    names = run(url, os.environ.get("APP_DB_PASSWORD"))
    print("Применено:", ", ".join(names) if names else "ничего нового")
