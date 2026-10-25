from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator, model_validator

WorkingWeek = Literal["monday-friday", "monday-saturday"]


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
    portal_slug: str | None = None
    working_week: str = "monday-saturday"
    role: str
    active: bool


class RoleAssignmentRead(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    institution_id: str
    role: str
    scope_type: str
    scope_id: str | None = None
    scope_label: str | None = None
    designation: str | None = None
    status: str
    granted_by: str
    created_at: datetime | None = None


class RoleAssignmentCreate(BaseModel):
    user_id: str
    institution_id: str
    role: str
    scope_type: str = "institution"
    scope_id: str | None = None
    designation: str | None = Field(default=None, max_length=120)


class RoleContextRead(BaseModel):
    assignment_id: str | None = None
    institution_id: str | None = None
    role: str | None = None
    scope_type: str | None = None
    scope_id: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RoleContextSelect(BaseModel):
    assignment_id: str


class PermissionDefinition(BaseModel):
    key: str
    description: str


class PortalPublicRead(BaseModel):
    name: str
    portal_slug: str
    status: str
    available: bool


class InvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    role: str = Field(default="institution_admin", pattern="^(institution_admin|college_administrator|director|dean|registrar|hod|academic_coordinator|class_in_charge|faculty|student)$")
    scope_type: str = "institution"
    scope_id: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_invitation_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("A valid email address is required.")
        return value


class InvitationRead(BaseModel):
    id: str
    recipient_email: str
    institution_id: str
    institution_name: str
    portal_slug: str | None = None
    role: str
    scope_type: str = "institution"
    scope_id: str | None = None
    method: str = "email"
    approval_status: str = "not_required"
    status: str
    delivery_status: str
    expires_at: datetime
    created_at: datetime | None = None


class InvitationInspectRead(BaseModel):
    invitation_id: str
    recipient_email: str
    institution_name: str
    portal_slug: str | None = None
    role: str
    expires_at: datetime


class ManualInvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    expiration_hours: int = Field(default=168, ge=1, le=720)

    @field_validator("email")
    @classmethod
    def normalize_manual_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("A valid email address is required.")
        return value


class ManualInvitationCreated(BaseModel):
    invitation: InvitationRead
    activation_url: str
    activation_key: str
    expires_at: datetime


class ManualActivationRequest(BaseModel):
    invitation_id: str
    activation_key: str = Field(min_length=20, max_length=300)
    email: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_manual_activation_email(cls, value: str) -> str:
        return value.strip().lower()


class InvitationApprovalRequest(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")


class InvitationTokenRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)


class InvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    email: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_accept_email(cls, value: str) -> str:
        return value.strip().lower()


class PasswordForgotRequest(BaseModel):
    email: str = Field(min_length=3, max_length=180)


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=12, max_length=256)


class ManualPasswordResetCreate(BaseModel):
    confirmation: str = Field(min_length=4, max_length=16)
    expiration_minutes: int = Field(default=30, ge=5, le=120)
    institution_id: str | None = Field(default=None, min_length=1, max_length=36)

    @field_validator("confirmation")
    @classmethod
    def validate_confirmation(cls, value: str) -> str:
        if value.strip().upper() != "RESET":
            raise ValueError("Type RESET to confirm the manual password reset.")
        return "RESET"


class ManualPasswordResetCreated(BaseModel):
    reset_id: str
    user_id: str
    email: str
    reset_url: str
    reset_key: str
    expires_at: datetime


class PlatformInstitutionRead(BaseModel):
    id: str
    name: str
    short_name: str | None = None
    portal_slug: str | None = None
    institution_type: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    timezone: str = "UTC"
    working_week: WorkingWeek = "monday-saturday"
    daily_start_time: str = "09:00"
    daily_end_time: str = "17:00"
    status: str
    schema_version: str | None = None
    active: bool
    database_ready: bool
    provisioning_operation_id: str | None = None
    registered_at: datetime | None = None


class PlatformInstitutionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    short_name: str | None = Field(default=None, max_length=32)
    institution_type: str | None = Field(default=None, max_length=80)
    contact_email: str | None = Field(default=None, max_length=180)
    contact_phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=240)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    working_week: WorkingWeek = "monday-saturday"
    daily_start_time: str = "09:00"
    daily_end_time: str = "17:00"
    initial_departments: list[str] = Field(default_factory=list, max_length=30)
    idempotency_key: str = Field(min_length=8, max_length=120)

    @field_validator("name", "short_name", "institution_type", "address")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as error:
            raise ValueError("Timezone must be a valid IANA timezone.") from error
        return value

    @field_validator("daily_start_time", "daily_end_time")
    @classmethod
    def valid_clock(cls, value: str) -> str:
        try:
            hour, minute = (int(part) for part in value.split(":"))
        except (ValueError, AttributeError) as error:
            raise ValueError("Time must use HH:MM format.") from error
        if not 0 <= hour <= 23 or minute not in {0, 10, 20, 30, 40, 50}:
            raise ValueError("Time must use a valid 10-minute clock value.")
        return f"{hour:02d}:{minute:02d}"

    @field_validator("initial_departments")
    @classmethod
    def valid_departments(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values if value.strip()]
        if len(set(value.casefold() for value in normalized)) != len(normalized):
            raise ValueError("Initial department names must be unique.")
        return normalized

    @model_validator(mode="after")
    def end_after_start(self):
        start = int(self.daily_start_time[:2]) * 60 + int(self.daily_start_time[3:])
        end = int(self.daily_end_time[:2]) * 60 + int(self.daily_end_time[3:])
        if end <= start:
            raise ValueError("Teaching day end must be after its start.")
        return self


class PlatformProvisioningRead(BaseModel):
    id: str
    institution_id: str
    status: str
    error_message: str | None = None
    attempts: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PlatformInstitutionCreateResponse(BaseModel):
    institution: PlatformInstitutionRead
    provisioning: PlatformProvisioningRead


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
