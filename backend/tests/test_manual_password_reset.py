from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.api.auth import current_user
from app.db.platform import PlatformSessionLocal
from app.db.platform_models import PlatformAuditEvent, PlatformManualPasswordReset, PlatformPasswordRecovery, PlatformRecoveryAttempt, PlatformSession, PlatformUser
from app.main import app
from app.services.platform import hash_password, verify_password


def _target():
    initial_password = f"Initial-{uuid4().hex}-password"
    return PlatformUser(id=str(uuid4()), email=f"reset-target-{uuid4().hex[:8]}@example.test", password_hash=hash_password(initial_password), role="faculty", active=True)


def test_owner_issues_single_use_manual_key_and_reset_invalidates_sessions():
    target = _target(); target_id = target.id; raw_key = None; new_password = f"Updated-{uuid4().hex}-password"
    with PlatformSessionLocal() as db:
        db.add(target); db.commit()
    try:
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="test-owner", role="platform_owner", active=True)
        client = TestClient(app)
        issued = client.post(f"/api/v1/platform/users/{target_id}/manual-password-reset", json={"confirmation": "RESET", "expiration_minutes": 30})
        assert issued.status_code == 201, issued.text
        body = issued.json(); raw_key = body["reset_key"]
        replacement = client.post(f"/api/v1/platform/users/{target_id}/manual-password-reset", json={"confirmation": "RESET", "expiration_minutes": 30})
        assert replacement.status_code == 201 and replacement.json()["replaced_previous"] is True
        body = replacement.json(); raw_key = body["reset_key"]
        with PlatformSessionLocal() as db:
            record = db.get(PlatformManualPasswordReset, body["reset_id"])
            assert record is not None and record.key_hash != raw_key and record.key_hash
            db.add(PlatformSession(id=str(uuid4()), user_id=target_id, token_hash=uuid4().hex, expires_at=datetime.now(timezone.utc) + timedelta(hours=1))); db.commit()
        reset = client.post("/api/v1/auth/password/reset", json={"token": raw_key, "password": new_password})
        assert reset.status_code == 200, reset.text
        with PlatformSessionLocal() as db:
            user = db.get(PlatformUser, target_id)
            assert user is not None and verify_password(new_password, user.password_hash)
            assert db.scalar(select(PlatformSession).where(PlatformSession.user_id == target_id)) is None
            event = db.scalar(select(PlatformAuditEvent).where(PlatformAuditEvent.event_type == "platform.password_reset.completed", PlatformAuditEvent.actor_user_id == target_id).order_by(PlatformAuditEvent.created_at.desc()))
            assert event is not None and raw_key not in (event.metadata_json or "")
        replay = client.post("/api/v1/auth/password/reset", json={"token": raw_key, "password": f"Replay-{uuid4().hex}-password"})
        assert replay.status_code == 400
    finally:
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="test-owner", email="test-owner@example.test", role="platform_owner", active=True)
        with PlatformSessionLocal() as db:
            db.execute(delete(PlatformRecoveryAttempt))
            db.execute(delete(PlatformManualPasswordReset).where(PlatformManualPasswordReset.user_id == target_id))
            db.execute(delete(PlatformPasswordRecovery).where(PlatformPasswordRecovery.user_id == target_id))
            db.execute(delete(PlatformSession).where(PlatformSession.user_id == target_id))
            db.execute(delete(PlatformAuditEvent).where(PlatformAuditEvent.actor_user_id == target_id))
            current = db.get(PlatformUser, target_id)
            if current: db.delete(current)
            db.commit()


def test_non_owner_cannot_issue_manual_reset_and_bad_keys_are_rate_limited():
    target = _target(); target_id = target.id; new_password = f"Updated-{uuid4().hex}-password"
    with PlatformSessionLocal() as db:
        db.add(target); db.commit()
    try:
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="institution-user", role="faculty", active=True)
        client = TestClient(app)
        denied = client.post(f"/api/v1/platform/users/{target_id}/manual-password-reset", json={"confirmation": "RESET"})
        assert denied.status_code == 403
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="test-owner", role="platform_owner", active=True)
        for _ in range(5):
            assert client.post("/api/v1/auth/password/reset", json={"token": "0" * 64, "password": new_password}).status_code == 400
        assert client.post("/api/v1/auth/password/reset", json={"token": "0" * 64, "password": new_password}).status_code == 429
    finally:
        app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="test-owner", email="test-owner@example.test", role="platform_owner", active=True)
        with PlatformSessionLocal() as db:
            db.execute(delete(PlatformRecoveryAttempt))
            db.execute(delete(PlatformManualPasswordReset).where(PlatformManualPasswordReset.user_id == target_id))
            db.execute(delete(PlatformPasswordRecovery).where(PlatformPasswordRecovery.user_id == target_id))
            current = db.get(PlatformUser, target_id)
            if current: db.delete(current)
            db.commit()
