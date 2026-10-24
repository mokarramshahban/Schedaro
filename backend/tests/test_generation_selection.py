from fastapi.testclient import TestClient

from app.main import app


BASE_PAYLOAD = {
    "institution_id": "inst-northbridge",
    "academic_term_id": "term-northbridge-2026-spring",
    "class_group_ids": ["group-cs-sem1-a"],
    "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "daily_start_time": "09:00",
    "daily_end_time": "17:00",
    "quantum_minutes": 30,
    "time_limit_seconds": 3,
    "preference": "earlier",
    "preserve_existing": True,
}


def test_selected_requirement_ids_control_solver_and_discard_is_safe():
    client = TestClient(app)
    requirements = client.get("/api/v1/scheduling/class-groups/group-cs-sem1-a/requirements").json()
    lecture = next(item for item in requirements if item["session_type"] == "Lecture")
    tutorial = next(item for item in requirements if item["session_type"] == "Tutorial")
    before = client.get("/api/v1/timetables/group-cs-sem1-a/sessions").json()

    lecture_result = client.post("/api/v1/scheduling/generate", json={**BASE_PAYLOAD, "selected_requirement_ids": [lecture["id"]]})
    assert lecture_result.status_code == 200, lecture_result.text
    assert all(item["session_type"] != "Tutorial" for item in lecture_result.json()["sessions"])
    if lecture_result.json().get("proposal_id"):
        assert client.delete(f"/api/v1/scheduling/proposals/{lecture_result.json()['proposal_id']}").status_code == 204

    tutorial_result = client.post("/api/v1/scheduling/generate", json={**BASE_PAYLOAD, "selected_requirement_ids": [tutorial["id"]]})
    assert tutorial_result.status_code == 200, tutorial_result.text
    assert all(item["session_type"] == "Tutorial" for item in tutorial_result.json()["sessions"])
    if tutorial_result.json().get("proposal_id"):
        assert client.delete(f"/api/v1/scheduling/proposals/{tutorial_result.json()['proposal_id']}").status_code == 204

    after = client.get("/api/v1/timetables/group-cs-sem1-a/sessions").json()
    assert after == before
