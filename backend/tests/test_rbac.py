from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.auth import current_session, current_user
from app.db.platform import PlatformSessionLocal
from app.db.platform_models import PlatformInstitution, PlatformRoleAssignment, PlatformSession, PlatformUser
from app.main import app
from app.services.platform import hash_password
from app.services.rbac import validate_scope


def test_owner_can_assign_and_revoke_scoped_role_without_platform_owner_grant():
    owner = SimpleNamespace(id="test-rbac-owner", email="owner@test.local", role="platform_owner", active=True)
    user_id = str(uuid4())
    with PlatformSessionLocal() as db:
        institution = db.scalar(select(PlatformInstitution).where(PlatformInstitution.active.is_(True), PlatformInstitution.status == "ready"))
        assert institution is not None
        institution_id = institution.id
        target = PlatformUser(id=user_id, email=f"rbac-{user_id}@example.test", password_hash=hash_password("RBAC-test-password-2026!"), role="college_admin", active=True)
        db.add(target); db.commit()
    app.dependency_overrides[current_user] = lambda: owner
    try:
        with TestClient(app) as client:
            response = client.post(f"/api/v1/platform/institutions/{institution_id}/role-assignments", json={"user_id": user_id, "institution_id": institution_id, "role": "hod", "scope_type": "institution"})
            assert response.status_code == 201
            assignment_id = response.json()["id"]
            forbidden = client.post(f"/api/v1/platform/institutions/{institution_id}/role-assignments", json={"user_id": user_id, "institution_id": institution_id, "role": "platform_owner", "scope_type": "institution"})
            assert forbidden.status_code == 403
            revoked = client.post(f"/api/v1/platform/role-assignments/{assignment_id}/revoke")
            assert revoked.status_code == 200
    finally:
        app.dependency_overrides.pop(current_user, None)
        with PlatformSessionLocal() as db:
            for item in db.scalars(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == user_id)).all(): db.delete(item)
            db.delete(db.get(PlatformUser, user_id)); db.commit()


def test_foreign_or_stale_scope_is_rejected():
    with PlatformSessionLocal() as db:
        institution = db.scalar(select(PlatformInstitution).where(PlatformInstitution.active.is_(True), PlatformInstitution.status == "ready"))
        assert institution is not None
        try:
            validate_scope(db, institution.id, "department", "not-a-real-scope")
            assert False, "invalid scope should be rejected"
        except ValueError as error:
            assert "scope" in str(error).lower()


def test_role_context_requires_an_active_assignment():
    owner = SimpleNamespace(id="test-rbac-owner", email="owner@test.local", role="platform_owner", active=True)
    with PlatformSessionLocal() as db:
        institution = db.scalar(select(PlatformInstitution).where(PlatformInstitution.active.is_(True), PlatformInstitution.status == "ready"))
        assignment = db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.status == "active"))
        assert institution is not None and assignment is not None
        assignment_id = assignment.id
        assignment_user_id = assignment.user_id
        session = PlatformSession(id=str(uuid4()), user_id=assignment_user_id, token_hash=str(uuid4()).replace("-", ""), expires_at=__import__('datetime').datetime.now(__import__('datetime').timezone.utc))
        session.expires_at = __import__('datetime').datetime.now(__import__('datetime').timezone.utc) + __import__('datetime').timedelta(hours=1)
        session_id = session.id
        db.add(session); db.commit()
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=assignment_user_id, email="rbac@example.test", role="college_admin", active=True)
    session_context = SimpleNamespace(active_assignment_id=assignment_id)
    app.dependency_overrides[current_session] = lambda: session_context
    try:
        with TestClient(app) as client:
            assert client.get("/api/v1/auth/me/role-context").status_code == 200
            assert client.post("/api/v1/auth/me/role-context", json={"assignment_id": assignment_id}).status_code == 200
    finally:
        app.dependency_overrides.pop(current_user, None); app.dependency_overrides.pop(current_session, None)
        with PlatformSessionLocal() as db:
            db.delete(db.get(PlatformSession, session_id)); db.commit()
