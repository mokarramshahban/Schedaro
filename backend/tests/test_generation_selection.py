import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_data import AcademicFixture


def test_selected_requirement_ids_control_solver_and_discard_is_safe(academic_fixture: AcademicFixture):
    client = TestClient(app)
    fixture = academic_fixture
    requirements = client.get(f"/api/v1/scheduling/class-groups/{fixture.group_a_id}/requirements").json()
    lecture = next(item for item in requirements if item["session_type"] == "Lecture" and item["active"])
    tutorial_options = [item for item in requirements if item["session_type"] == "Tutorial" and item["active"]]
    if not tutorial_options:
        pytest.fail("The isolated fixture must include an active Tutorial requirement.")
    tutorial = tutorial_options[0]
    before = client.get(f"/api/v1/timetables/{fixture.group_a_id}/sessions").json()
    payload = {"institution_id": fixture.institution_a_id, "academic_term_id": fixture.term_a_id, "class_group_ids": [fixture.group_a_id], "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], "daily_start_time": "09:00", "daily_end_time": "17:00", "quantum_minutes": 30, "time_limit_seconds": 3, "preference": "earlier", "preserve_existing": True}

    lecture_result = client.post("/api/v1/scheduling/generate", json={**payload, "selected_requirement_ids": [lecture["id"]]})
    assert lecture_result.status_code == 200, lecture_result.text
    assert all(item["session_type"] != "Tutorial" for item in lecture_result.json()["sessions"])
    if lecture_result.json().get("proposal_id"):
        assert client.delete(f"/api/v1/scheduling/proposals/{lecture_result.json()['proposal_id']}").status_code == 204

    tutorial_result = client.post("/api/v1/scheduling/generate", json={**payload, "selected_requirement_ids": [tutorial["id"]]})
    assert tutorial_result.status_code == 200, tutorial_result.text
    assert all(item["session_type"] == "Tutorial" for item in tutorial_result.json()["sessions"])
    if tutorial_result.json().get("proposal_id"):
        assert client.delete(f"/api/v1/scheduling/proposals/{tutorial_result.json()['proposal_id']}").status_code == 204
    assert client.get(f"/api/v1/timetables/{fixture.group_a_id}/sessions").json() == before
