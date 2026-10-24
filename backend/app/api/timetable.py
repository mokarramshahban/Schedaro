from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db.models import ClassGroup, Department, Room, Semester, Subject, Teacher, TimetableSession, new_id
from app.db.session import get_db
from app.schemas import SessionCreate, SessionUpdate, TimetableSessionRead
from app.services.scheduling import SchedulingEngineUnavailable, validate_candidate

router = APIRouter(prefix="/api/v1", tags=["timetable"])


def _clock(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _minutes(value: str) -> int:
    hours, minutes = (int(part) for part in value.split(":"))
    return hours * 60 + minutes


def _read(session: TimetableSession) -> TimetableSessionRead:
    return TimetableSessionRead(
        id=session.id,
        academic_term_id=session.academic_term_id,
        class_group_id=session.class_group_id,
        day=session.day_of_week,
        start_time=_clock(session.start_minute),
        end_time=_clock(session.end_minute),
        subject_id=session.subject_id,
        teacher_id=session.teacher_id,
        room_id=session.room_id,
        session_type=session.session_type,
        notes=session.notes,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def _conflict_response(conflicts: list[dict]) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Scheduling conflict", "conflicts": conflicts})


def _get_group(db: Session, class_group_id: str) -> ClassGroup:
    group = db.scalar(select(ClassGroup).options(selectinload(ClassGroup.department), selectinload(ClassGroup.semester), selectinload(ClassGroup.academic_term)).where(ClassGroup.id == class_group_id))
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Class group not found", "id": class_group_id})
    if group.semester.department_id != group.department_id or group.academic_term.institution_id != group.department.institution_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Class group has an invalid academic relationship."})
    return group


def _resource(db: Session, model, record_id: str, label: str):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": f"{label} is not available in this academic scope.", "field": f"{label.lower()}_id"})
    return record


def _validate_resources(db: Session, group: ClassGroup, subject_id: str, teacher_id: str, room_id: str, allow_inactive: set[str] | None = None):
    allow_inactive = allow_inactive or set()
    subject = _resource(db, Subject, subject_id, "Subject")
    teacher = _resource(db, Teacher, teacher_id, "Teacher")
    room = _resource(db, Room, room_id, "Room")
    institution_id = group.department.institution_id
    if not group.active or not group.department.active or not group.semester.active or not group.academic_term.active or not group.department.institution.active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "The selected academic scope is inactive."})
    if subject.institution_id != institution_id or subject.department_id not in {None, group.department_id} or (subject.semester_id not in {None, group.semester_id}):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Subject does not belong to the selected institution and academic scope.", "field": "subject_id"})
    if teacher.institution_id != institution_id or teacher.department_id not in {None, group.department_id}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Teacher does not belong to the selected institution and department.", "field": "teacher_id"})
    if room.institution_id != institution_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Room does not belong to the selected institution.", "field": "room_id"})
    for resource, field, label in ((subject, "subject_id", "Subject"), (teacher, "teacher_id", "Teacher"), (room, "room_id", "Room")):
        if not resource.active and resource.id not in allow_inactive:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": f"{label} is inactive and cannot be assigned to a new session.", "field": field})


def _validate_with_engine(db: Session, group: ClassGroup, candidate: dict) -> None:
    existing = list(db.scalars(select(TimetableSession).where(TimetableSession.academic_term_id == group.academic_term_id)))
    try:
        conflicts = validate_candidate(candidate, existing)
    except SchedulingEngineUnavailable as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(error)}) from error
    if conflicts:
        for conflict in conflicts:
            kind = conflict.get("kind")
            resource_id = conflict.get("resource_id")
            if kind == "teacher" and resource_id:
                teacher = db.get(Teacher, resource_id)
                label = teacher.name if teacher else resource_id
                conflict["message"] = f"Teacher {label} is already assigned on {candidate['day'].title()} from {_clock(conflict['start_minute'])} to {_clock(conflict['end_minute'])}."
            elif kind == "room" and resource_id:
                room = db.get(Room, resource_id)
                label = room.code if room else resource_id
                conflict["message"] = f"Room {label} is already booked on {candidate['day'].title()} from {_clock(conflict['start_minute'])} to {_clock(conflict['end_minute'])}."
            elif kind == "class_group":
                conflict["message"] = f"{group.section_name} already has a session on {candidate['day'].title()} from {_clock(conflict['start_minute'])} to {_clock(conflict['end_minute'])}."
        raise _conflict_response(conflicts)


@router.get("/timetables/{class_group_id}/sessions", response_model=list[TimetableSessionRead])
def list_sessions(class_group_id: str, db: Session = Depends(get_db)):
    _get_group(db, class_group_id)
    sessions = db.scalars(select(TimetableSession).where(TimetableSession.class_group_id == class_group_id).order_by(TimetableSession.day_of_week, TimetableSession.start_minute)).all()
    return [_read(session) for session in sessions]


@router.get("/timetable-sessions/{session_id}", response_model=TimetableSessionRead)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(TimetableSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Timetable session not found", "id": session_id})
    return _read(session)


@router.post("/timetables/{class_group_id}/sessions", response_model=TimetableSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(class_group_id: str, payload: SessionCreate, db: Session = Depends(get_db)):
    group = _get_group(db, class_group_id)
    _validate_resources(db, group, payload.subject_id, payload.teacher_id, payload.room_id)
    candidate = {"id": new_id(), "academic_term_id": group.academic_term_id, "class_group_id": group.id, "day": payload.day, "start_minute": _minutes(payload.start_time), "end_minute": _minutes(payload.end_time), "teacher_id": payload.teacher_id, "room_id": payload.room_id}
    _validate_with_engine(db, group, candidate)
    session = TimetableSession(id=candidate["id"], academic_term_id=group.academic_term_id, class_group_id=group.id, subject_id=payload.subject_id, teacher_id=payload.teacher_id, room_id=payload.room_id, day_of_week=payload.day, start_minute=candidate["start_minute"], end_minute=candidate["end_minute"], session_type=payload.session_type, notes=payload.notes)
    db.add(session)
    try:
        db.commit()
        db.refresh(session)
    except IntegrityError as error:
        db.rollback()
        raise _conflict_response([{"kind": "database_constraint", "message": "Another scheduling change committed a conflicting session. Refresh and try again."}]) from error
    return _read(session)


@router.patch("/timetable-sessions/{session_id}", response_model=TimetableSessionRead)
def update_session(session_id: str, payload: SessionUpdate, db: Session = Depends(get_db)):
    session = db.get(TimetableSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Timetable session not found", "id": session_id})
    group = _get_group(db, session.class_group_id)
    _validate_resources(db, group, payload.subject_id, payload.teacher_id, payload.room_id, {session.subject_id, session.teacher_id, session.room_id})
    candidate = {"id": session.id, "academic_term_id": session.academic_term_id, "class_group_id": session.class_group_id, "day": payload.day, "start_minute": _minutes(payload.start_time), "end_minute": _minutes(payload.end_time), "teacher_id": payload.teacher_id, "room_id": payload.room_id}
    _validate_with_engine(db, group, candidate)
    session.subject_id = payload.subject_id
    session.teacher_id = payload.teacher_id
    session.room_id = payload.room_id
    session.day_of_week = payload.day
    session.start_minute = candidate["start_minute"]
    session.end_minute = candidate["end_minute"]
    session.session_type = payload.session_type
    session.notes = payload.notes
    try:
        db.commit()
        db.refresh(session)
    except IntegrityError as error:
        db.rollback()
        raise _conflict_response([{"kind": "database_constraint", "message": "Another scheduling change committed a conflicting session. Refresh and try again."}]) from error
    return _read(session)


@router.delete("/timetable-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(TimetableSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Timetable session not found", "id": session_id})
    db.delete(session)
    db.commit()
