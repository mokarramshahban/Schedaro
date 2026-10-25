import pytest
from pydantic import ValidationError
from secrets import token_urlsafe

from app.schemas_platform import ManualInvitationCreate
from app.services.platform import token_hash


def test_manual_invitation_requires_explicit_recipient_and_bounded_expiry():
    invitation = ManualInvitationCreate(email="admin@example.test", expiration_hours=168)
    assert invitation.email == "admin@example.test"
    assert invitation.expiration_hours == 168


@pytest.mark.parametrize("hours", [0, 721])
def test_manual_invitation_expiry_is_bounded(hours):
    with pytest.raises(ValidationError):
        ManualInvitationCreate(email="admin@example.test", expiration_hours=hours)


def test_manual_activation_key_is_not_persisted_as_plaintext():
    raw = token_urlsafe(32)
    assert len(raw) >= 43
    assert raw not in token_hash(raw)
