"""Institution-neutral academic fixture factory for isolated backend tests."""
from dataclasses import dataclass
from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import AcademicTerm, ClassGroup, Department, Institution, Room, SchedulingRequirement, Semester, Subject, Teacher


def new_id() -> str:
    return str(uuid4())


@dataclass(frozen=True)
class AcademicFixture:
    institution_a_id: str
    institution_b_id: str
    department_a_id: str
    department_b_id: str
    term_a_id: str
    group_a_id: str
    group_b_id: str
    subject_a_id: str
    tutorial_subject_id: str
    teacher_a_id: str
    room_a_id: str


def seed_academic_fixture(db: Session) -> AcademicFixture:
    institution_a_id, institution_b_id = new_id(), new_id()
    department_a_id, department_b_id = new_id(), new_id()
    term_a_id, term_b_id = new_id(), new_id()
    semester_a_id, semester_b_id = new_id(), new_id()
    group_a_id, group_b_id = new_id(), new_id()
    subject_a_id, tutorial_subject_id = new_id(), new_id()
    teacher_a_id, teacher_b_id = new_id(), new_id()
    room_a_id, room_b_id = new_id(), new_id()
    db.add_all([
        Institution(id=institution_a_id, name=f"Test Institution {institution_a_id[:8]}", short_name=f"TA-{institution_a_id[:4]}", working_week="monday-saturday", active=True),
        Institution(id=institution_b_id, name=f"Other Institution {institution_b_id[:8]}", short_name=f"TB-{institution_b_id[:4]}", working_week="monday-saturday", active=True),
        Department(id=department_a_id, institution_id=institution_a_id, code="TST", name="Test Computing", active=True),
        Department(id=department_b_id, institution_id=institution_b_id, code="OTH", name="Other Computing", active=True),
        AcademicTerm(id=term_a_id, institution_id=institution_a_id, academic_year="2026", term="Spring", start_date=date(2026, 1, 12), end_date=date(2026, 5, 22), active=True),
        AcademicTerm(id=term_b_id, institution_id=institution_b_id, academic_year="2026", term="Spring", start_date=date(2026, 1, 12), end_date=date(2026, 5, 22), active=True),
        Semester(id=semester_a_id, department_id=department_a_id, number=1, label="Semester 1", active=True),
        Semester(id=semester_b_id, department_id=department_b_id, number=1, label="Semester 1", active=True),
        ClassGroup(id=group_a_id, department_id=department_a_id, semester_id=semester_a_id, academic_term_id=term_a_id, section_name="Section A", active=True),
        ClassGroup(id=group_b_id, department_id=department_a_id, semester_id=semester_a_id, academic_term_id=term_a_id, section_name="Section B", active=True),
        Subject(id=subject_a_id, institution_id=institution_a_id, department_id=department_a_id, semester_id=semester_a_id, code="TST101", name="Test Algorithms", active=True),
        Subject(id=tutorial_subject_id, institution_id=institution_a_id, department_id=department_a_id, semester_id=semester_a_id, code="TST102", name="Test Tutorial", active=True),
        Teacher(id=teacher_a_id, institution_id=institution_a_id, department_id=department_a_id, code="TST-T01", name="Test Faculty One", email=f"teacher-{teacher_a_id[:8]}@example.test", active=True),
        Teacher(id=teacher_b_id, institution_id=institution_a_id, department_id=department_a_id, code="TST-T02", name="Test Faculty Two", email=f"teacher-{teacher_b_id[:8]}@example.test", active=True),
        Room(id=room_a_id, institution_id=institution_a_id, code="TST-101", name="Test Classroom", room_type="classroom", capacity=60, active=True),
        Room(id=room_b_id, institution_id=institution_a_id, code="TST-LAB", name="Test Laboratory", room_type="laboratory", capacity=40, active=True),
        SchedulingRequirement(id=new_id(), class_group_id=group_a_id, subject_id=subject_a_id, teacher_id=teacher_a_id, session_type="Lecture", weekly_count=2, duration_minutes=60, room_type="classroom", active=True),
        SchedulingRequirement(id=new_id(), class_group_id=group_a_id, subject_id=tutorial_subject_id, teacher_id=teacher_b_id, session_type="Tutorial", weekly_count=1, duration_minutes=60, room_type="classroom", active=True),
    ])
    db.commit()
    return AcademicFixture(institution_a_id, institution_b_id, department_a_id, department_b_id, term_a_id, group_a_id, group_b_id, subject_a_id, tutorial_subject_id, teacher_a_id, room_a_id)
