from fastapi.testclient import TestClient

from app.api.auth import current_user
from app.main import app


def test_platform_and_academic_routes_require_authentication():
    previous = app.dependency_overrides.pop(current_user, None)
    try:
        client = TestClient(app)
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.get("/api/v1/platform/overview").status_code == 401
        assert client.get("/api/v1/academic/institutions").status_code == 401
    finally:
        if previous is not None:
            app.dependency_overrides[current_user] = previous


def test_password_hash_is_not_reversible_plaintext():
    from app.services.platform import hash_password, verify_password

    encoded = hash_password("stage7a-test-password-123")
    assert "stage7a-test-password-123" not in encoded
    assert encoded.startswith("scrypt$")
    assert verify_password("stage7a-test-password-123", encoded)
    assert not verify_password("wrong-password-123", encoded)
