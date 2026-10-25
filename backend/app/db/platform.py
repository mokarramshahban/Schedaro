from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.platform_models import PlatformBase


settings = get_settings()


def _database_url(database_name: str):
    if not database_name.replace("_", "").isalnum() or len(database_name) > 63:
        raise ValueError("Invalid trusted database identifier")
    parsed = make_url(settings.database_url)
    return parsed.set(database=database_name)


platform_engine = create_engine(_database_url(settings.platform_database_name), pool_pre_ping=True)
PlatformSessionLocal = sessionmaker(bind=platform_engine, autocommit=False, autoflush=False)


def ensure_platform_database() -> bool:
    if check_platform_database_connection():
        return True
    try:
        admin_engine = create_engine(_database_url("postgres"), pool_pre_ping=True)
        with admin_engine.connect() as connection:
            connection = connection.execution_options(isolation_level="AUTOCOMMIT")
            exists = connection.execute(text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": settings.platform_database_name}).scalar()
            if not exists:
                connection.execute(text(f'CREATE DATABASE "{settings.platform_database_name}"'))
        admin_engine.dispose()
        return check_platform_database_connection()
    except Exception:
        return False


@lru_cache(maxsize=16)
def tenant_engine(database_name: str):
    return create_engine(_database_url(database_name), pool_pre_ping=True)


def tenant_session(database_name: str) -> Session:
    return sessionmaker(bind=tenant_engine(database_name), autocommit=False, autoflush=False)()


def get_platform_db() -> Generator[Session, None, None]:
    db = PlatformSessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_platform_schema() -> None:
    PlatformBase.metadata.create_all(platform_engine)
    with platform_engine.begin() as connection:
        connection.execute(text("ALTER TABLE platform_institutions DROP CONSTRAINT IF EXISTS uq_platform_institution_database_name"))
        connection.execute(text("INSERT INTO platform_schema_versions (version) VALUES ('20260306_0001') ON CONFLICT (version) DO NOTHING"))


def check_platform_database_connection() -> bool:
    try:
        with platform_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def check_tenant_database(database_name: str) -> bool:
    try:
        with tenant_engine(database_name).connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
