import getpass
import os
import sys
from uuid import uuid4

from sqlalchemy import select

from app.core.config import get_settings
from app.db.platform import PlatformSessionLocal, ensure_platform_schema
from app.db.platform_models import PlatformUser
from app.services.platform import hash_password


def main() -> int:
    settings = get_settings()
    if settings.app_env.lower() == "production":
        print("Refusing interactive owner bootstrap in production; use the approved deployment secret workflow.", file=sys.stderr)
        return 2
    email = (os.getenv("PLATFORM_OWNER_EMAIL") or input("Platform Owner email: ")).strip().lower()
    password = os.getenv("PLATFORM_OWNER_PASSWORD") or getpass.getpass("Platform Owner password (12+ characters): ")
    if not email or "@" not in email:
        print("A valid email address is required.", file=sys.stderr)
        return 2
    try:
        password_hash = hash_password(password)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    ensure_platform_schema()
    with PlatformSessionLocal() as db:
        existing = db.scalar(select(PlatformUser).where(PlatformUser.email == email))
        owners = db.scalar(select(PlatformUser).where(PlatformUser.role == "platform_owner", PlatformUser.active.is_(True)))
        if existing:
            if existing.role != "platform_owner":
                print("The requested account already exists with a different role.", file=sys.stderr)
                return 3
            print("Platform Owner already exists; no password was changed.")
            return 0
        if owners:
            print("An active Platform Owner already exists; refusing to create a second one.", file=sys.stderr)
            return 3
        db.add(PlatformUser(id=str(uuid4()), email=email, password_hash=password_hash, role="platform_owner", active=True))
        db.commit()
    print("Platform Owner bootstrap completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
