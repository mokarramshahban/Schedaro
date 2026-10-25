from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.api.auth import current_user
from app.db.models import AcademicTerm, ClassGroup, TimetableReview, TimetableSession, TimetableVersion
from app.db.platform import get_platform_db
from app.db.platform_models import PlatformMembership, PlatformRoleAssignment, PlatformUser
from app.db.session import get_db
from app.schemas_workflow import TimetableVersionCreate, TimetableVersionRead, TimetableVersionUpdate, WorkflowDashboardRead, WorkflowDecision
from app.services.platform import audit
from app.services.rbac import canonical_role

router = APIRouter(prefix="/api/v1/workflow", tags=["timetable-workflow"])

EDIT_ROLES = {"college_administrator", "director", "registrar", "dean", "hod", "academic_coordinator", "class_in_charge"}
REVIEW_ROLES = {"college_administrator", "director", "registrar", "dean", "hod"}
PUBLISH_ROLES = {"college_administrator", "director", "registrar"}


def _group(db: Session, class_group_id: str) -> ClassGroup:
    group = db.scalar(select(ClassGroup).options(selectinload(ClassGroup.department), selectinload(ClassGroup.semester), selectinload(ClassGroup.academic_term)).where(ClassGroup.id == class_group_id))
    if group is None or not group.active: raise HTTPException(status_code=404, detail={"message": "Authorized class group not found."})
    return group


def _assignments(platform_db: Session, user: PlatformUser, institution_id: str) -> list[PlatformRoleAssignment]:
    membership = platform_db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == user.id, PlatformMembership.institution_id == institution_id, PlatformMembership.active.is_(True)))
    if user.role == "platform_owner": return []
    if membership is None: raise HTTPException(status_code=403, detail={"message": "Active institution membership is required."})
    return list(platform_db.scalars(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == user.id, PlatformRoleAssignment.institution_id == institution_id, PlatformRoleAssignment.status == "active")))


def _can_group(platform_db: Session, user: PlatformUser, group: ClassGroup, action: str) -> bool:
    if user.role == "platform_owner": return True
    assignments = _assignments(platform_db, user, group.department.institution_id)
    for assignment in assignments:
        role = canonical_role(assignment.role)
        matches = assignment.scope_type == "institution" or (assignment.scope_type == "department" and assignment.scope_id == group.department_id) or (assignment.scope_type in {"section", "class_group"} and assignment.scope_id == group.id)
        if not matches: continue
        if action == "edit" and role in EDIT_ROLES: return True
        if action == "view" and role in EDIT_ROLES | {"faculty", "student"}: return True
        if action == "review" and role in REVIEW_ROLES: return True
        if action == "publish" and role in PUBLISH_ROLES: return True
    return False


def _read(version: TimetableVersion) -> TimetableVersionRead:
    return TimetableVersionRead.model_validate(version, from_attributes=True)


def _snapshot(db: Session, class_group_id: str) -> list[dict]:
    return [{"id": item.id, "academic_term_id": item.academic_term_id, "class_group_id": item.class_group_id, "day": item.day_of_week, "start_minute": item.start_minute, "end_minute": item.end_minute, "subject_id": item.subject_id, "teacher_id": item.teacher_id, "room_id": item.room_id, "session_type": item.session_type, "notes": item.notes, "locked": item.locked} for item in db.scalars(select(TimetableSession).where(TimetableSession.class_group_id == class_group_id).order_by(TimetableSession.day_of_week, TimetableSession.start_minute)).all()]


def _latest(db: Session, class_group_id: str) -> TimetableVersion | None:
    return db.scalar(select(TimetableVersion).where(TimetableVersion.class_group_id == class_group_id, TimetableVersion.status.not_in(["superseded", "archived"])).order_by(TimetableVersion.version_number.desc()))


@router.get("/dashboard/{institution_id}", response_model=WorkflowDashboardRead)
def dashboard(institution_id: str, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    groups = list(db.scalars(select(ClassGroup).options(selectinload(ClassGroup.department)).where(ClassGroup.active.is_(True))))
    authorized = [group.id for group in groups if _can_group(platform_db, user, group, "view")]
    versions = list(db.scalars(select(TimetableVersion).where(TimetableVersion.class_group_id.in_(authorized)))) if authorized else []
    role = "platform_owner" if user.role == "platform_owner" else (canonical_role(platform_db.scalar(select(PlatformRoleAssignment.role).where(PlatformRoleAssignment.user_id == user.id, PlatformRoleAssignment.status == "active")))) if platform_db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == user.id, PlatformRoleAssignment.status == "active")) else "member"
    return WorkflowDashboardRead(role=role, institution_id=institution_id, draft_count=sum(item.status == "draft" for item in versions), submitted_count=sum(item.status == "submitted" for item in versions), changes_requested_count=sum(item.status == "changes_requested" for item in versions), approved_count=sum(item.status == "approved" for item in versions), published_count=sum(item.status == "published" for item in versions), authorized_class_group_ids=authorized)


@router.get("/class-groups/{class_group_id}/versions", response_model=list[TimetableVersionRead])
def list_versions(class_group_id: str, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    group = _group(db, class_group_id)
    if not _can_group(platform_db, user, group, "view"): raise HTTPException(status_code=403, detail={"message": "Timetable scope access is not permitted."})
    return [_read(item) for item in db.scalars(select(TimetableVersion).where(TimetableVersion.class_group_id == class_group_id).order_by(TimetableVersion.version_number.desc())).all()]


@router.post("/class-groups/{class_group_id}/versions", response_model=TimetableVersionRead, status_code=201)
def create_version(class_group_id: str, payload: TimetableVersionCreate = TimetableVersionCreate(), db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    group = _group(db, class_group_id)
    if not _can_group(platform_db, user, group, "edit"): raise HTTPException(status_code=403, detail={"message": "Timetable creation is not permitted for this section."})
    latest = _latest(db, class_group_id)
    base = db.get(TimetableVersion, payload.base_version_id) if payload.base_version_id else latest
    if base and base.class_group_id != class_group_id: raise HTTPException(status_code=422, detail={"message": "Base version does not match the section."})
    next_number = (latest.version_number if latest else 0) + 1
    version = TimetableVersion(id=str(uuid4()), institution_id=group.department.institution_id, academic_term_id=group.academic_term_id, class_group_id=class_group_id, version_number=next_number, status="draft", session_snapshot=_snapshot(db, class_group_id), creator_user_id=user.id, last_editor_user_id=user.id, base_version_id=base.id if base else None)
    db.add(version); db.commit(); db.refresh(version); audit(platform_db, "timetable.version.created", user.id, group.department.institution_id, {"version_id": version.id, "class_group_id": class_group_id, "version_number": next_number})
    return _read(version)


@router.put("/versions/{version_id}", response_model=TimetableVersionRead)
def update_version(version_id: str, payload: TimetableVersionUpdate, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    version = db.get(TimetableVersion, version_id)
    if version is None: raise HTTPException(status_code=404, detail={"message": "Timetable version not found."})
    group = _group(db, version.class_group_id)
    if version.status not in {"draft", "changes_requested"} or payload.revision != version.revision: raise HTTPException(status_code=409, detail={"message": "This timetable version is stale or no longer editable."})
    if not _can_group(platform_db, user, group, "edit"): raise HTTPException(status_code=403, detail={"message": "Timetable editing is not permitted."})
    version.session_snapshot = payload.session_snapshot; version.last_editor_user_id = user.id; version.revision += 1; db.commit(); db.refresh(version); return _read(version)


@router.post("/versions/{version_id}/submit", response_model=TimetableVersionRead)
def submit_version(version_id: str, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    version = db.get(TimetableVersion, version_id)
    if version is None: raise HTTPException(status_code=404, detail={"message": "Timetable version not found."})
    group = _group(db, version.class_group_id)
    if version.status not in {"draft", "changes_requested"} or not _can_group(platform_db, user, group, "edit"): raise HTTPException(status_code=409, detail={"message": "This version cannot be submitted."})
    version.status = "submitted"; version.submitted_by_user_id = user.id; version.submitted_at = datetime.now(timezone.utc); db.commit(); audit(platform_db, "timetable.version.submitted", user.id, version.institution_id, {"version_id": version.id}); return _read(version)


@router.post("/versions/{version_id}/review", response_model=TimetableVersionRead)
def review_version(version_id: str, payload: WorkflowDecision, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    version = db.get(TimetableVersion, version_id)
    if version is None or version.status != "submitted": raise HTTPException(status_code=409, detail={"message": "Only submitted versions can be reviewed."})
    group = _group(db, version.class_group_id)
    if version.creator_user_id == user.id: raise HTTPException(status_code=403, detail={"message": "The timetable creator cannot approve their own submission."})
    if not _can_group(platform_db, user, group, "review"): raise HTTPException(status_code=403, detail={"message": "Review authority is not permitted for this scope."})
    decision = payload.decision
    version.status = "approved" if decision == "approve" else "rejected" if decision == "reject" else "changes_requested"; db.add(TimetableReview(timetable_version_id=version.id, reviewer_user_id=user.id, decision=decision, reason=payload.reason)); db.commit(); audit(platform_db, "timetable.version.reviewed", user.id, version.institution_id, {"version_id": version.id, "decision": version.status}); return _read(version)


@router.post("/versions/{version_id}/publish", response_model=TimetableVersionRead)
def publish_version(version_id: str, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    version = db.get(TimetableVersion, version_id)
    if version is None or version.status != "approved": raise HTTPException(status_code=409, detail={"message": "Only approved versions can be published."})
    group = _group(db, version.class_group_id)
    if not _can_group(platform_db, user, group, "publish"): raise HTTPException(status_code=403, detail={"message": "Publication authority is not permitted."})
    db.execute(update(TimetableVersion).where(TimetableVersion.class_group_id == version.class_group_id, TimetableVersion.status == "published").values(status="superseded")); version.status = "published"; version.published_by_user_id = user.id; version.published_at = datetime.now(timezone.utc); db.commit(); audit(platform_db, "timetable.version.published", user.id, version.institution_id, {"version_id": version.id}); return _read(version)


@router.get("/class-groups/{class_group_id}/published", response_model=TimetableVersionRead)
def published_version(class_group_id: str, db: Session = Depends(get_db), platform_db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    group = _group(db, class_group_id)
    if not _can_group(platform_db, user, group, "view"): raise HTTPException(status_code=403, detail={"message": "Published timetable access is not permitted."})
    version = db.scalar(select(TimetableVersion).where(TimetableVersion.class_group_id == class_group_id, TimetableVersion.status == "published").order_by(TimetableVersion.version_number.desc()))
    if version is None: raise HTTPException(status_code=404, detail={"message": "No published timetable is available."})
    return _read(version)
