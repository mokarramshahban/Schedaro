from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import require_platform_owner
from app.db.platform import check_tenant_database, get_platform_db, tenant_session
from app.db.platform_models import PlatformInstitution, PlatformUser
from app.db.session import SessionLocal
from app.db.models import Department, Institution, Room, Subject, Teacher, TimetableSession
from app.schemas_platform import PlatformInstitutionRead, PlatformOverviewRead, PlatformWorkspaceSummaryRead
from app.services.platform import audit, sync_legacy_institutions, tenant_institution_exists, trusted_institution

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


def _sync(db: Session) -> list[PlatformInstitution]:
    with SessionLocal() as source_db:
        return sync_legacy_institutions(db, source_db)


def _read(record: PlatformInstitution) -> PlatformInstitutionRead:
    return PlatformInstitutionRead(id=record.id, name=record.name, short_name=record.short_name, status=record.status, schema_version=record.schema_version, active=record.active, database_ready=check_tenant_database(record.database_name) and tenant_institution_exists(record))


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
