import argparse
import re
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.db.models import Base, Institution
from app.db.platform import PlatformSessionLocal, ensure_platform_schema, tenant_engine
from app.db.platform_models import PlatformInstitution

NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def main() -> int:
    parser = argparse.ArgumentParser(description="Provision an empty development tenant database.")
    parser.add_argument("--database", required=True)
    parser.add_argument("--institution-id", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    settings = get_settings()
    if settings.app_env == "production" or not NAME_RE.fullmatch(args.database) or args.database == settings.database_name:
        raise SystemExit("Only a new, validated development database may be provisioned by this command.")
    admin_url = make_url(settings.database_url).set(database="postgres")
    with create_engine(admin_url).connect() as connection:
        connection = connection.execution_options(isolation_level="AUTOCOMMIT")
        exists = connection.execute(text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": args.database}).scalar()
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{args.database}"'))
    Base.metadata.create_all(tenant_engine(args.database))
    with tenant_engine(args.database).begin() as connection:
        connection.execute(text("INSERT INTO institutions (id, name, working_week, active) VALUES (:id, :name, 'monday-saturday', true) ON CONFLICT (id) DO NOTHING"), {"id": args.institution_id, "name": args.name})
    ensure_platform_schema()
    with PlatformSessionLocal() as db:
        db.add(PlatformInstitution(id=args.institution_id, stable_key=f"provisioned:{args.institution_id}", name=args.name, database_name=args.database, status="ready", schema_version="20260306_0001", active=True))
        db.commit()
    print(f"Provisioned tenant {args.database} for {args.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
