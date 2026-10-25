from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import current_user
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Institution, PdfmePrintTemplate, PrintLayoutTemplate
from app.db.session import get_db
from app.schemas import PdfmeTemplatePayload, PdfmeTemplateRead, PrintLayoutPayload, PrintLayoutTemplateRead

router = APIRouter(prefix="/api/v1/academic", tags=["print-layout"], dependencies=[Depends(current_user)])


def _institution(db: Session, institution_id: str) -> Institution:
    institution = db.get(Institution, institution_id)
    if institution is None:
        raise HTTPException(status_code=404, detail={"message": "Institution not found", "id": institution_id})
    return institution


def _read(template: PrintLayoutTemplate) -> PrintLayoutTemplateRead:
    return PrintLayoutTemplateRead(
        id=template.id,
        institution_id=template.institution_id,
        version=template.version,
        header_elements=template.layout.get("header_elements", []),
        footer_elements=template.layout.get("footer_elements", []),
        logo_data_url=template.logo_data_url,
        updated_at=template.updated_at,
    )


@router.get("/institutions/{institution_id}/print-template", response_model=PrintLayoutTemplateRead | None)
def get_print_template(institution_id: str, db: Session = Depends(get_db)):
    _institution(db, institution_id)
    template = db.scalar(select(PrintLayoutTemplate).where(PrintLayoutTemplate.institution_id == institution_id))
    return _read(template) if template else None


@router.put("/institutions/{institution_id}/print-template", response_model=PrintLayoutTemplateRead)
def save_print_template(institution_id: str, payload: PrintLayoutPayload, db: Session = Depends(get_db)):
    institution = _institution(db, institution_id)
    if not institution.active:
        raise HTTPException(status_code=422, detail={"message": "Inactive institutions cannot save print templates."})
    template = db.scalar(select(PrintLayoutTemplate).where(PrintLayoutTemplate.institution_id == institution_id))
    if template is None:
        template = PrintLayoutTemplate(institution_id=institution_id, version=1)
        db.add(template)
    else:
        template.version += 1
    template.layout = {"header_elements": [item.model_dump() for item in payload.header_elements], "footer_elements": [item.model_dump() for item in payload.footer_elements]}
    template.logo_data_url = payload.logo_data_url
    db.commit()
    db.refresh(template)
    return _read(template)


@router.delete("/institutions/{institution_id}/print-template", status_code=status.HTTP_204_NO_CONTENT)
def reset_print_template(institution_id: str, db: Session = Depends(get_db)):
    _institution(db, institution_id)
    template = db.scalar(select(PrintLayoutTemplate).where(PrintLayoutTemplate.institution_id == institution_id))
    if template:
        db.delete(template)
        db.commit()


def _read_pdfme(template: PdfmePrintTemplate) -> PdfmeTemplateRead:
    return PdfmeTemplateRead(id=template.id, institution_id=template.institution_id, name=template.name, template=template.template, version=template.version, active=template.active, is_default=template.is_default, created_at=template.created_at, updated_at=template.updated_at)


@router.get("/institutions/{institution_id}/print-templates", response_model=list[PdfmeTemplateRead])
def list_pdfme_templates(institution_id: str, db: Session = Depends(get_db)):
    _institution(db, institution_id)
    query = select(PdfmePrintTemplate).where(PdfmePrintTemplate.institution_id == institution_id, PdfmePrintTemplate.active.is_(True)).order_by(PdfmePrintTemplate.is_default.desc(), PdfmePrintTemplate.updated_at.desc())
    return [_read_pdfme(item) for item in db.scalars(query)]


@router.post("/institutions/{institution_id}/print-templates", response_model=PdfmeTemplateRead, status_code=status.HTTP_201_CREATED)
def create_pdfme_template(institution_id: str, payload: PdfmeTemplatePayload, db: Session = Depends(get_db)):
    institution = _institution(db, institution_id)
    if not institution.active:
        raise HTTPException(status_code=422, detail={"message": "Inactive institutions cannot save print templates."})
    if payload.is_default:
        db.query(PdfmePrintTemplate).filter(PdfmePrintTemplate.institution_id == institution_id).update({"is_default": False}, synchronize_session=False)
    item = PdfmePrintTemplate(institution_id=institution_id, name=payload.name, template=payload.template, active=payload.active, is_default=payload.is_default)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _read_pdfme(item)


@router.put("/institutions/{institution_id}/print-templates/{template_id}", response_model=PdfmeTemplateRead)
def update_pdfme_template(institution_id: str, template_id: str, payload: PdfmeTemplatePayload, db: Session = Depends(get_db)):
    institution = _institution(db, institution_id)
    if not institution.active:
        raise HTTPException(status_code=422, detail={"message": "Inactive institutions cannot save print templates."})
    item = db.scalar(select(PdfmePrintTemplate).where(PdfmePrintTemplate.id == template_id, PdfmePrintTemplate.institution_id == institution_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Print template not found")
    if payload.is_default:
        db.query(PdfmePrintTemplate).filter(PdfmePrintTemplate.institution_id == institution_id, PdfmePrintTemplate.id != template_id).update({"is_default": False}, synchronize_session=False)
    item.name = payload.name
    item.template = payload.template
    item.active = payload.active
    item.is_default = payload.is_default
    item.version += 1
    db.commit()
    db.refresh(item)
    return _read_pdfme(item)


@router.delete("/institutions/{institution_id}/print-templates/{template_id}", response_model=PdfmeTemplateRead)
def deactivate_pdfme_template(institution_id: str, template_id: str, db: Session = Depends(get_db)):
    _institution(db, institution_id)
    item = db.scalar(select(PdfmePrintTemplate).where(PdfmePrintTemplate.id == template_id, PdfmePrintTemplate.institution_id == institution_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Print template not found")
    item.active = False
    item.is_default = False
    db.commit()
    db.refresh(item)
    return _read_pdfme(item)
