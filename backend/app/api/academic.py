from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AcademicTerm, ClassGroup, Department, Institution, Room, Semester, Subject, Teacher
from app.db.session import get_db
from app.schemas import AcademicResourcesRead, AcademicTermRead, ClassGroupRead, DepartmentRead, InstitutionRead, ResourceRead, SemesterRead, SetupResponse
from app.seed import seed_demo_data

router = APIRouter(prefix="/api/v1/academic", tags=["academic"])


def _require(db: Session, model, record_id: str, label: str):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": f"{label} not found", "id": record_id})
    return record


@router.get("/institutions", response_model=list[InstitutionRead])
def list_institutions(db: Session = Depends(get_db)):
    return list(db.scalars(select(Institution).order_by(Institution.name)))


@router.get("/institutions/{institution_id}/departments", response_model=list[DepartmentRead])
def list_departments(institution_id: str, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    return list(db.scalars(select(Department).where(Department.institution_id == institution_id).order_by(Department.name)))


@router.get("/institutions/{institution_id}/terms", response_model=list[AcademicTermRead])
def list_terms(institution_id: str, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    return list(db.scalars(select(AcademicTerm).where(AcademicTerm.institution_id == institution_id).order_by(AcademicTerm.academic_year, AcademicTerm.term)))


@router.get("/departments/{department_id}/semesters", response_model=list[SemesterRead])
def list_semesters(department_id: str, db: Session = Depends(get_db)):
    _require(db, Department, department_id, "Department")
    return list(db.scalars(select(Semester).where(Semester.department_id == department_id).order_by(Semester.number)))


@router.get("/semesters/{semester_id}/class-groups", response_model=list[ClassGroupRead])
def list_class_groups(semester_id: str, db: Session = Depends(get_db)):
    semester = _require(db, Semester, semester_id, "Semester")
    groups = list(db.scalars(select(ClassGroup).where(ClassGroup.semester_id == semester_id).order_by(ClassGroup.section_name)))
    return [
        ClassGroupRead(
            id=group.id,
            department_id=group.department_id,
            semester_id=group.semester_id,
            academic_term_id=group.academic_term_id,
            section_name=group.section_name,
            label=group.section_name,
        )
        for group in groups
    ]


@router.get("/resources", response_model=AcademicResourcesRead)
def list_resources(institution_id: str, department_id: str, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    department = _require(db, Department, department_id, "Department")
    if department.institution_id != institution.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Department does not belong to the selected institution."})
    subjects = db.scalars(select(Subject).where(Subject.institution_id == institution_id, (Subject.department_id == department_id) | (Subject.department_id.is_(None))).order_by(Subject.code)).all()
    teachers = db.scalars(select(Teacher).where(Teacher.institution_id == institution_id, (Teacher.department_id == department_id) | (Teacher.department_id.is_(None))).order_by(Teacher.name)).all()
    rooms = db.scalars(select(Room).where(Room.institution_id == institution_id).order_by(Room.code)).all()
    return AcademicResourcesRead(
        subjects=[ResourceRead(id=item.id, code=item.code, name=f"{item.code} · {item.name}") for item in subjects],
        teachers=[ResourceRead(id=item.id, name=item.name) for item in teachers],
        rooms=[ResourceRead(id=item.id, code=item.code, name=f"{item.code} · {item.name}", room_type=item.room_type) for item in rooms],
    )


@router.post("/setup", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
def provision_development_setup(db: Session = Depends(get_db)):
    if get_settings().app_env.lower() in {"production", "prod"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Development setup is disabled in production."})
    created, counts, message = seed_demo_data(db)
    return SetupResponse(created=created, institution_id="inst-northbridge", message=message, counts=counts)
