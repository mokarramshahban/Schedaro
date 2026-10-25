from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.platform import get_platform_db, tenant_session
from app.db.models import Institution
from app.db.platform_models import PlatformInstitution, PlatformMembership, PlatformRoleAssignment, PlatformSession, PlatformUser
from app.schemas_platform import PlatformMembershipRead
from app.schemas_platform import PlatformLoginRequest, PlatformUserRead
from app.services.platform import create_session, has_institution_access, revoke_session, token_hash, user_for_session, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
settings = get_settings()


def current_session(request: Request, db: Session = Depends(get_platform_db)) -> PlatformSession:
    raw = request.cookies.get(settings.auth_cookie_name)
    record = db.scalar(select(PlatformSession).where(PlatformSession.token_hash == token_hash(raw or '')))
    if record is None or record.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Authentication is required."})
    return record


def current_user(request: Request, db: Session = Depends(get_platform_db)) -> PlatformUser:
    user = user_for_session(db, request.cookies.get(settings.auth_cookie_name))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Authentication is required."})
    return user


def require_platform_owner(user: PlatformUser = Depends(current_user)) -> PlatformUser:
    if user.role != "platform_owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Platform Owner access is required."})
    return user


def require_academic_access(request: Request, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)) -> PlatformUser:
    institution_id = request.path_params.get("institution_id") or request.query_params.get("institution_id")
    if user.role != "platform_owner" and (not institution_id or not has_institution_access(db, user, institution_id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Institution membership is required."})
    if user.role != "platform_owner":
        raw = request.cookies.get(settings.auth_cookie_name)
        session = db.scalar(select(PlatformSession).where(PlatformSession.token_hash == token_hash(raw or ""), PlatformSession.expires_at > datetime.now(timezone.utc)))
        if session and session.active_assignment_id:
            assignment = db.get(PlatformRoleAssignment, session.active_assignment_id)
            if assignment is None or assignment.user_id != user.id or assignment.institution_id != institution_id or assignment.status != "active":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "The active authorization context is invalid."})
    return user


def user_read(user: PlatformUser) -> PlatformUserRead:
    return PlatformUserRead(id=user.id, email=user.email, role=user.role, active=user.active)


@router.post("/login", response_model=PlatformUserRead)
def login(payload: PlatformLoginRequest, response: Response, db: Session = Depends(get_platform_db)):
    user = db.scalar(select(PlatformUser).where(PlatformUser.email == payload.email.strip().lower()))
    if user is None or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Invalid credentials."})
    raw = create_session(db, user)
    response.set_cookie(settings.auth_cookie_name, raw, httponly=True, secure=settings.auth_cookie_secure, samesite="lax", max_age=settings.auth_session_hours * 3600, path="/")
    return user_read(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_platform_db)):
    revoke_session(db, request.cookies.get(settings.auth_cookie_name))
    response.delete_cookie(settings.auth_cookie_name, path="/")


@router.get("/me", response_model=PlatformUserRead)
def me(user: PlatformUser = Depends(current_user)):
    return user_read(user)


@router.get("/me/institutions", response_model=list[PlatformMembershipRead])
def my_institutions(db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    if user.role == "platform_owner":
        records = list(db.scalars(select(PlatformInstitution).where(PlatformInstitution.active.is_(True)).order_by(PlatformInstitution.name)))
        rows = [(record, "platform_owner", record.active) for record in records]
    else:
        rows = [(institution, membership.role, membership.active) for membership, institution in db.execute(select(PlatformMembership, PlatformInstitution).join(PlatformInstitution, PlatformInstitution.id == PlatformMembership.institution_id).where(PlatformMembership.user_id == user.id, PlatformMembership.active.is_(True), PlatformInstitution.active.is_(True)).order_by(PlatformInstitution.name)).all()]
    result = []
    for institution, role, active in rows:
        working_week = "monday-saturday"
        try:
            with tenant_session(institution.database_name) as tenant_db:
                tenant_record = tenant_db.get(Institution, institution.id)
                working_week = tenant_record.working_week if tenant_record else working_week
        except Exception:
            pass
        result.append(PlatformMembershipRead(institution_id=institution.id, institution_name=institution.name, portal_slug=institution.portal_slug, working_week=working_week, role=role, active=active))
    return result
