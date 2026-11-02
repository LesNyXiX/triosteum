"""Тесты гоняются на настоящем PostgreSQL: каждая сессия тестов создаёт чистую базу.

Нужна переменная TEST_ADMIN_URL — подключение суперпользователем, например
  TEST_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres pytest
"""
import os
import sys
import uuid
from pathlib import Path

import psycopg
import pytest

ADMIN = os.environ.get("TEST_ADMIN_URL", "postgresql://postgres@127.0.0.1:5433/postgres")
DB = "triosteum_test_" + uuid.uuid4().hex[:8]
PW = "app-test-pw"


def _url(base: str, db: str) -> str:
    return base.rsplit("/", 1)[0] + "/" + db


with psycopg.connect(ADMIN, autocommit=True) as c:
    c.execute(f'CREATE DATABASE "{DB}"')

host_part = ADMIN.split("@", 1)[1].rsplit("/", 1)[0]
os.environ["DATABASE_URL"] = f"postgresql+psycopg://triosteum_app:{PW}@{host_part}/{DB}"
os.environ["MIGRATE_DATABASE_URL"] = _url(ADMIN, DB)
os.environ["APP_DB_PASSWORD"] = PW
os.environ["COOKIE_SECURE"] = "0"
os.environ["VERSION_EVERY_SEC"] = "0"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import migrate  # noqa: E402

migrate.run(os.environ["MIGRATE_DATABASE_URL"], PW)


@pytest.fixture(scope="session", autouse=True)
def _drop_db():
    yield
    from app.db import engine
    engine.dispose()
    with psycopg.connect(ADMIN, autocommit=True) as c:
        c.execute(f'DROP DATABASE IF EXISTS "{DB}" WITH (FORCE)')


@pytest.fixture
def admin():
    """Прямое подключение владельцем схемы — для подготовки данных, которые API пока не умеет (роли и т. п.)."""
    with psycopg.connect(os.environ["MIGRATE_DATABASE_URL"], autocommit=True) as c:
        yield c


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app, login_limiter
    login_limiter.reset()
    with TestClient(app, base_url="http://testserver") as tc:
        yield tc


def register(client, org="Завод", email=None, password="password123", name="Иван"):
    email = email or f"u{uuid.uuid4().hex[:8]}@zavod.ru"
    r = client.post("/api/auth/register", json={"org": org, "name": name, "email": email, "password": password, "pd_consent": True})
    assert r.status_code == 201, r.text
    return email
