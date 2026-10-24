from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AcademicTerm, ClassGroup, Department, Institution, Room, Semester, Subject, Teacher
from app.db.session import get_db
from app.schemas import (
    AcademicResourcesRead,
    AcademicTermCreate,
    AcademicTermRead,
    AcademicTermUpdate,
    ClassGroupCreate,
    ClassGroupRead,
    ClassGroupUpdate,
    DepartmentCreate,
    DepartmentRead,
    DepartmentUpdate,
    InstitutionCreate,
    InstitutionRead,
    InstitutionUpdate,
    ResourceRead,
    RoomCreate,
    RoomRead,
    RoomUpdate,
    SemesterCreate,
    SemesterRead,
    SemesterUpdate,
    SetupResponse,
    SubjectCreate,
    SubjectRead,
    SubjectUpdate,
    TeacherCreate,
    TeacherRead,
    TeacherUpdate,
)
from app.seed import seed_demo_data

router = APIRouter(prefix="/api/v1/academic", tags=["academic"])


def _require(db: Session, model, record_id: str, label: str):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": f"{label} not found", "id": record_id})
    return record


def _commit(db: Session, record, label: str):
    db.add(record)
    try:
        db.commit()
        db.refresh(record)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": f"{label} conflicts with an existing record."}) from error
    return record


def _ensure_institution_active(institution: Institution) -> None:
    if not institution.active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "The selected institution is inactive."})


def _department_for_institution(db: Session, institution_id: str, department_id: str | None) -> Department | None:
    if department_id is None:
        return None
    department = _require(db, Department, department_id, "Department")
    if department.institution_id != institution_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Department does not belong to the selected institution.", "field": "department_id"})
    return department


def _semester_for_department(db: Session, department: Department, semester_id: str | None) -> Semester | None:
    if semester_id is None:
        return None
    semester = _require(db, Semester, semester_id, "Semester")
    if semester.department_id != department.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Semester does not belong to the selected department.", "field": "semester_id"})
    return semester


def _class_group_read(group: ClassGroup) -> ClassGroupRead:
    return ClassGroupRead(
        id=group.id,
        department_id=group.department_id,
        semester_id=group.semester_id,
        academic_term_id=group.academic_term_id,
        section_name=group.section_name,
        label=group.section_name,
        active=group.active,
    )


@router.get("/institutions", response_model=list[InstitutionRead])
def list_institutions(include_inactive: bool = True, db: Session = Depends(get_db)):
    query = select(Institution).order_by(Institution.name)
    if not include_inactive:
        query = query.where(Institution.active.is_(True))
    return list(db.scalars(query))


@router.get("/institutions/{institution_id}", response_model=InstitutionRead)
def get_institution(institution_id: str, db: Session = Depends(get_db)):
    return _require(db, Institution, institution_id, "Institution")


@router.post("/institutions", response_model=InstitutionRead, status_code=status.HTTP_201_CREATED)
def create_institution(payload: InstitutionCreate, db: Session = Depends(get_db)):
    institution = Institution(**payload.model_dump())
    db.add(institution)
    return _commit(db, institution, "Institution")


@router.patch("/institutions/{institution_id}", response_model=InstitutionRead)
def update_institution(institution_id: str, payload: InstitutionUpdate, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(institution, key, value)
    return _commit(db, institution, "Institution")


@router.get("/institutions/{institution_id}/departments", response_model=list[DepartmentRead])
def list_departments(institution_id: str, include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    query = select(Department).where(Department.institution_id == institution_id).order_by(Department.name)
    if not include_inactive:
        query = query.where(Department.active.is_(True))
    return list(db.scalars(query))


@router.post("/institutions/{institution_id}/departments", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(institution_id: str, payload: DepartmentCreate, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    _ensure_institution_active(institution)
    return _commit(db, Department(institution_id=institution_id, **payload.model_dump()), "Department")


@router.patch("/departments/{department_id}", response_model=DepartmentRead)
def update_department(department_id: str, payload: DepartmentUpdate, db: Session = Depends(get_db)):
    department = _require(db, Department, department_id, "Department")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)
    return _commit(db, department, "Department")


@router.get("/institutions/{institution_id}/terms", response_model=list[AcademicTermRead])
def list_terms(institution_id: str, include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    query = select(AcademicTerm).where(AcademicTerm.institution_id == institution_id).order_by(AcademicTerm.academic_year, AcademicTerm.term)
    if not include_inactive:
        query = query.where(AcademicTerm.active.is_(True))
    return list(db.scalars(query))


@router.post("/institutions/{institution_id}/terms", response_model=AcademicTermRead, status_code=status.HTTP_201_CREATED)
def create_term(institution_id: str, payload: AcademicTermCreate, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    _ensure_institution_active(institution)
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Term end date must be on or after its start date."})
    return _commit(db, AcademicTerm(institution_id=institution_id, **payload.model_dump()), "Academic term")


@router.patch("/terms/{term_id}", response_model=AcademicTermRead)
def update_term(term_id: str, payload: AcademicTermUpdate, db: Session = Depends(get_db)):
    term = _require(db, AcademicTerm, term_id, "Academic term")
    values = payload.model_dump(exclude_unset=True)
    start_date = values.get("start_date", term.start_date)
    end_date = values.get("end_date", term.end_date)
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Term end date must be on or after its start date."})
    for key, value in values.items():
        setattr(term, key, value)
    return _commit(db, term, "Academic term")


@router.get("/departments/{department_id}/semesters", response_model=list[SemesterRead])
def list_semesters(department_id: str, include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Department, department_id, "Department")
    query = select(Semester).where(Semester.department_id == department_id).order_by(Semester.number)
    if not include_inactive:
        query = query.where(Semester.active.is_(True))
    return list(db.scalars(query))


@router.post("/departments/{department_id}/semesters", response_model=SemesterRead, status_code=status.HTTP_201_CREATED)
def create_semester(department_id: str, payload: SemesterCreate, db: Session = Depends(get_db)):
    department = _require(db, Department, department_id, "Department")
    if not department.active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "The selected department is inactive."})
    return _commit(db, Semester(department_id=department_id, **payload.model_dump()), "Semester")


@router.patch("/semesters/{semester_id}", response_model=SemesterRead)
def update_semester(semester_id: str, payload: SemesterUpdate, db: Session = Depends(get_db)):
    semester = _require(db, Semester, semester_id, "Semester")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(semester, key, value)
    return _commit(db, semester, "Semester")


@router.get("/semesters/{semester_id}/class-groups", response_model=list[ClassGroupRead])
def list_class_groups(semester_id: str, include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Semester, semester_id, "Semester")
    query = select(ClassGroup).where(ClassGroup.semester_id == semester_id).order_by(ClassGroup.section_name)
    if not include_inactive:
        query = query.where(ClassGroup.active.is_(True))
    return [_class_group_read(group) for group in db.scalars(query)]


@router.get("/class-groups", response_model=list[ClassGroupRead])
def list_all_class_groups(institution_id: str, department_id: str | None = None, include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    query = select(ClassGroup).join(ClassGroup.department).where(Department.institution_id == institution_id).order_by(ClassGroup.section_name)
    if department_id:
        query = query.where(ClassGroup.department_id == department_id)
    if not include_inactive:
        query = query.where(ClassGroup.active.is_(True))
    return [_class_group_read(group) for group in db.scalars(query)]


@router.post("/semesters/{semester_id}/class-groups", response_model=ClassGroupRead, status_code=status.HTTP_201_CREATED)
def create_class_group(semester_id: str, payload: ClassGroupCreate, db: Session = Depends(get_db)):
    semester = _require(db, Semester, semester_id, "Semester")
    department = _require(db, Department, payload.department_id, "Department")
    if semester.department_id != department.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Semester and department do not match.", "field": "department_id"})
    term = _require(db, AcademicTerm, payload.academic_term_id, "Academic term")
    institution = _require(db, Institution, department.institution_id, "Institution")
    if term.institution_id != institution.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Academic term does not belong to the selected institution.", "field": "academic_term_id"})
    if not institution.active or not department.active or not semester.active or not term.active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "An active institution, department, semester, and academic term are required."})
    group = _commit(db, ClassGroup(semester_id=semester_id, **payload.model_dump()), "Class group")
    return _class_group_read(group)


@router.patch("/class-groups/{class_group_id}", response_model=ClassGroupRead)
def update_class_group(class_group_id: str, payload: ClassGroupUpdate, db: Session = Depends(get_db)):
    group = _require(db, ClassGroup, class_group_id, "Class group")
    values = payload.model_dump(exclude_unset=True)
    department_id = values.get("department_id", group.department_id)
    semester_id = values.get("semester_id", group.semester_id)
    term_id = values.get("academic_term_id", group.academic_term_id)
    department = _require(db, Department, department_id, "Department")
    semester = _require(db, Semester, semester_id, "Semester")
    term = _require(db, AcademicTerm, term_id, "Academic term")
    if semester.department_id != department.id or term.institution_id != department.institution_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Class group academic relationships do not match."})
    for key, value in values.items():
        setattr(group, key, value)
    return _class_group_read(_commit(db, group, "Class group"))


@router.get("/subjects", response_model=list[SubjectRead])
def list_subjects(institution_id: str, department_id: str | None = None, semester_id: str | None = None, search: str | None = Query(default=None, max_length=80), include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    query = select(Subject).where(Subject.institution_id == institution_id).order_by(Subject.code)
    if department_id:
        query = query.where(or_(Subject.department_id == department_id, Subject.department_id.is_(None)))
    if semester_id:
        query = query.where(or_(Subject.semester_id == semester_id, Subject.semester_id.is_(None)))
    if search:
        query = query.where(or_(Subject.code.ilike(f"%{search}%"), Subject.name.ilike(f"%{search}%")))
    if not include_inactive:
        query = query.where(Subject.active.is_(True))
    return list(db.scalars(query))


@router.get("/subjects/{subject_id}", response_model=SubjectRead)
def get_subject(subject_id: str, db: Session = Depends(get_db)):
    return _require(db, Subject, subject_id, "Subject")


@router.post("/institutions/{institution_id}/subjects", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(institution_id: str, payload: SubjectCreate, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    _ensure_institution_active(institution)
    department = _department_for_institution(db, institution_id, payload.department_id)
    if payload.semester_id and department is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "A semester requires a department association.", "field": "department_id"})
    _semester_for_department(db, department, payload.semester_id) if department else None
    return _commit(db, Subject(institution_id=institution_id, **payload.model_dump()), "Subject")


@router.patch("/subjects/{subject_id}", response_model=SubjectRead)
def update_subject(subject_id: str, payload: SubjectUpdate, db: Session = Depends(get_db)):
    subject = _require(db, Subject, subject_id, "Subject")
    values = payload.model_dump(exclude_unset=True)
    department_id = values.get("department_id", subject.department_id)
    semester_id = values.get("semester_id", subject.semester_id)
    department = _department_for_institution(db, subject.institution_id, department_id)
    if semester_id and department is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "A semester requires a department association.", "field": "department_id"})
    _semester_for_department(db, department, semester_id) if department else None
    for key, value in values.items():
        setattr(subject, key, value)
    return _commit(db, subject, "Subject")


@router.get("/teachers", response_model=list[TeacherRead])
def list_teachers(institution_id: str, department_id: str | None = None, search: str | None = Query(default=None, max_length=80), include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    query = select(Teacher).where(Teacher.institution_id == institution_id).order_by(Teacher.name)
    if department_id:
        query = query.where(or_(Teacher.department_id == department_id, Teacher.department_id.is_(None)))
    if search:
        query = query.where(or_(Teacher.name.ilike(f"%{search}%"), Teacher.code.ilike(f"%{search}%"), Teacher.email.ilike(f"%{search}%")))
    if not include_inactive:
        query = query.where(Teacher.active.is_(True))
    return list(db.scalars(query))


@router.get("/teachers/{teacher_id}", response_model=TeacherRead)
def get_teacher(teacher_id: str, db: Session = Depends(get_db)):
    return _require(db, Teacher, teacher_id, "Teacher")


@router.post("/institutions/{institution_id}/teachers", response_model=TeacherRead, status_code=status.HTTP_201_CREATED)
def create_teacher(institution_id: str, payload: TeacherCreate, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    _ensure_institution_active(institution)
    _department_for_institution(db, institution_id, payload.department_id)
    return _commit(db, Teacher(institution_id=institution_id, **payload.model_dump()), "Teacher")


@router.patch("/teachers/{teacher_id}", response_model=TeacherRead)
def update_teacher(teacher_id: str, payload: TeacherUpdate, db: Session = Depends(get_db)):
    teacher = _require(db, Teacher, teacher_id, "Teacher")
    values = payload.model_dump(exclude_unset=True)
    _department_for_institution(db, teacher.institution_id, values.get("department_id", teacher.department_id))
    for key, value in values.items():
        setattr(teacher, key, value)
    return _commit(db, teacher, "Teacher")


@router.get("/rooms", response_model=list[RoomRead])
def list_rooms(institution_id: str, search: str | None = Query(default=None, max_length=80), room_type: str | None = None, include_inactive: bool = True, db: Session = Depends(get_db)):
    _require(db, Institution, institution_id, "Institution")
    query = select(Room).where(Room.institution_id == institution_id).order_by(Room.code)
    if search:
        query = query.where(or_(Room.code.ilike(f"%{search}%"), Room.name.ilike(f"%{search}%"), Room.building.ilike(f"%{search}%")))
    if room_type:
        query = query.where(Room.room_type == room_type)
    if not include_inactive:
        query = query.where(Room.active.is_(True))
    return list(db.scalars(query))


@router.get("/rooms/{room_id}", response_model=RoomRead)
def get_room(room_id: str, db: Session = Depends(get_db)):
    return _require(db, Room, room_id, "Room")


@router.post("/institutions/{institution_id}/rooms", response_model=RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(institution_id: str, payload: RoomCreate, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    _ensure_institution_active(institution)
    return _commit(db, Room(institution_id=institution_id, **payload.model_dump()), "Room")


@router.patch("/rooms/{room_id}", response_model=RoomRead)
def update_room(room_id: str, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = _require(db, Room, room_id, "Room")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    return _commit(db, room, "Room")


@router.get("/resources", response_model=AcademicResourcesRead)
def list_resources(institution_id: str, department_id: str, semester_id: str | None = None, db: Session = Depends(get_db)):
    institution = _require(db, Institution, institution_id, "Institution")
    department = _require(db, Department, department_id, "Department")
    if department.institution_id != institution.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Department does not belong to the selected institution."})
    if semester_id:
        _semester_for_department(db, department, semester_id)
    subject_query = select(Subject).where(Subject.institution_id == institution_id, (Subject.department_id == department_id) | (Subject.department_id.is_(None)))
    if semester_id:
        subject_query = subject_query.where((Subject.semester_id == semester_id) | (Subject.semester_id.is_(None)))
    subjects = db.scalars(subject_query.order_by(Subject.code)).all()
    teachers = db.scalars(select(Teacher).where(Teacher.institution_id == institution_id, (Teacher.department_id == department_id) | (Teacher.department_id.is_(None))).order_by(Teacher.name)).all()
    rooms = db.scalars(select(Room).where(Room.institution_id == institution_id).order_by(Room.code)).all()
    return AcademicResourcesRead(
        subjects=[ResourceRead(id=item.id, code=item.code, name=f"{item.code} · {item.name}", active=item.active, department_id=item.department_id, semester_id=item.semester_id, description=item.description) for item in subjects],
        teachers=[ResourceRead(id=item.id, code=item.code, name=item.name, active=item.active, department_id=item.department_id, email=item.email) for item in teachers],
        rooms=[ResourceRead(id=item.id, code=item.code, name=f"{item.code} · {item.name}", room_type=item.room_type, active=item.active, building=item.building, capacity=item.capacity) for item in rooms],
    )


@router.post("/setup", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
def provision_development_setup(db: Session = Depends(get_db)):
    if get_settings().app_env.lower() in {"production", "prod"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Development setup is disabled in production."})
    created, counts, message = seed_demo_data(db)
    return SetupResponse(created=created, institution_id="inst-northbridge", message=message, counts=counts)
