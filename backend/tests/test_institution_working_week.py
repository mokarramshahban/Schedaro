import json

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
NORTH = "inst-northbridge"
LAKESIDE = "inst-lakeside"


def test_institutions_keep_independent_working_weeks_and_generation_uses_saved_setting():
    north = client.get(f"/api/v1/academic/institutions/{NORTH}/working-week").json()
    lake = client.get(f"/api/v1/academic/institutions/{LAKESIDE}/working-week").json()
    assert north["working_week"] == "monday-saturday"
    assert lake["working_week"] == "monday-saturday"

    try:
        updated = client.patch(f"/api/v1/academic/institutions/{NORTH}/working-week", json={"working_week": "monday-friday"})
        assert updated.status_code == 200, updated.text
        assert updated.json()["working_days"] == ["monday", "tuesday", "wednesday", "thursday", "friday"]
        assert client.get(f"/api/v1/academic/institutions/{LAKESIDE}/working-week").json()["working_week"] == "monday-saturday"

        requirements = client.get("/api/v1/scheduling/class-groups/group-cs-sem1-a/requirements").json()
        tutorial = next(item for item in requirements if item["session_type"] == "Tutorial")
        payload = {
            "institution_id": NORTH,
            "academic_term_id": "term-northbridge-2026-spring",
            "class_group_ids": ["group-cs-sem1-a"],
            "selected_requirement_ids": [tutorial["id"]],
            "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
            "daily_start_time": "09:00",
            "daily_end_time": "17:00",
            "quantum_minutes": 30,
            "time_limit_seconds": 3,
            "preference": "balanced",
            "preserve_existing": True,
        }
        generated = client.post("/api/v1/scheduling/generate", json=payload)
        assert generated.status_code == 200, generated.text
        result = generated.json()
        assert result["working_days"] == ["monday", "tuesday", "wednesday", "thursday", "friday"]
        assert all(item["day"] != "saturday" for item in result["sessions"])
        if result.get("proposal_id"):
            assert client.delete(f"/api/v1/scheduling/proposals/{result['proposal_id']}").status_code == 204
    finally:
        assert client.patch(f"/api/v1/academic/institutions/{NORTH}/working-week", json={"working_week": "monday-saturday"}).status_code == 200


def test_manual_sessions_enforce_institution_working_week_and_preserve_exception_data():
    subject = "subject-algorithms"
    teacher = "teacher-lee"
    room = "room-201"
    group = "group-cs-sem1-a"
    session_id = None
    try:
        assert client.patch(f"/api/v1/academic/institutions/{NORTH}/working-week", json={"working_week": "monday-friday"}).status_code == 200
        forbidden = client.post(f"/api/v1/timetables/{group}/sessions", json={"day": "saturday", "start_time": "09:00", "end_time": "10:00", "subject_id": subject, "teacher_id": teacher, "room_id": room, "session_type": "Lecture"})
        assert forbidden.status_code == 422

        assert client.patch(f"/api/v1/academic/institutions/{NORTH}/working-week", json={"working_week": "monday-saturday"}).status_code == 200
        allowed = client.post(f"/api/v1/timetables/{group}/sessions", json={"day": "saturday", "start_time": "09:00", "end_time": "10:00", "subject_id": subject, "teacher_id": teacher, "room_id": room, "session_type": "Lecture"})
        assert allowed.status_code == 201, allowed.text
        session_id = allowed.json()["id"]

        switched = client.patch(f"/api/v1/academic/institutions/{NORTH}/working-week", json={"working_week": "monday-friday"})
        assert switched.status_code == 200
        assert switched.json()["saturday_exception_count"] >= 1
        assert "preserved" in (switched.json()["warning"] or "")
        assert any(item["id"] == session_id for item in client.get(f"/api/v1/timetables/{group}/sessions").json())
    finally:
        if session_id:
            assert client.delete(f"/api/v1/timetable-sessions/{session_id}").status_code == 204
        assert client.patch(f"/api/v1/academic/institutions/{NORTH}/working-week", json={"working_week": "monday-saturday"}).status_code == 200
