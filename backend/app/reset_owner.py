import getpass
import os
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.db.platform import PlatformSessionLocal, ensure_platform_schema
from app.db.platform_models import PlatformUser
from app.services.platform import hash_password


def main() -> int:
    settings = get_settings()
    if settings.app_env.lower() == "production":
        print("Refusing local owner reset in production; use the approved deployment recovery process.", file=sys.stderr)
        return 2
    email = (os.getenv("PLATFORM_OWNER_EMAIL") or input("Existing Platform Owner email: ")).strip().lower()
    ensure_platform_schema()
    with PlatformSessionLocal() as db:
        user = db.scalar(select(PlatformUser).where(PlatformUser.email == email, PlatformUser.role == "platform_owner"))
        if user is None or not user.active:
            print("No active Platform Owner was found for that address.", file=sys.stderr)
            return 3
        print(f"Resetting the password for {user.email}. This is an explicit local recovery action.")
        if input("Type RESET to continue: ").strip() != "RESET":
            print("Reset cancelled.")
            return 0
        first = getpass.getpass("New Platform Owner password (12+ characters): ")
        second = getpass.getpass("Confirm new password: ")
        if first != second:
            print("Passwords did not match; no changes were made.", file=sys.stderr)
            return 2
        try:
            user.password_hash = hash_password(first)
        except ValueError as error:
            print(str(error), file=sys.stderr)
            return 2
        db.commit()
    print("Platform Owner password reset completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
