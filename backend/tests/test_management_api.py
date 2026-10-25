from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.models import Room, Subject, Teacher
from app.db.session import SessionLocal
from app.main import app
from tests.test_data import AcademicFixture


def test_resource_crud_duplicate_validation_and_lifecycle(academic_fixture: AcademicFixture):
    client = TestClient(app); fixture = academic_fixture; marker = uuid4().hex[:8].upper(); subject_id = teacher_id = room_id = None
    try:
        a_subjects = client.get(f"/api/v1/academic/subjects?institution_id={fixture.institution_a_id}")
        b_subjects = client.get(f"/api/v1/academic/subjects?institution_id={fixture.institution_b_id}")
        assert a_subjects.status_code == b_subjects.status_code == 200
        assert all(item["institution_id"] == fixture.institution_a_id for item in a_subjects.json())
        assert all(item["institution_id"] == fixture.institution_b_id for item in b_subjects.json())
        subject = client.post(f"/api/v1/academic/institutions/{fixture.institution_a_id}/subjects", json={"department_id": fixture.department_a_id, "code": f"TST{marker}", "name": "Test Subject", "active": True})
        assert subject.status_code == 201, subject.text; subject_id = subject.json()["id"]
        duplicate = client.post(f"/api/v1/academic/institutions/{fixture.institution_a_id}/subjects", json={"department_id": fixture.department_a_id, "code": f"TST{marker}", "name": "Duplicate"})
        assert duplicate.status_code == 409
        edited = client.patch(f"/api/v1/academic/subjects/{subject_id}", json={"name": "Renamed Test Subject", "active": False})
        assert edited.status_code == 200 and edited.json()["active"] is False
        inactive = client.post(f"/api/v1/timetables/{fixture.group_a_id}/sessions", json={"day": "thursday", "start_time": "14:00", "end_time": "15:00", "subject_id": subject_id, "teacher_id": fixture.teacher_a_id, "room_id": fixture.room_a_id, "session_type": "Lecture"})
        assert inactive.status_code == 422
        teacher = client.post(f"/api/v1/academic/institutions/{fixture.institution_a_id}/teachers", json={"department_id": fixture.department_a_id, "code": f"FAC{marker}", "name": "Test Teacher", "active": True})
        assert teacher.status_code == 201, teacher.text; teacher_id = teacher.json()["id"]
        room = client.post(f"/api/v1/academic/institutions/{fixture.institution_a_id}/rooms", json={"code": f"T-{marker}", "name": "Test Room", "room_type": "tutorial", "capacity": 24, "active": True})
        assert room.status_code == 201, room.text; room_id = room.json()["id"]
        invalid = client.post(f"/api/v1/academic/institutions/{fixture.institution_b_id}/subjects", json={"department_id": fixture.department_a_id, "code": f"BAD{marker}", "name": "Invalid association"})
        assert invalid.status_code == 422
    finally:
        with SessionLocal() as db:
            for model, record_id in ((Room, room_id), (Teacher, teacher_id), (Subject, subject_id)):
                if record_id and (record := db.get(model, record_id)): db.delete(record)
            db.commit()
