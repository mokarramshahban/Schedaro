import json
import re
from datetime import datetime, timedelta, timezone
from hashlib import scrypt, sha256
from hmac import compare_digest
from secrets import token_bytes, token_urlsafe
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Institution
from app.db.platform import check_tenant_database, tenant_session
from app.db.platform_models import PlatformAuditEvent, PlatformInstitution, PlatformMembership, PlatformSession, PlatformUser


settings = get_settings()
TRUSTED_DATABASE_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
PORTAL_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify_portal(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-") or "college"
    return slug[:72].strip("-")


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Platform Owner passwords must contain at least 12 characters.")
    salt = token_bytes(16)
    digest = scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_hex, digest_hex = encoded.split("$")
        if algorithm != "scrypt":
            return False
        digest = scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=int(n), r=int(r), p=int(p))
        return compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def create_session(db: Session, user: PlatformUser) -> str:
    raw = token_urlsafe(48)
    db.add(PlatformSession(id=str(uuid4()), user_id=user.id, token_hash=token_hash(raw), expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.auth_session_hours)))
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return raw


def user_for_session(db: Session, raw_token: str | None) -> PlatformUser | None:
    if not raw_token:
        return None
    record = db.scalar(select(PlatformSession).where(PlatformSession.token_hash == token_hash(raw_token)))
    if record is None or record.expires_at <= datetime.now(timezone.utc):
        if record is not None:
            db.delete(record)
            db.commit()
        return None
    user = db.get(PlatformUser, record.user_id)
    return user if user and user.active else None


def revoke_session(db: Session, raw_token: str | None) -> None:
    if raw_token:
        record = db.scalar(select(PlatformSession).where(PlatformSession.token_hash == token_hash(raw_token)))
        if record:
            db.delete(record)
            db.commit()


def audit(db: Session, event_type: str, actor_user_id: str | None = None, institution_id: str | None = None, metadata: dict | None = None) -> None:
    db.add(PlatformAuditEvent(id=str(uuid4()), actor_user_id=actor_user_id, event_type=event_type, institution_id=institution_id, metadata_json=json.dumps(metadata or {}, sort_keys=True)))
    db.commit()


def sync_legacy_institutions(platform_db: Session, source_db: Session) -> list[PlatformInstitution]:
    source_institutions = list(source_db.scalars(select(Institution).order_by(Institution.name)))
    for source in source_institutions:
        stable_key = f"legacy:{source.id}"
        record = platform_db.scalar(select(PlatformInstitution).where(PlatformInstitution.stable_key == stable_key))
        values = {"id": source.id, "stable_key": stable_key, "name": source.name, "short_name": source.short_name, "database_name": settings.database_name, "status": "ready", "schema_version": "20260305_0007", "active": source.active}
        if record is None:
            platform_db.add(PlatformInstitution(**values))
        else:
            for key, value in values.items():
                setattr(record, key, value)
    platform_db.commit()
    return list(platform_db.scalars(select(PlatformInstitution).order_by(PlatformInstitution.name)))


def trusted_institution(platform_db: Session, institution_id: str, require_active: bool = True) -> PlatformInstitution:
    record = platform_db.get(PlatformInstitution, institution_id)
    if record is None or (require_active and not record.active) or not TRUSTED_DATABASE_RE.fullmatch(record.database_name):
        raise LookupError("Institution workspace is unavailable.")
    return record


ROLE_LEVELS = {"institution_viewer": 1, "institution_editor": 2, "institution_admin": 3, "platform_owner": 4}


def has_institution_access(platform_db: Session, user: PlatformUser, institution_id: str, minimum_role: str = "institution_viewer") -> bool:
    if user.role == "platform_owner":
        return True
    membership = platform_db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == user.id, PlatformMembership.institution_id == institution_id, PlatformMembership.active.is_(True)))
    return bool(membership and ROLE_LEVELS.get(membership.role, 0) >= ROLE_LEVELS.get(minimum_role, 99))


def tenant_institution_exists(record: PlatformInstitution) -> bool:
    if not check_tenant_database(record.database_name):
        return False
    with tenant_session(record.database_name) as db:
        return db.get(Institution, record.id) is not None
