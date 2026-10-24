"""Explicit, idempotent local development seed data.

Run with: python -m app.seed
This never runs automatically as part of migrations or application startup.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.db.models import AcademicTerm, ClassGroup, Department, Institution, Room, Semester, Subject, Teacher, TimetableSession
from app.db.session import SessionLocal


def _get_or_create(db: Session, model, record_id: str, **values):
    record = db.get(model, record_id)
    created = record is None
    if created:
        record = model(id=record_id, **values)
        db.add(record)
    return record, created


def seed_demo_data(db: Session) -> tuple[bool, dict[str, int], str]:
    counts = {"institutions": 0, "departments": 0, "terms": 0, "semesters": 0, "class_groups": 0, "subjects": 0, "teachers": 0, "rooms": 0, "sessions": 0}
    created_any = False

    northbridge, created = _get_or_create(db, Institution, "inst-northbridge", name="Schedaro Demo College")
    counts["institutions"] += int(created)
    created_any = created_any or created
    lakeside, created = _get_or_create(db, Institution, "inst-lakeside", name="Lakeside Institute")
    counts["institutions"] += int(created)
    created_any = created_any or created
    db.flush()

    cs, created = _get_or_create(db, Department, "dept-computing", institution_id=northbridge.id, name="Computer Science and Engineering")
    counts["departments"] += int(created)
    created_any = created_any or created
    mechanical, created = _get_or_create(db, Department, "dept-mechanical", institution_id=northbridge.id, name="Mechanical Engineering")
    counts["departments"] += int(created)
    created_any = created_any or created
    electronics, created = _get_or_create(db, Department, "dept-electronics", institution_id=lakeside.id, name="Electronics and Communication Engineering")
    counts["departments"] += int(created)
    created_any = created_any or created

    spring, created = _get_or_create(db, AcademicTerm, "term-northbridge-2026-spring", institution_id=northbridge.id, academic_year="2026", term="Spring", start_date=date(2026, 1, 12), end_date=date(2026, 5, 22), active=True)
    counts["terms"] += int(created)
    created_any = created_any or created
    lakeside_term, created = _get_or_create(db, AcademicTerm, "term-lakeside-2026-spring", institution_id=lakeside.id, academic_year="2026", term="Spring", start_date=date(2026, 1, 12), end_date=date(2026, 5, 22), active=True)
    counts["terms"] += int(created)
    created_any = created_any or created

    semesters: dict[str, Semester] = {}
    for department, prefix in ((cs, "cs"), (mechanical, "me"), (electronics, "ec")):
        for number in (1, 2, 3, 4):
            semester, created = _get_or_create(db, Semester, f"semester-{prefix}-{number}", department_id=department.id, number=number, label=f"Semester {number}")
            semesters[semester.id] = semester
            counts["semesters"] += int(created)
            created_any = created_any or created
    db.flush()

    groups: dict[str, ClassGroup] = {}
    for record_id, department, semester_id, term, section in (
        ("group-cs-sem1-a", cs, "semester-cs-1", spring, "Section A"),
        ("group-cs-sem1-b", cs, "semester-cs-1", spring, "Section B"),
        ("group-cs-sem2-a", cs, "semester-cs-2", spring, "Section A"),
        ("group-me-sem1-a", mechanical, "semester-me-1", spring, "Section A"),
        ("group-ec-sem1-a", electronics, "semester-ec-1", lakeside_term, "Section A"),
    ):
        group, created = _get_or_create(db, ClassGroup, record_id, department_id=department.id, semester_id=semester_id, academic_term_id=term.id, section_name=section)
        groups[group.id] = group
        counts["class_groups"] += int(created)
        created_any = created_any or created

    subjects = {}
    for record_id, institution, department, code, name in (
        ("subject-algorithms", northbridge, cs, "CSE101", "Algorithms and Data Structures"),
        ("subject-databases", northbridge, cs, "CSE102", "Database Systems"),
        ("subject-web", northbridge, cs, "CSE103", "Web Engineering"),
        ("subject-mechanics", northbridge, mechanical, "MEC101", "Engineering Mechanics"),
        ("subject-circuits", lakeside, electronics, "ECE101", "Digital Circuits"),
    ):
        subject, created = _get_or_create(db, Subject, record_id, institution_id=institution.id, department_id=department.id, code=code, name=name)
        subjects[subject.id] = subject
        counts["subjects"] += int(created)
        created_any = created_any or created

    teachers = {}
    for record_id, institution, department, name, email in (
        ("teacher-lee", northbridge, cs, "Instructor One", "instructor.one@schedaro.local"),
        ("teacher-amin", northbridge, cs, "Instructor Two", "instructor.two@schedaro.local"),
        ("teacher-mehta", northbridge, mechanical, "Instructor Three", "instructor.three@schedaro.local"),
        ("teacher-lakeside", lakeside, electronics, "Instructor Four", "instructor.four@schedaro.local"),
    ):
        teacher, created = _get_or_create(db, Teacher, record_id, institution_id=institution.id, department_id=department.id, name=name, email=email)
        teachers[teacher.id] = teacher
        counts["teachers"] += int(created)
        created_any = created_any or created

    rooms = {}
    for record_id, institution, code, name, room_type in (
        ("room-201", northbridge, "ROOM-201", "Lecture Room 201", "classroom"),
        ("room-305", northbridge, "ROOM-305", "Lecture Room 305", "classroom"),
        ("lab-1", northbridge, "LAB-1", "Computing Laboratory 1", "laboratory"),
        ("room-lakeside-101", lakeside, "ROOM-101", "Lakeside Lecture Room 101", "classroom"),
    ):
        room, created = _get_or_create(db, Room, record_id, institution_id=institution.id, code=code, name=name, room_type=room_type)
        rooms[room.id] = room
        counts["rooms"] += int(created)
        created_any = created_any or created
    db.flush()

    session_records = (
        ("session-cs-a-1", spring, groups["group-cs-sem1-a"], subjects["subject-algorithms"], teachers["teacher-lee"], rooms["room-201"], "monday", 540, 600, "Lecture"),
        ("session-cs-a-2", spring, groups["group-cs-sem1-a"], subjects["subject-databases"], teachers["teacher-amin"], rooms["room-305"], "wednesday", 660, 750, "Lecture"),
        ("session-cs-b-1", spring, groups["group-cs-sem1-b"], subjects["subject-web"], teachers["teacher-lee"], rooms["room-201"], "monday", 660, 750, "Laboratory"),
        ("session-me-1", spring, groups["group-me-sem1-a"], subjects["subject-mechanics"], teachers["teacher-mehta"], rooms["room-305"], "tuesday", 600, 660, "Lecture"),
    )
    for record_id, term, group, subject, teacher, room, day, start, end, session_type in session_records:
        session = db.get(TimetableSession, record_id)
        if session is None:
            db.add(TimetableSession(id=record_id, academic_term_id=term.id, class_group_id=group.id, subject_id=subject.id, teacher_id=teacher.id, room_id=room.id, day_of_week=day, start_minute=start, end_minute=end, session_type=session_type))
            counts["sessions"] += 1
            created_any = True

    db.commit()
    message = "Development academic data was already present." if not created_any else "Development academic data was provisioned idempotently."
    return created_any, counts, message


def main() -> None:
    with SessionLocal() as db:
        created, counts, message = seed_demo_data(db)
    print({"created": created, "counts": counts, "message": message})


if __name__ == "__main__":
    main()
