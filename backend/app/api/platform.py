from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_platform_owner
from app.db.platform import check_tenant_database, get_platform_db, tenant_session
from app.db.platform_models import PlatformInstitution, PlatformProvisioningOperation, PlatformUser
from app.db.session import SessionLocal
from app.db.models import Department, Institution, Room, Subject, Teacher, TimetableSession
from app.schemas_platform import PlatformInstitutionCreate, PlatformInstitutionCreateResponse, PlatformInstitutionRead, PlatformOverviewRead, PlatformProvisioningRead, PlatformWorkspaceSummaryRead
from app.services.platform import audit, sync_legacy_institutions, tenant_institution_exists, trusted_institution
from app.services.provisioning import provision_operation, safe_database_name

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


def _sync(db: Session) -> list[PlatformInstitution]:
    with SessionLocal() as source_db:
        return sync_legacy_institutions(db, source_db)


def _read(record: PlatformInstitution, operation: PlatformProvisioningOperation | None = None) -> PlatformInstitutionRead:
    return PlatformInstitutionRead(id=record.id, name=record.name, short_name=record.short_name, institution_type=record.institution_type, contact_email=record.contact_email, contact_phone=record.contact_phone, address=record.address, timezone=record.timezone, working_week=record.working_week, daily_start_time=f"{record.daily_start_minute // 60:02d}:{record.daily_start_minute % 60:02d}", daily_end_time=f"{record.daily_end_minute // 60:02d}:{record.daily_end_minute % 60:02d}", status=record.status, schema_version=record.schema_version, active=record.active, database_ready=record.status == "ready" and check_tenant_database(record.database_name) and tenant_institution_exists(record), provisioning_operation_id=operation.id if operation else None, registered_at=record.created_at)


def _operation_read(operation: PlatformProvisioningOperation) -> PlatformProvisioningRead:
    return PlatformProvisioningRead(id=operation.id, institution_id=operation.institution_id, status=operation.status, error_message=operation.error_message, attempts=operation.attempts, created_at=operation.created_at, updated_at=operation.updated_at)


@router.get("/overview", response_model=PlatformOverviewRead)
def overview(db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    records = _sync(db)
    values = [_read(record) for record in records]
    audit(db, "platform.overview.viewed", user.id)
    return PlatformOverviewRead(institution_count=len(values), active_institution_count=sum(value.active for value in values), ready_institution_count=sum(value.database_ready for value in values), owner_count=db.scalar(select(func.count()).select_from(PlatformUser).where(PlatformUser.role == "platform_owner", PlatformUser.active.is_(True))) or 0, institutions=values)


@router.get("/institutions", response_model=list[PlatformInstitutionRead])
def institutions(db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    records = _sync(db)
    audit(db, "platform.institutions.listed", user.id)
    return [_read(record) for record in records]


@router.post("/institutions", response_model=PlatformInstitutionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_institution(payload: PlatformInstitutionCreate, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    existing_operation = db.scalar(select(PlatformProvisioningOperation).where(PlatformProvisioningOperation.idempotency_key == payload.idempotency_key))
    if existing_operation:
        existing = db.get(PlatformInstitution, existing_operation.institution_id)
        return PlatformInstitutionCreateResponse(institution=_read(existing, existing_operation), provisioning=_operation_read(existing_operation))
    duplicate = db.scalar(select(PlatformInstitution).where(func.lower(PlatformInstitution.name) == payload.name.casefold()))
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "An institution with this name already exists."})
    if payload.short_name and db.scalar(select(PlatformInstitution).where(func.lower(PlatformInstitution.short_name) == payload.short_name.casefold())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "An institution with this code already exists."})
    institution_id = str(uuid4())
    institution = PlatformInstitution(id=institution_id, stable_key=f"provisioned:{institution_id}", name=payload.name, short_name=payload.short_name, institution_type=payload.institution_type, contact_email=payload.contact_email, contact_phone=payload.contact_phone, address=payload.address, timezone=payload.timezone, working_week=payload.working_week, daily_start_minute=int(payload.daily_start_time[:2]) * 60 + int(payload.daily_start_time[3:]), daily_end_minute=int(payload.daily_end_time[:2]) * 60 + int(payload.daily_end_time[3:]), database_name=safe_database_name(institution_id), status="provisioning", schema_version=None, active=False)
    operation = PlatformProvisioningOperation(id=str(uuid4()), institution_id=institution_id, idempotency_key=payload.idempotency_key, status="provisioning", attempts=0, requested_departments=payload.initial_departments)
    db.add_all([institution, operation])
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_operation = db.scalar(select(PlatformProvisioningOperation).where(PlatformProvisioningOperation.idempotency_key == payload.idempotency_key))
        if existing_operation:
            existing = db.get(PlatformInstitution, existing_operation.institution_id)
            return PlatformInstitutionCreateResponse(institution=_read(existing, existing_operation), provisioning=_operation_read(existing_operation))
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "An institution with this identity already exists."})
    try:
        provision_operation(db, operation, institution, payload.initial_departments)
    except Exception:
        db.refresh(operation); db.refresh(institution)
    audit(db, "platform.institution.provisioned", user.id, institution.id, {"status": operation.status, "operation_id": operation.id})
    return PlatformInstitutionCreateResponse(institution=_read(institution, operation), provisioning=_operation_read(operation))


@router.get("/institutions/{institution_id}/provisioning", response_model=PlatformProvisioningRead)
def provisioning_status(institution_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    operation = db.scalar(select(PlatformProvisioningOperation).where(PlatformProvisioningOperation.institution_id == institution_id).order_by(PlatformProvisioningOperation.created_at.desc()))
    if operation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Provisioning operation not found."})
    return _operation_read(operation)


@router.post("/institutions/{institution_id}/retry", response_model=PlatformInstitutionCreateResponse)
def retry_provisioning(institution_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    institution = db.get(PlatformInstitution, institution_id)
    operation = db.scalar(select(PlatformProvisioningOperation).where(PlatformProvisioningOperation.institution_id == institution_id).order_by(PlatformProvisioningOperation.created_at.desc()))
    if institution is None or operation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Institution provisioning record not found."})
    if operation.status == "ready":
        return PlatformInstitutionCreateResponse(institution=_read(institution, operation), provisioning=_operation_read(operation))
    try:
        provision_operation(db, operation, institution, operation.requested_departments)
    except Exception:
        db.refresh(operation); db.refresh(institution)
    audit(db, "platform.institution.provisioning_retried", user.id, institution.id, {"status": operation.status, "operation_id": operation.id})
    return PlatformInstitutionCreateResponse(institution=_read(institution, operation), provisioning=_operation_read(operation))


@router.get("/workspaces/{institution_id}/summary", response_model=PlatformWorkspaceSummaryRead)
def workspace_summary(institution_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    try:
        record = trusted_institution(db, institution_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(error)}) from error
    if not tenant_institution_exists(record):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": "Institution database is not ready."})
    with tenant_session(record.database_name) as tenant_db:
        institution = tenant_db.get(Institution, record.id)
        if institution is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Institution record is missing from its registered database."})
        result = PlatformWorkspaceSummaryRead(institution_id=institution.id, institution_name=institution.name, departments=tenant_db.scalar(select(func.count()).select_from(Department).where(Department.institution_id == institution.id)) or 0, subjects=tenant_db.scalar(select(func.count()).select_from(Subject).where(Subject.institution_id == institution.id)) or 0, teachers=tenant_db.scalar(select(func.count()).select_from(Teacher).where(Teacher.institution_id == institution.id)) or 0, rooms=tenant_db.scalar(select(func.count()).select_from(Room).where(Room.institution_id == institution.id)) or 0, timetable_sessions=tenant_db.scalar(select(func.count()).select_from(TimetableSession).join(TimetableSession.academic_term).where(TimetableSession.academic_term.has(institution_id=institution.id))) or 0)
    audit(db, "platform.workspace.summary_viewed", user.id, record.id)
    return result


@router.get("/workspaces/{institution_id}", response_model=PlatformInstitutionRead)
def open_workspace(institution_id: str, db: Session = Depends(get_platform_db), user: PlatformUser = Depends(require_platform_owner)):
    try:
        record = trusted_institution(db, institution_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(error)}) from error
    if not tenant_institution_exists(record):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": "Institution database is not ready."})
    audit(db, "platform.workspace.opened", user.id, record.id)
    return _read(record)
