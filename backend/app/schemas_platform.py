from pydantic import BaseModel, Field, field_validator


class PlatformLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("A valid email address is required.")
        return value


class PlatformUserRead(BaseModel):
    id: str
    email: str
    role: str
    active: bool


class PlatformMembershipRead(BaseModel):
    institution_id: str
    institution_name: str
    working_week: str = "monday-saturday"
    role: str
    active: bool


class PlatformInstitutionRead(BaseModel):
    id: str
    name: str
    short_name: str | None = None
    status: str
    schema_version: str | None = None
    active: bool
    database_ready: bool


class PlatformWorkspaceSummaryRead(BaseModel):
    institution_id: str
    institution_name: str
    departments: int
    subjects: int
    teachers: int
    rooms: int
    timetable_sessions: int


class PlatformOverviewRead(BaseModel):
    institution_count: int
    active_institution_count: int
    ready_institution_count: int
    owner_count: int
    institutions: list[PlatformInstitutionRead]
