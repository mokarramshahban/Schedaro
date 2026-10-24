from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Institution, PrintLayoutTemplate
from app.db.session import get_db
from app.schemas import PrintLayoutPayload, PrintLayoutTemplateRead

router = APIRouter(prefix="/api/v1/academic", tags=["print-layout"])


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
