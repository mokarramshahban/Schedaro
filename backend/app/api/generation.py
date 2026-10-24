from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.timetable import _get_group, _read, _validate_resources
from app.db.models import AcademicTerm, ClassGroup, Institution, Room, SchedulingRequirement, Subject, Teacher, TeacherAvailability, TimetableProposal, TimetableSession, new_id
from app.db.session import get_db
from app.schemas import ApproveProposalResponse, GenerateTimetableRequest, GenerateTimetableResponse, GeneratedSessionRead, SchedulingRequirementCreate, SchedulingRequirementRead, SchedulingRequirementUpdate, TeacherAvailabilityCreate, TeacherAvailabilityRead
from app.services.generator import GenerationConfig, GeneratorUnavailable, clock_minutes, clock_value, generate_candidate, requirement_summary
from app.services.scheduling import SchedulingEngineUnavailable, validate_candidate

router = APIRouter(prefix="/api/v1/scheduling", tags=["scheduling"])


def _availability_read(value: TeacherAvailability) -> TeacherAvailabilityRead:
    return TeacherAvailabilityRead(id=value.id, teacher_id=value.teacher_id, academic_term_id=value.academic_term_id, day=value.day_of_week, start_time=clock_value(value.start_minute), end_time=clock_value(value.end_minute), available=value.available)


def _candidate_read(value: dict, generated: bool = True) -> GeneratedSessionRead:
    return GeneratedSessionRead(id=value["id"], academic_term_id=value["academic_term_id"], class_group_id=value["class_group_id"], day=value["day"], start_time=clock_value(value["start_minute"]), end_time=clock_value(value["end_minute"]), subject_id=value["subject_id"], teacher_id=value["teacher_id"], room_id=value["room_id"], session_type=value["session_type"], locked=value.get("locked", False), generated=generated)


def _model_candidate(value: dict) -> TimetableSession:
    return TimetableSession(id=value["id"], academic_term_id=value["academic_term_id"], class_group_id=value["class_group_id"], day_of_week=value["day"], start_minute=value["start_minute"], end_minute=value["end_minute"], subject_id=value["subject_id"], teacher_id=value["teacher_id"], room_id=value["room_id"], session_type=value["session_type"], locked=False)


def _require_institution_term(db: Session, institution_id: str, term_id: str) -> AcademicTerm:
    institution = db.get(Institution, institution_id)
    if institution is None or not institution.active:
        raise HTTPException(status_code=422, detail={"message": "The selected institution is unavailable."})
    term = db.get(AcademicTerm, term_id)
    if term is None or term.institution_id != institution_id or not term.active:
        raise HTTPException(status_code=422, detail={"message": "The selected academic term does not belong to the institution."})
    return term


def _validate_requirement_scope(db: Session, group: ClassGroup, subject_id: str, teacher_id: str) -> None:
    subject = db.get(Subject, subject_id)
    teacher = db.get(Teacher, teacher_id)
    if subject is None or teacher is None or subject.institution_id != group.department.institution_id or teacher.institution_id != group.department.institution_id:
        raise HTTPException(status_code=422, detail={"message": "Subject and teacher must belong to the selected institution."})
    if subject.department_id not in {None, group.department_id} or subject.semester_id not in {None, group.semester_id} or teacher.department_id not in {None, group.department_id}:
        raise HTTPException(status_code=422, detail={"message": "Subject and teacher must match the selected academic scope."})


@router.get("/class-groups/{class_group_id}/requirements", response_model=list[SchedulingRequirementRead])
def list_requirements(class_group_id: str, db: Session = Depends(get_db)):
    _get_group(db, class_group_id)
    return list(db.scalars(select(SchedulingRequirement).where(SchedulingRequirement.class_group_id == class_group_id).order_by(SchedulingRequirement.subject_id, SchedulingRequirement.session_type)))


@router.post("/class-groups/{class_group_id}/requirements", response_model=SchedulingRequirementRead, status_code=status.HTTP_201_CREATED)
def create_requirement(class_group_id: str, payload: SchedulingRequirementCreate, db: Session = Depends(get_db)):
    group = _get_group(db, class_group_id)
    _validate_requirement_scope(db, group, payload.subject_id, payload.teacher_id)
    value = SchedulingRequirement(class_group_id=class_group_id, **payload.model_dump())
    db.add(value)
    try:
        db.commit(); db.refresh(value)
    except IntegrityError as error:
        db.rollback(); raise HTTPException(status_code=409, detail={"message": "A requirement for this subject and session type already exists for the class group."}) from error
    return value


@router.patch("/requirements/{requirement_id}", response_model=SchedulingRequirementRead)
def update_requirement(requirement_id: str, payload: SchedulingRequirementUpdate, db: Session = Depends(get_db)):
    value = db.get(SchedulingRequirement, requirement_id)
    if value is None:
        raise HTTPException(status_code=404, detail={"message": "Scheduling requirement not found."})
    group = _get_group(db, value.class_group_id)
    updates = payload.model_dump(exclude_unset=True)
    if "subject_id" in updates or "teacher_id" in updates:
        _validate_requirement_scope(db, group, updates.get("subject_id", value.subject_id), updates.get("teacher_id", value.teacher_id))
    for key, item in updates.items(): setattr(value, key, item)
    try:
        db.commit(); db.refresh(value)
    except IntegrityError as error:
        db.rollback(); raise HTTPException(status_code=409, detail={"message": "The updated requirement conflicts with an existing requirement."}) from error
    return value


@router.delete("/requirements/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_requirement(requirement_id: str, db: Session = Depends(get_db)):
    value = db.get(SchedulingRequirement, requirement_id)
    if value is None:
        raise HTTPException(status_code=404, detail={"message": "Scheduling requirement not found."})
    db.delete(value); db.commit()


@router.get("/terms/{term_id}/teacher-availability", response_model=list[TeacherAvailabilityRead])
def list_availability(term_id: str, db: Session = Depends(get_db)):
    if db.get(AcademicTerm, term_id) is None:
        raise HTTPException(status_code=404, detail={"message": "Academic term not found."})
    return [_availability_read(item) for item in db.scalars(select(TeacherAvailability).where(TeacherAvailability.academic_term_id == term_id).order_by(TeacherAvailability.day_of_week, TeacherAvailability.start_minute))]


@router.post("/teacher-availability", response_model=TeacherAvailabilityRead, status_code=status.HTTP_201_CREATED)
def create_availability(payload: TeacherAvailabilityCreate, db: Session = Depends(get_db)):
    term = db.get(AcademicTerm, payload.academic_term_id); teacher = db.get(Teacher, payload.teacher_id)
    if term is None or teacher is None or teacher.institution_id != term.institution_id:
        raise HTTPException(status_code=422, detail={"message": "Teacher and term must belong to the same institution."})
    start, end = clock_minutes(payload.start_time), clock_minutes(payload.end_time)
    if start >= end:
        raise HTTPException(status_code=422, detail={"message": "Availability end time must be later than start time."})
    value = TeacherAvailability(teacher_id=payload.teacher_id, academic_term_id=payload.academic_term_id, day_of_week=payload.day, start_minute=start, end_minute=end, available=payload.available)
    db.add(value); db.commit(); db.refresh(value)
    return _availability_read(value)


@router.post("/generate", response_model=GenerateTimetableResponse)
def generate_timetable(payload: GenerateTimetableRequest, db: Session = Depends(get_db)):
    term = _require_institution_term(db, payload.institution_id, payload.academic_term_id)
    groups = list(db.scalars(select(ClassGroup).options(selectinload(ClassGroup.department), selectinload(ClassGroup.semester), selectinload(ClassGroup.academic_term)).where(ClassGroup.id.in_(payload.class_group_ids))))
    if len(groups) != len(set(payload.class_group_ids)) or any(group.department.institution_id != payload.institution_id or group.academic_term_id != term.id or not group.active for group in groups):
        raise HTTPException(status_code=422, detail={"message": "Every selected class group must belong to the active institution and academic term."})
    all_requirements = list(db.scalars(select(SchedulingRequirement).where(SchedulingRequirement.class_group_id.in_(payload.class_group_ids))))
    active_requirements = [requirement for requirement in all_requirements if requirement.active]
    selected_ids = set(payload.selected_requirement_ids)
    if len(selected_ids) != len(payload.selected_requirement_ids):
        raise HTTPException(status_code=422, detail={"message": "Each scheduling requirement may be selected only once."})
    active_by_id = {requirement.id: requirement for requirement in active_requirements}
    group_by_id = {group.id: group for group in groups}
    if not selected_ids.issubset(active_by_id):
        raise HTTPException(status_code=422, detail={"message": "One or more selected requirements are inactive, missing, or outside the selected academic scope."})
    for requirement in active_requirements:
        if requirement.id in selected_ids:
            _validate_requirement_scope(db, group_by_id[requirement.class_group_id], requirement.subject_id, requirement.teacher_id)
    existing = list(db.scalars(select(TimetableSession).where(TimetableSession.academic_term_id == term.id))) if payload.preserve_existing else []
    scoped_existing = [session for session in existing if session.class_group_id in payload.class_group_ids]
    summaries = []
    for requirement in active_requirements:
        summary = requirement_summary(requirement, scoped_existing)
        summary["selected"] = requirement.id in selected_ids
        summaries.append(summary)
    selected_remaining = []
    for requirement in active_requirements:
        if requirement.id not in selected_ids:
            continue
        summary = next(item for item in summaries if item["requirement_id"] == requirement.id)
        if summary["remaining_count"]:
            selected_remaining.append(SimpleNamespace(id=requirement.id, class_group_id=requirement.class_group_id, subject_id=requirement.subject_id, teacher_id=requirement.teacher_id, session_type=requirement.session_type, weekly_count=summary["remaining_count"], duration_minutes=requirement.duration_minutes, room_type=requirement.room_type))
    response_summaries = summaries
    preserved = [_candidate_read({"id": session.id, "academic_term_id": session.academic_term_id, "class_group_id": session.class_group_id, "day": session.day_of_week, "start_minute": session.start_minute, "end_minute": session.end_minute, "subject_id": session.subject_id, "teacher_id": session.teacher_id, "room_id": session.room_id, "session_type": session.session_type, "locked": session.locked}, False) for session in existing if session.class_group_id in payload.class_group_ids]
    if not selected_remaining:
        return GenerateTimetableResponse(status="OPTIMAL", message="The selected requirements are already satisfied; no new sessions are needed.", requirement_summaries=response_summaries, sessions=[], preserved_sessions=preserved, objective_value=0, solve_time_ms=0)
    availability = list(db.scalars(select(TeacherAvailability).where(TeacherAvailability.academic_term_id == term.id)))
    rooms = list(db.scalars(select(Room).where(Room.institution_id == payload.institution_id, Room.active.is_(True))))
    try:
        result = generate_candidate(db, selected_remaining, existing, availability, rooms, GenerationConfig(working_days=payload.working_days, daily_start=clock_minutes(payload.daily_start_time), daily_end=clock_minutes(payload.daily_end_time), quantum=payload.quantum_minutes, time_limit_seconds=payload.time_limit_seconds, preference=payload.preference))
    except GeneratorUnavailable as error:
        raise HTTPException(status_code=503, detail={"message": str(error)}) from error
    candidates = []
    if result["sessions"]:
        try:
            validation_existing = existing[:]
            for candidate in result["sessions"]:
                candidate["academic_term_id"] = term.id
                conflicts = validate_candidate(candidate, validation_existing)
                if conflicts:
                    raise HTTPException(status_code=422, detail={"message": "Rust validation rejected the generated proposal.", "conflicts": conflicts})
                validation_existing.append(_model_candidate(candidate))
                candidates.append({**candidate, "academic_term_id": term.id})
        except SchedulingEngineUnavailable as error:
            raise HTTPException(status_code=503, detail={"message": str(error)}) from error
    if result["status"] not in {"OPTIMAL", "FEASIBLE"}:
        return GenerateTimetableResponse(status=result["status"], message=result["message"], requirement_summaries=response_summaries, sessions=[], preserved_sessions=preserved, objective_value=result["objective_value"], solve_time_ms=result["solve_time_ms"])
    base = datetime.now(timezone.utc)
    proposal = TimetableProposal(institution_id=payload.institution_id, academic_term_id=term.id, class_group_ids=payload.class_group_ids, candidate_sessions=candidates, base_updated_at=base)
    db.add(proposal); db.commit(); db.refresh(proposal)
    return GenerateTimetableResponse(proposal_id=proposal.id, status=result["status"], message=f"Generated {len(candidates)} remaining session(s) for the selected requirements. Review before approval.", requirement_summaries=response_summaries, sessions=[_candidate_read(candidate) for candidate in candidates], preserved_sessions=preserved, objective_value=result["objective_value"], solve_time_ms=result["solve_time_ms"])


@router.post("/proposals/{proposal_id}/approve", response_model=ApproveProposalResponse)
def approve_proposal(proposal_id: str, db: Session = Depends(get_db)):
    proposal = db.get(TimetableProposal, proposal_id)
    if proposal is None or proposal.status != "pending":
        raise HTTPException(status_code=404, detail={"message": "Pending timetable proposal not found."})
    current = list(db.scalars(select(TimetableSession).where(TimetableSession.academic_term_id == proposal.academic_term_id)))
    if proposal.base_updated_at and any(session.updated_at and session.updated_at > proposal.base_updated_at for session in current):
        raise HTTPException(status_code=409, detail={"message": "The timetable changed after this proposal was generated. Regenerate before approving."})
    added: list[TimetableSession] = []
    try:
        for candidate in proposal.candidate_sessions:
            group = _get_group(db, candidate["class_group_id"])
            _validate_resources(db, group, candidate["subject_id"], candidate["teacher_id"], candidate["room_id"])
            candidate_with_term = {**candidate, "academic_term_id": proposal.academic_term_id}
            if validate_candidate(candidate_with_term, current + added):
                raise HTTPException(status_code=409, detail={"message": "Rust validation rejected the proposal during approval."})
            value = _model_candidate(candidate_with_term)
            db.add(value); added.append(value)
        proposal.status = "approved"
        db.commit()
        for value in added: db.refresh(value)
    except SchedulingEngineUnavailable as error:
        db.rollback(); raise HTTPException(status_code=503, detail={"message": str(error)}) from error
    except HTTPException:
        db.rollback(); raise
    except IntegrityError as error:
        db.rollback(); raise HTTPException(status_code=409, detail={"message": "The proposal conflicts with a timetable change. No sessions were saved."}) from error
    return ApproveProposalResponse(proposal_id=proposal.id, status="approved", saved_sessions=[_read(value) for value in added], message="Proposal approved and saved transactionally.")


@router.delete("/proposals/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_proposal(proposal_id: str, db: Session = Depends(get_db)):
    proposal = db.get(TimetableProposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail={"message": "Timetable proposal not found."})
    proposal.status = "discarded"; db.commit()
