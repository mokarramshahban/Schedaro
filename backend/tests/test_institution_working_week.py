from fastapi.testclient import TestClient

from app.main import app
from tests.test_data import AcademicFixture


def test_institutions_keep_independent_working_weeks_and_generation_uses_saved_setting(academic_fixture: AcademicFixture):
    client = TestClient(app); fixture = academic_fixture
    assert client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-saturday"}).status_code == 200
    assert client.patch(f"/api/v1/academic/institutions/{fixture.institution_b_id}/working-week", json={"working_week": "monday-saturday"}).status_code == 200
    assert client.get(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week").json()["working_week"] == "monday-saturday"
    assert client.get(f"/api/v1/academic/institutions/{fixture.institution_b_id}/working-week").json()["working_week"] == "monday-saturday"
    updated = client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-friday"})
    assert updated.status_code == 200
    assert updated.json()["working_days"] == ["monday", "tuesday", "wednesday", "thursday", "friday"]
    assert client.get(f"/api/v1/academic/institutions/{fixture.institution_b_id}/working-week").json()["working_week"] == "monday-saturday"
    requirements = client.get(f"/api/v1/scheduling/class-groups/{fixture.group_a_id}/requirements").json()
    tutorial = next(item for item in requirements if item["session_type"] == "Tutorial" and item["active"])
    payload = {"institution_id": fixture.institution_a_id, "academic_term_id": fixture.term_a_id, "class_group_ids": [fixture.group_a_id], "selected_requirement_ids": [tutorial["id"]], "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], "daily_start_time": "09:00", "daily_end_time": "17:00", "quantum_minutes": 30, "time_limit_seconds": 3, "preference": "balanced", "preserve_existing": True}
    generated = client.post("/api/v1/scheduling/generate", json=payload)
    assert generated.status_code == 200, generated.text
    assert generated.json()["working_days"] == ["monday", "tuesday", "wednesday", "thursday", "friday"]
    assert all(item["day"] != "saturday" for item in generated.json()["sessions"])
    if generated.json().get("proposal_id"):
        assert client.delete(f"/api/v1/scheduling/proposals/{generated.json()['proposal_id']}").status_code == 204
    assert client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-saturday"}).status_code == 200


def test_manual_sessions_enforce_institution_working_week_and_preserve_exception_data(academic_fixture: AcademicFixture):
    client = TestClient(app); fixture = academic_fixture
    assert client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-friday"}).status_code == 200
    payload = {"day": "saturday", "start_time": "09:00", "end_time": "10:00", "subject_id": fixture.subject_a_id, "teacher_id": fixture.teacher_a_id, "room_id": fixture.room_a_id, "session_type": "Lecture"}
    forbidden = client.post(f"/api/v1/timetables/{fixture.group_a_id}/sessions", json=payload)
    assert forbidden.status_code == 422
    assert client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-saturday"}).status_code == 200
    allowed = client.post(f"/api/v1/timetables/{fixture.group_a_id}/sessions", json=payload)
    assert allowed.status_code == 201, allowed.text
    session_id = allowed.json()["id"]
    switched = client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-friday"})
    assert switched.status_code == 200
    assert switched.json()["saturday_exception_count"] >= 1
    assert "preserved" in (switched.json()["warning"] or "")
    assert any(item["id"] == session_id for item in client.get(f"/api/v1/timetables/{fixture.group_a_id}/sessions").json())
    assert client.delete(f"/api/v1/timetable-sessions/{session_id}").status_code == 204
    assert client.patch(f"/api/v1/academic/institutions/{fixture.institution_a_id}/working-week", json={"working_week": "monday-saturday"}).status_code == 200
