from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.api.auth import current_user
from app.core.config import get_settings
from app.db.models import Base
from app.db.session import SessionLocal
from app.main import app
from tests.test_data import AcademicFixture, seed_academic_fixture


@pytest.fixture(scope="session")
def isolated_test_database():
    settings = get_settings()
    database_name = f"schedaro_test_{uuid4().hex[:20]}"
    admin_engine = create_engine(make_url(settings.database_url).set(database="postgres"), pool_pre_ping=True)
    with admin_engine.connect() as connection:
        connection = connection.execution_options(isolation_level="AUTOCOMMIT")
        connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    admin_engine.dispose()

    test_engine = create_engine(make_url(settings.database_url).set(database=database_name), pool_pre_ping=True)
    with test_engine.connect() as connection:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    SessionLocal.configure(bind=test_engine)
    yield test_engine

    test_engine.dispose()
    admin_engine = create_engine(make_url(settings.database_url).set(database="postgres"), pool_pre_ping=True)
    with admin_engine.connect() as connection:
        connection = connection.execution_options(isolation_level="AUTOCOMMIT")
        connection.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :name AND pid <> pg_backend_pid()"), {"name": database_name})
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}"'))
    admin_engine.dispose()


@pytest.fixture(autouse=True, scope="session")
def test_api_auth(isolated_test_database):
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="test-owner", email="test-owner@example.test", role="platform_owner", active=True)
    yield
    app.dependency_overrides.pop(current_user, None)


@pytest.fixture(autouse=True)
def academic_fixture(isolated_test_database) -> AcademicFixture:
    with SessionLocal() as db:
        table_names = ", ".join(f'"{table.name}"' for table in reversed(Base.metadata.sorted_tables))
        db.execute(text(f"TRUNCATE TABLE {table_names} CASCADE"))
        return seed_academic_fixture(db)
