from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.auth import current_user
from app.db.models import ClassGroup, TimetableReview, TimetableVersion
from app.db.platform import PlatformSessionLocal, tenant_session
from app.db.platform_models import PlatformInstitution
from app.main import app


def test_timetable_version_requires_independent_review_and_publishes():
    with PlatformSessionLocal() as platform_db:
        institution = platform_db.scalar(select(PlatformInstitution).where(PlatformInstitution.database_name == "schedaro_db"))
    with tenant_session("schedaro_db") as db:
        group = db.scalar(select(ClassGroup).where(ClassGroup.active.is_(True)))
        assert institution is not None and group is not None
        group_id = group.id
    version_id = None
    creator = SimpleNamespace(id="workflow-creator", email="creator@test.local", role="platform_owner", active=True)
    reviewer = SimpleNamespace(id="workflow-reviewer", email="reviewer@test.local", role="platform_owner", active=True)
    app.dependency_overrides[current_user] = lambda: creator
    try:
        with TestClient(app) as client:
            created = client.post(f"/api/v1/workflow/class-groups/{group_id}/versions").json()
            assert created["status"] == "draft"
            version_id = created["id"]
            assert client.post(f"/api/v1/workflow/versions/{version_id}/submit").status_code == 200
            self_review = client.post(f"/api/v1/workflow/versions/{version_id}/review", json={"decision": "approve", "reason": "not allowed"})
            assert self_review.status_code == 403
            app.dependency_overrides[current_user] = lambda: reviewer
            approved = client.post(f"/api/v1/workflow/versions/{version_id}/review", json={"decision": "approve", "reason": "Reviewed independently"})
            assert approved.status_code == 200
            published = client.post(f"/api/v1/workflow/versions/{version_id}/publish")
            assert published.status_code == 200
    finally:
        app.dependency_overrides.pop(current_user, None)
        with tenant_session("schedaro_db") as db:
            item = db.get(TimetableVersion, version_id)
            if item is not None: db.delete(item)
            db.commit()
