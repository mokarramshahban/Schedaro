import re
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Department, Institution
from app.db.platform import tenant_engine, tenant_session
from app.db.platform_models import PlatformInstitution, PlatformProvisioningOperation

settings = get_settings()
DB_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def _clock_minutes(value: str) -> int:
    hour, minute = (int(part) for part in value.split(":"))
    return hour * 60 + minute


def safe_database_name(institution_id: str) -> str:
    suffix = re.sub(r"[^a-z0-9]", "", institution_id.lower())[:24] or uuid4().hex[:12]
    candidate = f"schedaro_tenant_{suffix}"
    return candidate[:63]


def create_database(database_name: str) -> None:
    if not DB_NAME_RE.fullmatch(database_name) or database_name == settings.database_name:
        raise ValueError("The generated tenant database identifier is invalid.")
    admin_engine = create_engine(make_url(settings.database_url).set(database="postgres"), pool_pre_ping=True)
    try:
        with admin_engine.connect() as connection:
            connection = connection.execution_options(isolation_level="AUTOCOMMIT")
            exists = connection.execute(text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": database_name}).scalar()
            if not exists:
                connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    finally:
        admin_engine.dispose()


def migrate_database(database_name: str) -> None:
    engine = tenant_engine(database_name)
    with engine.connect() as connection:
        config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def provision_operation(platform_db: Session, operation: PlatformProvisioningOperation, institution: PlatformInstitution, departments: list[str]) -> None:
    operation.attempts += 1
    operation.status = "provisioning"
    operation.error_message = None
    platform_db.commit()
    try:
        create_database(institution.database_name)
        migrate_database(institution.database_name)
        with tenant_session(institution.database_name) as tenant_db:
            tenant_record = tenant_db.get(Institution, institution.id)
            if tenant_record is None:
                tenant_record = Institution(id=institution.id, name=institution.name, short_name=institution.short_name, institution_type=institution.institution_type, address=institution.address, working_week=institution.working_week, active=True)
                tenant_db.add(tenant_record)
            for name in departments:
                if not tenant_db.scalar(select(Department).where(Department.institution_id == institution.id, Department.name == name)):
                    tenant_db.add(Department(id=str(uuid4()), institution_id=institution.id, name=name, active=True))
            tenant_db.commit()
            if tenant_db.get(Institution, institution.id) is None:
                raise RuntimeError("Tenant institution verification failed.")
        operation.status = "ready"
        institution.status = "ready"
        institution.active = True
        institution.schema_version = "20260305_0007"
        platform_db.commit()
    except Exception as error:
        platform_db.rollback()
        operation = platform_db.get(PlatformProvisioningOperation, operation.id)
        institution = platform_db.get(PlatformInstitution, institution.id)
        operation.status = "failed"
        operation.error_message = str(error)[:500]
        institution.status = "provisioning_failed"
        institution.active = False
        platform_db.commit()
        raise
