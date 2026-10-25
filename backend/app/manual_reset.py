"""Guarded local CLI for issuing one-time manual password reset keys."""
import os
import sys
from datetime import datetime, timedelta, timezone
from getpass import getpass
from secrets import token_hex
from uuid import uuid4

from sqlalchemy import select, update

from app.core.config import get_settings
from app.db.platform import PlatformSessionLocal, ensure_platform_schema
from app.db.platform_models import PlatformInstitution, PlatformManualPasswordReset, PlatformMembership, PlatformUser
from app.services.platform import audit, token_hash


def main() -> int:
    settings = get_settings()
    if settings.app_env.lower() == "production":
        print("Refusing manual reset-key issuance in production.", file=sys.stderr)
        return 2
    ensure_platform_schema()
    email = (os.getenv("SCHEDARO_RESET_EMAIL") or input("Existing synthetic account email: ")).strip().lower()
    with PlatformSessionLocal() as db:
        target = db.scalar(select(PlatformUser).where(PlatformUser.email == email))
        if target is None or not target.active or target.role == "platform_owner":
            print("No eligible non-owner active account was found.", file=sys.stderr)
            return 3
        if input("Type RESET to issue a one-time key: ").strip().upper() != "RESET":
            print("Reset-key issuance cancelled.")
            return 0
        institution = db.scalar(select(PlatformInstitution).join(PlatformMembership, PlatformMembership.institution_id == PlatformInstitution.id).where(PlatformMembership.user_id == target.id, PlatformMembership.active.is_(True), PlatformInstitution.active.is_(True)).order_by(PlatformInstitution.name))
        issuer = os.getenv("SCHEDARO_RECOVERY_ISSUER", "local-operator")
        now = datetime.now(timezone.utc)
        db.execute(update(PlatformManualPasswordReset).where(PlatformManualPasswordReset.user_id == target.id, PlatformManualPasswordReset.consumed_at.is_(None), PlatformManualPasswordReset.revoked_at.is_(None)).values(revoked_at=now))
        raw_key = token_hex(32)
        record = PlatformManualPasswordReset(id=str(uuid4()), user_id=target.id, key_hash=token_hash(raw_key), created_by=issuer, expires_at=now + timedelta(minutes=30))
        db.add(record); db.commit()
        audit(db, "platform.manual_password_reset.issued.cli", issuer, institution.id if institution else None, {"reset_id": record.id, "target_user_id": target.id})
        reset_url = f"{settings.public_app_url.rstrip('/')}{f'/c/{institution.portal_slug}' if institution and institution.portal_slug else ''}/reset-password"
        print("Manual Password Reset Key Generated")
        print(f"Target account: {target.email}")
        print(f"Reset URL: {reset_url}")
        print(f"One-time reset key (displayed once): {raw_key}")
        print(f"Expires: {record.expires_at.isoformat()}")
        print("Do not store this key in logs or source control.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
