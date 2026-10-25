from uuid import uuid4

from app.core.config import get_settings
from app.db.platform_models import PlatformEmailDelivery
from sqlalchemy.orm import Session

settings = get_settings()


def capture_email(db: Session, recipient: str, subject: str, body: str) -> str:
    message = PlatformEmailDelivery(id=str(uuid4()), recipient_email=recipient, subject=subject, body=body, delivery_status="captured")
    db.add(message)
    db.commit()
    return message.id
