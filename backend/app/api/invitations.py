from datetime import datetime, timedelta, timezone
from secrets import token_hex, token_urlsafe
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.api.auth import current_user, require_platform_owner
from app.core.config import get_settings
from app.db.platform import get_platform_db
from app.db.platform_models import PlatformEmailDelivery, PlatformInstitution, PlatformInvitation, PlatformManualPasswordReset, PlatformMembership, PlatformPasswordRecovery, PlatformRecoveryAttempt, PlatformRoleAssignment, PlatformSession, PlatformUser
from app.schemas_platform import InvitationAccept, InvitationApprovalRequest, InvitationCreate, InvitationInspectRead, InvitationRead, InvitationTokenRequest, ManualActivationRequest, ManualInvitationCreate, ManualInvitationCreated, ManualPasswordResetCreate, ManualPasswordResetCreated, PasswordForgotRequest, PasswordResetRequest, PlatformUserRead, PortalPublicRead
from app.services.email import capture_email
from app.services.platform import audit, create_session, hash_password, token_hash, verify_password
from app.services.rbac import actor_can, canonical_role, validate_scope

router = APIRouter(tags=["invitations"])
settings = get_settings()


def _institution(db: Session, slug: str) -> PlatformInstitution:
    institution = db.scalar(select(PlatformInstitution).where(PlatformInstitution.portal_slug == slug))
    if institution is None:
        raise HTTPException(status_code=404, detail={"message": "Institution portal not found."})
    return institution


def _read_invitation(db: Session, invitation: PlatformInvitation) -> InvitationRead:
    institution = db.get(PlatformInstitution, invitation.institution_id)
    return InvitationRead(id=invitation.id, recipient_email=invitation.recipient_email, institution_id=invitation.institution_id, institution_name=institution.name if institution else "Institution", portal_slug=institution.portal_slug if institution else None, role=invitation.role, scope_type=invitation.scope_type, scope_id=invitation.scope_id, method=invitation.method, approval_status=invitation.approval_status, status=invitation.status, delivery_status=invitation.delivery_status, expires_at=invitation.expires_at, created_at=invitation.created_at)


def _valid_invitation(db: Session, token: str) -> PlatformInvitation:
    invitation = db.scalar(select(PlatformInvitation).where(PlatformInvitation.token_hash == token_hash(token)))
    if invitation is None or invitation.status != "pending" or invitation.expires_at <= datetime.now(timezone.utc):
        if invitation and invitation.status == "pending" and invitation.expires_at <= datetime.now(timezone.utc):
            invitation.status = "expired"; db.commit()
        raise HTTPException(status_code=400, detail={"message": "This invitation is invalid or expired."})
    return invitation


@router.get("/api/v1/portals/{slug}", response_model=PortalPublicRead)
def portal(slug: str, db: Session = Depends(get_platform_db)):
    institution = _institution(db, slug.lower())
    available = institution.active and institution.status == "ready"
    return PortalPublicRead(name=institution.name, portal_slug=institution.portal_slug or slug, status=institution.status, available=available)


@router.post("/api/v1/platform/institutions/{institution_id}/invitations", response_model=InvitationRead, status_code=201)
def create_invitation(institution_id: str, payload: InvitationCreate, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    institution = db.get(PlatformInstitution, institution_id)
    if institution is None or not institution.active or institution.status != "ready":
        raise HTTPException(status_code=409, detail={"message": "Institution is not ready for invitations."})
    role = canonical_role(payload.role)
    if role == "platform_owner": raise HTTPException(status_code=403, detail={"message": "Platform Owner invitations use a protected workflow."})
    if not actor_can(db, user, institution_id, "users.invite", role, payload.scope_type, payload.scope_id):
        raise HTTPException(status_code=403, detail={"message": "You are not authorized to invite that role in this scope."})
    try: validate_scope(db, institution_id, payload.scope_type, payload.scope_id)
    except ValueError as error: raise HTTPException(status_code=422, detail={"message": str(error)}) from error
    existing = db.scalar(select(PlatformInvitation).where(PlatformInvitation.institution_id == institution_id, PlatformInvitation.recipient_email == payload.email, PlatformInvitation.role == role, PlatformInvitation.status == "pending"))
    if existing and existing.expires_at > datetime.now(timezone.utc):
        return _read_invitation(db, existing)
    raw_token = token_urlsafe(40)
    invitation = PlatformInvitation(id=str(uuid4()), recipient_email=payload.email, institution_id=institution_id, role=role, scope_type=payload.scope_type, scope_id=payload.scope_id, inviter_user_id=user.id, token_hash=token_hash(raw_token), status="pending", delivery_status="pending", expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.invitation_expiry_hours))
    db.add(invitation); db.commit()
    link = f"{settings.public_app_url.rstrip('/')}/c/{institution.portal_slug}/invite/accept#token={raw_token}"
    capture_email(db, payload.email, f"Your {institution.name} Schedaro invitation", f"You have been invited as College Administrator for {institution.name}. Open this secure link to activate your account: {link}")
    invitation.delivery_status = "captured"; db.commit()
    audit(db, "platform.invitation.created", user.id, institution_id, {"invitation_id": invitation.id, "role": role, "scope_type": payload.scope_type, "scope_id": payload.scope_id})
    return _read_invitation(db, invitation)


@router.post("/api/v1/platform/institutions/{institution_id}/manual-invitations", response_model=ManualInvitationCreated, status_code=201)
def create_manual_invitation(institution_id: str, payload: ManualInvitationCreate, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    institution = db.get(PlatformInstitution, institution_id)
    if institution is None or not institution.active or institution.status != "ready":
        raise HTTPException(status_code=409, detail={"message": "Institution is not ready for invitations."})
    raw_key = token_urlsafe(32)
    invitation = PlatformInvitation(id=str(uuid4()), recipient_email=payload.email, institution_id=institution_id, role="institution_admin", inviter_user_id=user.id, token_hash=token_hash(raw_key), method="manual", approval_status="not_required", status="pending", delivery_status="not_applicable", expires_at=datetime.now(timezone.utc) + timedelta(hours=payload.expiration_hours))
    db.add(invitation); db.commit(); audit(db, "platform.manual_invitation.created", user.id, institution_id, {"invitation_id": invitation.id})
    display_key = "-".join(raw_key[index:index + 8] for index in range(0, len(raw_key), 8))
    return ManualInvitationCreated(invitation=_read_invitation(db, invitation), activation_url=f"{settings.public_app_url.rstrip('/')}/c/{institution.portal_slug}/activate/{invitation.id}", activation_key=display_key, expires_at=invitation.expires_at)


@router.post("/api/v1/platform/users/{user_id}/manual-password-reset", response_model=ManualPasswordResetCreated, status_code=201)
def issue_manual_password_reset(user_id: str, payload: ManualPasswordResetCreate, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    target = db.get(PlatformUser, user_id)
    if target is None or not target.active:
        raise HTTPException(status_code=404, detail={"message": "Target account was not found."})
    if target.role == "platform_owner":
        raise HTTPException(status_code=403, detail={"message": "Platform Owner credentials use the protected owner recovery workflow."})
    institution = None
    if payload.institution_id:
        institution = db.get(PlatformInstitution, payload.institution_id)
        membership = db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == target.id, PlatformMembership.institution_id == payload.institution_id, PlatformMembership.active.is_(True)))
        if institution is None or membership is None:
            raise HTTPException(status_code=404, detail={"message": "The target account has no active membership in that institution."})
    else:
        institution = db.scalar(select(PlatformInstitution).join(PlatformMembership, PlatformMembership.institution_id == PlatformInstitution.id).where(PlatformMembership.user_id == target.id, PlatformMembership.active.is_(True), PlatformInstitution.active.is_(True)).order_by(PlatformInstitution.name))
    now = datetime.now(timezone.utc)
    db.execute(update(PlatformManualPasswordReset).where(PlatformManualPasswordReset.user_id == target.id, PlatformManualPasswordReset.consumed_at.is_(None), PlatformManualPasswordReset.revoked_at.is_(None)).values(revoked_at=now))
    raw_key = token_hex(32)
    record = PlatformManualPasswordReset(id=str(uuid4()), user_id=target.id, key_hash=token_hash(raw_key), created_by=user.id, expires_at=now + timedelta(minutes=payload.expiration_minutes))
    db.add(record); db.commit()
    audit(db, "platform.manual_password_reset.issued", user.id, institution.id if institution else None, {"reset_id": record.id, "target_user_id": target.id})
    portal = institution.portal_slug if institution and institution.portal_slug else None
    reset_url = f"{settings.public_app_url.rstrip('/')}{f'/c/{portal}' if portal else ''}/reset-password"
    return ManualPasswordResetCreated(reset_id=record.id, user_id=target.id, email=target.email, reset_url=reset_url, reset_key=raw_key, expires_at=record.expires_at)


@router.post("/api/v1/platform/manual-password-resets/{reset_id}/revoke", status_code=204)
def revoke_manual_password_reset(reset_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    record = db.get(PlatformManualPasswordReset, reset_id)
    if record is None or record.revoked_at is not None or record.consumed_at is not None:
        raise HTTPException(status_code=404, detail={"message": "Active manual reset key was not found."})
    record.revoked_at = datetime.now(timezone.utc); db.commit(); audit(db, "platform.manual_password_reset.revoked", user.id, None, {"reset_id": record.id, "target_user_id": record.user_id})


@router.get("/api/v1/platform/institutions/{institution_id}/invitations", response_model=list[InvitationRead])
def list_invitations(institution_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    if not actor_can(db, user, institution_id, "users.view"):
        raise HTTPException(status_code=403, detail={"message": "Invitation access is not permitted."})
    return [_read_invitation(db, item) for item in db.scalars(select(PlatformInvitation).where(PlatformInvitation.institution_id == institution_id).order_by(PlatformInvitation.created_at.desc())).all()]


@router.post("/api/v1/platform/invitations/{invitation_id}/revoke", response_model=InvitationRead)
def revoke_invitation(invitation_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(current_user)):
    invitation = db.get(PlatformInvitation, invitation_id)
    if invitation is None: raise HTTPException(status_code=404, detail={"message": "Invitation not found."})
    if not actor_can(db, user, invitation.institution_id, "roles.revoke", invitation.role, invitation.scope_type, invitation.scope_id): raise HTTPException(status_code=403, detail={"message": "Invitation revocation is not permitted."})
    invitation.status = "revoked"; invitation.revoked_at = datetime.now(timezone.utc); db.commit(); audit(db, "platform.invitation.revoked", user.id, invitation.institution_id, {"invitation_id": invitation.id})
    return _read_invitation(db, invitation)


@router.post("/api/v1/auth/manual-invitations/activate", response_model=PlatformUserRead)
def activate_manual_invitation(payload: ManualActivationRequest, db: Session = Depends(get_platform_db)):
    invitation = db.get(PlatformInvitation, payload.invitation_id)
    normalized_key = payload.activation_key.replace("-", "").strip()
    if invitation is None or invitation.method != "manual" or invitation.status != "pending" or invitation.expires_at <= datetime.now(timezone.utc) or invitation.token_hash != token_hash(normalized_key):
        raise HTTPException(status_code=400, detail={"message": "This activation key is invalid, expired or already used."})
    if payload.email != invitation.recipient_email:
        raise HTTPException(status_code=403, detail={"message": "The activation email does not match this invitation."})
    if db.scalar(select(PlatformUser).where(PlatformUser.email == payload.email)):
        raise HTTPException(status_code=409, detail={"message": "An account already exists. Sign in and request authenticated membership activation."})
    user = PlatformUser(id=str(uuid4()), email=payload.email, password_hash=hash_password(payload.password), role="college_admin", active=True)
    db.add(user); db.flush(); db.add(PlatformMembership(id=str(uuid4()), user_id=user.id, institution_id=invitation.institution_id, role=invitation.role, active=False)); invitation.status = "accepted"; invitation.approval_status = "pending"; invitation.claimed_user_id = user.id; invitation.accepted_at = datetime.now(timezone.utc); db.commit(); audit(db, "platform.manual_invitation.claimed", user.id, invitation.institution_id, {"invitation_id": invitation.id})
    return PlatformUserRead(id=user.id, email=user.email, role=user.role, active=user.active)


@router.post("/api/v1/platform/invitations/{invitation_id}/approval", response_model=InvitationRead)
def approve_manual_invitation(invitation_id: str, payload: InvitationApprovalRequest, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    invitation = db.get(PlatformInvitation, invitation_id)
    if invitation is None or invitation.method != "manual" or invitation.approval_status != "pending":
        raise HTTPException(status_code=409, detail={"message": "Invitation is not awaiting owner approval."})
    membership = db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == invitation.claimed_user_id, PlatformMembership.institution_id == invitation.institution_id))
    if membership is None: raise HTTPException(status_code=409, detail={"message": "Pending membership is missing."})
    invitation.approval_status = "approved" if payload.decision == "approve" else "rejected"; membership.active = payload.decision == "approve"; db.commit(); audit(db, f"platform.manual_invitation.{payload.decision}d", user.id, invitation.institution_id, {"invitation_id": invitation.id, "claimed_user_id": invitation.claimed_user_id})
    return _read_invitation(db, invitation)


@router.post("/api/v1/auth/invitations/inspect", response_model=InvitationInspectRead)
def inspect_invitation(payload: InvitationTokenRequest, db: Session = Depends(get_platform_db)):
    invitation = _valid_invitation(db, payload.token); institution = db.get(PlatformInstitution, invitation.institution_id)
    return InvitationInspectRead(invitation_id=invitation.id, recipient_email=invitation.recipient_email, institution_name=institution.name, portal_slug=institution.portal_slug, role=invitation.role, expires_at=invitation.expires_at)


@router.post("/api/v1/auth/invitations/accept", response_model=PlatformUserRead)
def accept_invitation(payload: InvitationAccept, db: Session = Depends(get_platform_db)):
    invitation = _valid_invitation(db, payload.token)
    if payload.email != invitation.recipient_email: raise HTTPException(status_code=403, detail={"message": "Invitation recipient does not match."})
    existing = db.scalar(select(PlatformUser).where(PlatformUser.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail={"message": "An account already exists. Sign in first, then accept this invitation."})
    user = PlatformUser(id=str(uuid4()), email=payload.email, password_hash=hash_password(payload.password), role="college_admin", active=True)
    db.add(user); db.flush(); db.add(PlatformMembership(id=str(uuid4()), user_id=user.id, institution_id=invitation.institution_id, role=invitation.role, active=True)); db.add(PlatformRoleAssignment(id=str(uuid4()), user_id=user.id, institution_id=invitation.institution_id, role=canonical_role(invitation.role), scope_type=invitation.scope_type, scope_id=invitation.scope_id, granted_by=invitation.inviter_user_id, status="active")); invitation.status = "accepted"; invitation.accepted_at = datetime.now(timezone.utc); db.commit()
    audit(db, "platform.invitation.accepted", user.id, invitation.institution_id, {"invitation_id": invitation.id}); return PlatformUserRead(id=user.id, email=user.email, role=user.role, active=user.active)


def _record_failed_recovery_attempt(db: Session, digest: str, now: datetime) -> None:
    attempt = db.scalar(select(PlatformRecoveryAttempt).where(PlatformRecoveryAttempt.token_hash == digest).with_for_update())
    if attempt is None:
        db.add(PlatformRecoveryAttempt(id=str(uuid4()), token_hash=digest, attempts=1, window_started_at=now))
    elif attempt.window_started_at + timedelta(minutes=10) <= now:
        attempt.attempts = 1; attempt.window_started_at = now; attempt.locked_until = None
    else:
        attempt.attempts += 1
        if attempt.attempts >= 5:
            attempt.locked_until = now + timedelta(minutes=10)
    db.commit()


def _check_recovery_rate_limit(db: Session, digest: str, now: datetime) -> None:
    attempt = db.scalar(select(PlatformRecoveryAttempt).where(PlatformRecoveryAttempt.token_hash == digest))
    if attempt and attempt.locked_until and attempt.locked_until > now:
        raise HTTPException(status_code=429, detail={"message": "Too many recovery attempts. Try again later."})


@router.post("/api/v1/auth/password/forgot", status_code=202)
def forgot_password(payload: PasswordForgotRequest, db: Session = Depends(get_platform_db)):
    email = payload.email.strip().lower(); user = db.scalar(select(PlatformUser).where(PlatformUser.email == email))
    if user and user.active:
        now = datetime.now(timezone.utc)
        db.execute(update(PlatformPasswordRecovery).where(PlatformPasswordRecovery.user_id == user.id, PlatformPasswordRecovery.consumed_at.is_(None)).values(consumed_at=now))
        raw = token_urlsafe(40)
        db.add(PlatformPasswordRecovery(id=str(uuid4()), user_id=user.id, token_hash=token_hash(raw), expires_at=now + timedelta(hours=1)))
        db.commit()
        capture_email(db, email, "Reset your Schedaro password", f"Use this secure link to reset your password: {settings.public_app_url.rstrip('/')}/login#reset-token={raw}")
    return {"message": "If an account is eligible, recovery instructions have been sent."}


@router.post("/api/v1/auth/password/reset", response_model=PlatformUserRead)
def reset_password(payload: PasswordResetRequest, db: Session = Depends(get_platform_db)):
    digest = token_hash(payload.token.strip())
    now = datetime.now(timezone.utc)
    _check_recovery_rate_limit(db, digest, now)
    manual = db.scalar(select(PlatformManualPasswordReset).where(PlatformManualPasswordReset.key_hash == digest).with_for_update())
    email_recovery = None if manual else db.scalar(select(PlatformPasswordRecovery).where(PlatformPasswordRecovery.token_hash == digest).with_for_update())
    if manual is None and email_recovery is None:
        _record_failed_recovery_attempt(db, digest, now)
        raise HTTPException(status_code=400, detail={"message": "This recovery key is invalid or expired."})
    record = manual or email_recovery
    if record.consumed_at is not None or record.expires_at <= now or (manual is not None and manual.revoked_at is not None):
        _record_failed_recovery_attempt(db, digest, now)
        raise HTTPException(status_code=400, detail={"message": "This recovery key is invalid or expired."})
    user = db.get(PlatformUser, record.user_id)
    if user is None or not user.active:
        _record_failed_recovery_attempt(db, digest, now)
        raise HTTPException(status_code=400, detail={"message": "This recovery key is invalid or expired."})
    user.password_hash = hash_password(payload.password)
    record.consumed_at = now
    if manual:
        db.execute(update(PlatformManualPasswordReset).where(PlatformManualPasswordReset.user_id == user.id, PlatformManualPasswordReset.id != manual.id, PlatformManualPasswordReset.consumed_at.is_(None), PlatformManualPasswordReset.revoked_at.is_(None)).values(revoked_at=now))
    db.execute(delete(PlatformSession).where(PlatformSession.user_id == user.id))
    db.commit()
    audit(db, "platform.password_reset.completed", user.id, None, {"method": "manual" if manual else "email"})
    return PlatformUserRead(id=user.id, email=user.email, role=user.role, active=user.active)
