from types import SimpleNamespace

import pytest

from app.api.auth import current_user
from app.main import app


@pytest.fixture(autouse=True, scope="session")
def legacy_api_test_auth():
    """Keep pre-Stage-7 academic regression tests focused on domain behavior."""
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id="test-owner", email="test-owner@local", role="platform_owner", active=True)
    yield
    app.dependency_overrides.pop(current_user, None)
