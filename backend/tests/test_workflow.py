from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.auth import current_user
from app.main import app
from tests.test_data import AcademicFixture


def test_timetable_version_requires_independent_review_and_publishes(academic_fixture: AcademicFixture):
    creator = SimpleNamespace(id="workflow-creator", email="creator@example.test", role="platform_owner", active=True)
    reviewer = SimpleNamespace(id="workflow-reviewer", email="reviewer@example.test", role="platform_owner", active=True)
    app.dependency_overrides[current_user] = lambda: creator
    try:
        with TestClient(app) as client:
            created = client.post(f"/api/v1/workflow/class-groups/{academic_fixture.group_a_id}/versions")
            assert created.status_code == 201, created.text
            version_id = created.json()["id"]
            assert client.post(f"/api/v1/workflow/versions/{version_id}/submit").status_code == 200
            self_review = client.post(f"/api/v1/workflow/versions/{version_id}/review", json={"decision": "approve", "reason": "self"})
            assert self_review.status_code == 403
            app.dependency_overrides[current_user] = lambda: reviewer
            approved = client.post(f"/api/v1/workflow/versions/{version_id}/review", json={"decision": "approve", "reason": "Independent review"})
            assert approved.status_code == 200
            published = client.post(f"/api/v1/workflow/versions/{version_id}/publish")
            assert published.status_code == 200
            assert published.json()["status"] == "published"
    finally:
        app.dependency_overrides.pop(current_user, None)
