import pytest
from pydantic import ValidationError

from app.schemas_platform import PlatformInstitutionCreate
from app.services.provisioning import safe_database_name


def test_institution_onboarding_validates_schedule_and_timezone():
    payload = PlatformInstitutionCreate(name="North Star College", idempotency_key="north-star-2026", timezone="UTC", working_week="monday-friday", daily_start_time="08:00", daily_end_time="16:00")
    assert payload.daily_start_time == "08:00"
    assert payload.working_week == "monday-friday"


@pytest.mark.parametrize("start,end", [("16:00", "08:00"), ("09:00", "09:00")])
def test_institution_onboarding_rejects_invalid_teaching_window(start, end):
    with pytest.raises(ValidationError, match="Teaching day end"):
        PlatformInstitutionCreate(name="Invalid College", idempotency_key="invalid-window", daily_start_time=start, daily_end_time=end)


def test_generated_tenant_database_name_is_safe_and_bounded():
    database_name = safe_database_name("017d50f6-0fd5-4e0b-8319-ef51b3232813")
    assert database_name == "schedaro_tenant_017d50f60fd54e0b8319ef51"
    assert len(database_name) <= 63
    assert database_name.startswith("schedaro_tenant_")
