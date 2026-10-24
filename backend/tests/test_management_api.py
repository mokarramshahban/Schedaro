from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.models import Room, Subject, Teacher
from app.db.session import SessionLocal
from app.main import app


def test_resource_crud_duplicate_validation_and_lifecycle():
    client = TestClient(app)
    marker = uuid4().hex[:8].upper()
    subject_id = teacher_id = room_id = None
    try:
        subject = client.post(
            "/api/v1/academic/institutions/inst-northbridge/subjects",
            json={"department_id": "dept-computing", "code": f"TST{marker}", "name": "Stage 4 Test Subject", "active": True},
        )
        assert subject.status_code == 201, subject.text
        subject_id = subject.json()["id"]
        assert any(item["id"] == subject_id for item in client.get("/api/v1/academic/subjects?institution_id=inst-northbridge").json())

        duplicate = client.post(
            "/api/v1/academic/institutions/inst-northbridge/subjects",
            json={"department_id": "dept-computing", "code": f"TST{marker}", "name": "Duplicate"},
        )
        assert duplicate.status_code == 409

        edited = client.patch(f"/api/v1/academic/subjects/{subject_id}", json={"name": "Renamed Stage 4 Test Subject", "active": False})
        assert edited.status_code == 200
        assert edited.json()["name"] == "Renamed Stage 4 Test Subject"
        assert edited.json()["active"] is False
        inactive_assignment = client.post(
            "/api/v1/timetables/group-cs-sem1-a/sessions",
            json={"day": "thursday", "start_time": "14:00", "end_time": "15:00", "subject_id": subject_id, "teacher_id": "teacher-lee", "room_id": "room-201", "session_type": "Lecture"},
        )
        assert inactive_assignment.status_code == 422

        teacher = client.post(
            "/api/v1/academic/institutions/inst-northbridge/teachers",
            json={"department_id": "dept-computing", "code": f"FAC{marker}", "name": "Stage 4 Test Teacher", "active": True},
        )
        assert teacher.status_code == 201, teacher.text
        teacher_id = teacher.json()["id"]

        room = client.post(
            "/api/v1/academic/institutions/inst-northbridge/rooms",
            json={"code": f"T-{marker}", "name": "Stage 4 Test Room", "room_type": "tutorial", "capacity": 24, "active": True},
        )
        assert room.status_code == 201, room.text
        room_id = room.json()["id"]

        invalid = client.post(
            "/api/v1/academic/institutions/inst-lakeside/subjects",
            json={"department_id": "dept-computing", "code": f"BAD{marker}", "name": "Invalid association"},
        )
        assert invalid.status_code == 422
    finally:
        with SessionLocal() as db:
            for model, record_id in ((Room, room_id), (Teacher, teacher_id), (Subject, subject_id)):
                if record_id:
                    record = db.get(model, record_id)
                    if record:
                        db.delete(record)
            db.commit()
