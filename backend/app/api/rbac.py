from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.auth import current_session, current_user, require_platform_owner
from app.db.platform import get_platform_db
from app.db.platform_models import PlatformAuditEvent, PlatformInstitution, PlatformMembership, PlatformRoleAssignment, PlatformSession, PlatformUser
from app.schemas_platform import PermissionDefinition, RoleAssignmentCreate, RoleAssignmentRead, RoleContextRead, RoleContextSelect
from app.services.platform import audit
from app.services.rbac import DELEGABLE, PERMISSIONS, ROLE_PERMISSIONS, ROLES, actor_can, assignment_permissions, canonical_role, active_assignments, scope_label, validate_scope

router = APIRouter(tags=["authorization"])


def _read_assignment(db: Session, item: PlatformRoleAssignment) -> RoleAssignmentRead:
    target = db.get(PlatformUser, item.user_id)
    try:
        label = scope_label(db, item.institution_id, item.scope_type, item.scope_id)
    except Exception:
        label = None
    return RoleAssignmentRead(id=item.id, user_id=item.user_id, user_email=target.email if target else None, institution_id=item.institution_id, role=canonical_role(item.role), scope_type=item.scope_type, scope_id=item.scope_id, scope_label=label, designation=item.designation, status=item.status, granted_by=item.granted_by, created_at=item.created_at)


def _assignment_for_user(db: Session, user_id: str, assignment_id: str) -> PlatformRoleAssignment:
    assignment = db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.id == assignment_id, PlatformRoleAssignment.user_id == user_id, PlatformRoleAssignment.status == "active"))
    if assignment is None: raise HTTPException(status_code=403, detail={"message": "That role context is unavailable."})
    membership = db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == user_id, PlatformMembership.institution_id == assignment.institution_id, PlatformMembership.active.is_(True)))
    if membership is None: raise HTTPException(status_code=403, detail={"message": "The institution membership is inactive."})
    return assignment


@router.get("/api/v1/auth/me/permissions", response_model=list[PermissionDefinition])
def permissions():
    return [PermissionDefinition(key=key, description=value) for key, value in PERMISSIONS.items()]


@router.get("/api/v1/auth/me/role-assignments", response_model=list[RoleAssignmentRead])
def my_assignments(db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    return [_read_assignment(db, item) for item in active_assignments(db, user.id)]


@router.get("/api/v1/auth/me/role-context", response_model=RoleContextRead)
def role_context(db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user), session: PlatformSession = Depends(current_session)):
    assignment = db.get(PlatformRoleAssignment, session.active_assignment_id) if session.active_assignment_id else None
    if assignment is None or assignment.user_id != user.id or assignment.status != "active": return RoleContextRead()
    return RoleContextRead(assignment_id=assignment.id, institution_id=assignment.institution_id, role=canonical_role(assignment.role), scope_type=assignment.scope_type, scope_id=assignment.scope_id, permissions=sorted(assignment_permissions(assignment)))


@router.post("/api/v1/auth/me/role-context", response_model=RoleContextRead)
def select_role_context(payload: RoleContextSelect, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user), session: PlatformSession = Depends(current_session)):
    assignment = _assignment_for_user(db, user.id, payload.assignment_id)
    session.active_assignment_id = assignment.id; db.commit(); audit(db, "platform.role_context.changed", user.id, assignment.institution_id, {"assignment_id": assignment.id, "role": canonical_role(assignment.role)})
    return RoleContextRead(assignment_id=assignment.id, institution_id=assignment.institution_id, role=canonical_role(assignment.role), scope_type=assignment.scope_type, scope_id=assignment.scope_id, permissions=sorted(assignment_permissions(assignment)))


@router.get("/api/v1/platform/institutions/{institution_id}/users", response_model=list[RoleAssignmentRead])
def institution_assignments(institution_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    if not actor_can(db, user, institution_id, "users.view") and user.role != "platform_owner": raise HTTPException(status_code=403, detail={"message": "User directory access is not permitted."})
    return [_read_assignment(db, item) for item in db.scalars(select(PlatformRoleAssignment).where(PlatformRoleAssignment.institution_id == institution_id).order_by(PlatformRoleAssignment.created_at)).all()]


@router.post("/api/v1/platform/institutions/{institution_id}/role-assignments", response_model=RoleAssignmentRead, status_code=201)
def assign_role(institution_id: str, payload: RoleAssignmentCreate, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    if payload.institution_id != institution_id: raise HTTPException(status_code=400, detail={"message": "Institution context does not match the assignment."})
    role = canonical_role(payload.role)
    if role == "platform_owner": raise HTTPException(status_code=403, detail={"message": "Platform Owner grants use a protected platform workflow."})
    if role not in ROLES: raise HTTPException(status_code=422, detail={"message": "Unsupported role."})
    if not actor_can(db, user, institution_id, "roles.assign", role, payload.scope_type, payload.scope_id): raise HTTPException(status_code=403, detail={"message": "You are not authorized to grant that role in this scope."})
    target = db.get(PlatformUser, payload.user_id)
    institution = db.get(PlatformInstitution, institution_id)
    if target is None or institution is None or not institution.active or institution.status != "ready": raise HTTPException(status_code=404, detail={"message": "Target user or institution was not found."})
    try: validate_scope(db, institution_id, payload.scope_type, payload.scope_id)
    except ValueError as error: raise HTTPException(status_code=422, detail={"message": str(error)}) from error
    existing = db.scalar(select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == target.id, PlatformRoleAssignment.institution_id == institution_id, PlatformRoleAssignment.role == role, PlatformRoleAssignment.scope_type == payload.scope_type, PlatformRoleAssignment.scope_id == payload.scope_id, PlatformRoleAssignment.status == "active"))
    if existing: return _read_assignment(db, existing)
    membership = db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == target.id, PlatformMembership.institution_id == institution_id))
    if membership is None: db.add(PlatformMembership(id=str(uuid4()), user_id=target.id, institution_id=institution_id, role=role, active=True))
    elif not membership.active: raise HTTPException(status_code=409, detail={"message": "The institution membership is inactive."})
    assignment = PlatformRoleAssignment(id=str(uuid4()), user_id=target.id, institution_id=institution_id, role=role, scope_type=payload.scope_type, scope_id=payload.scope_id, designation=payload.designation, granted_by=user.id, status="active")
    db.add(assignment); db.commit(); audit(db, "platform.role_assignment.created", user.id, institution_id, {"assignment_id": assignment.id, "target_user_id": target.id, "role": role, "scope_type": payload.scope_type, "scope_id": payload.scope_id})
    return _read_assignment(db, assignment)


@router.post("/api/v1/platform/role-assignments/{assignment_id}/revoke", response_model=RoleAssignmentRead)
def revoke_role(assignment_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    assignment = db.get(PlatformRoleAssignment, assignment_id)
    if assignment is None or assignment.status != "active": raise HTTPException(status_code=404, detail={"message": "Active role assignment not found."})
    if not actor_can(db, user, assignment.institution_id, "roles.revoke", canonical_role(assignment.role), assignment.scope_type, assignment.scope_id): raise HTTPException(status_code=403, detail={"message": "You are not authorized to revoke that assignment."})
    assignment.status = "revoked"; assignment.revoked_at = datetime.now(timezone.utc); db.commit(); audit(db, "platform.role_assignment.revoked", user.id, assignment.institution_id, {"assignment_id": assignment.id, "target_user_id": assignment.user_id})
    db.execute(update(PlatformSession).where(PlatformSession.user_id == assignment.user_id, PlatformSession.active_assignment_id == assignment.id).values(active_assignment_id=None)); db.commit()
    return _read_assignment(db, assignment)
