from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DayOfWeek = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
SessionType = Literal["Lecture", "Laboratory", "Tutorial"]
RoomType = Literal["classroom", "laboratory", "tutorial", "other"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class InstitutionRead(ORMModel):
    id: str
    name: str
    short_name: str | None = None
    institution_type: str | None = None
    address: str | None = None
    active: bool = True


class DepartmentRead(ORMModel):
    id: str
    institution_id: str
    code: str | None = None
    name: str
    active: bool = True


class AcademicTermRead(ORMModel):
    id: str
    institution_id: str
    academic_year: str
    term: str
    start_date: date | None = None
    end_date: date | None = None
    active: bool


class SemesterRead(ORMModel):
    id: str
    department_id: str
    number: int
    label: str
    active: bool = True


class ClassGroupRead(ORMModel):
    id: str
    department_id: str
    semester_id: str
    academic_term_id: str
    section_name: str
    label: str
    active: bool = True


class ResourceRead(BaseModel):
    id: str
    code: str | None = None
    name: str
    room_type: str | None = None
    active: bool = True
    department_id: str | None = None
    semester_id: str | None = None
    description: str | None = None
    building: str | None = None
    capacity: int | None = None
    email: str | None = None


class AcademicResourcesRead(BaseModel):
    subjects: list[ResourceRead]
    teachers: list[ResourceRead]
    rooms: list[ResourceRead]


class SessionBase(BaseModel):
    day: DayOfWeek
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    subject_id: str
    teacher_id: str
    room_id: str
    session_type: SessionType
    notes: str | None = Field(default=None, max_length=2000)
    locked: bool = False

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_clock_time(cls, value: str) -> str:
        hours, minutes = (int(part) for part in value.split(":"))
        if hours > 23 or minutes > 59:
            raise ValueError("time must be a valid 24-hour clock value")
        return value


class SessionCreate(SessionBase):
    pass


class SessionUpdate(SessionBase):
    pass


class TimetableSessionRead(SessionBase):
    id: str
    academic_term_id: str
    class_group_id: str
    locked: bool = False
    created_at: datetime
    updated_at: datetime


class SchedulingRequirementCreate(BaseModel):
    subject_id: str
    teacher_id: str
    session_type: SessionType = "Lecture"
    weekly_count: int = Field(ge=1, le=20)
    duration_minutes: int = Field(ge=15, le=240)
    room_type: RoomType | Literal["any"] = "classroom"
    active: bool = True


class SchedulingRequirementUpdate(BaseModel):
    subject_id: str | None = None
    teacher_id: str | None = None
    session_type: SessionType | None = None
    weekly_count: int | None = Field(default=None, ge=1, le=20)
    duration_minutes: int | None = Field(default=None, ge=15, le=240)
    room_type: RoomType | Literal["any"] | None = None
    active: bool | None = None


class SchedulingRequirementRead(ORMModel):
    id: str
    class_group_id: str
    subject_id: str
    teacher_id: str
    session_type: SessionType
    weekly_count: int
    duration_minutes: int
    room_type: str
    active: bool


class TeacherAvailabilityCreate(BaseModel):
    teacher_id: str
    academic_term_id: str
    day: DayOfWeek
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    available: bool = False


class TeacherAvailabilityRead(ORMModel):
    id: str
    teacher_id: str
    academic_term_id: str
    day: DayOfWeek
    start_time: str
    end_time: str
    available: bool


class GenerateTimetableRequest(BaseModel):
    institution_id: str
    academic_term_id: str
    class_group_ids: list[str] = Field(min_length=1, max_length=12)
    selected_requirement_ids: list[str] = Field(min_length=1, max_length=100)
    working_days: list[DayOfWeek] = Field(default_factory=lambda: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], min_length=1)
    daily_start_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    daily_end_time: str = Field(default="17:00", pattern=r"^\d{2}:\d{2}$")
    quantum_minutes: int = Field(default=30, ge=5, le=60)
    time_limit_seconds: int = Field(default=10, ge=1, le=30)
    preference: Literal["earlier", "balanced"] = "earlier"
    preserve_existing: bool = True


class GeneratedSessionRead(BaseModel):
    id: str
    academic_term_id: str
    class_group_id: str
    day: DayOfWeek
    start_time: str
    end_time: str
    subject_id: str
    teacher_id: str
    room_id: str
    session_type: SessionType
    locked: bool = False
    generated: bool = True


class RequirementGenerationSummary(BaseModel):
    requirement_id: str
    subject_id: str
    teacher_id: str
    session_type: SessionType
    duration_minutes: int
    room_type: str
    required_count: int
    scheduled_count: int
    remaining_count: int
    selected: bool
    duration_mismatch_count: int = 0
    teacher_mismatch_count: int = 0
    warning: str | None = None


class GenerateTimetableResponse(BaseModel):
    proposal_id: str | None = None
    status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "MODEL_INVALID", "UNKNOWN"]
    message: str
    requirement_summaries: list[RequirementGenerationSummary] = []
    sessions: list[GeneratedSessionRead] = []
    preserved_sessions: list[GeneratedSessionRead] = []
    objective_value: float | None = None
    solve_time_ms: int


class ApproveProposalResponse(BaseModel):
    proposal_id: str
    status: Literal["approved"]
    saved_sessions: list[TimetableSessionRead]
    message: str


class SetupResponse(BaseModel):
    created: bool
    institution_id: str
    message: str
    counts: dict[str, int]


class InstitutionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    short_name: str | None = Field(default=None, max_length=32)
    institution_type: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=240)
    active: bool = True


class InstitutionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    short_name: str | None = Field(default=None, max_length=32)
    institution_type: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=240)
    active: bool | None = None


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str | None = Field(default=None, max_length=32)
    active: bool = True


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    code: str | None = Field(default=None, max_length=32)
    active: bool | None = None


class AcademicTermCreate(BaseModel):
    academic_year: str = Field(min_length=4, max_length=32)
    term: str = Field(min_length=2, max_length=64)
    start_date: date | None = None
    end_date: date | None = None
    active: bool = True


class AcademicTermUpdate(BaseModel):
    academic_year: str | None = Field(default=None, min_length=4, max_length=32)
    term: str | None = Field(default=None, min_length=2, max_length=64)
    start_date: date | None = None
    end_date: date | None = None
    active: bool | None = None


class SemesterCreate(BaseModel):
    number: int = Field(ge=1, le=20)
    label: str = Field(min_length=2, max_length=80)
    active: bool = True


class SemesterUpdate(BaseModel):
    number: int | None = Field(default=None, ge=1, le=20)
    label: str | None = Field(default=None, min_length=2, max_length=80)
    active: bool | None = None


class ClassGroupCreate(BaseModel):
    department_id: str
    academic_term_id: str
    section_name: str = Field(min_length=1, max_length=32)
    active: bool = True


class ClassGroupUpdate(BaseModel):
    department_id: str | None = None
    semester_id: str | None = None
    academic_term_id: str | None = None
    section_name: str | None = Field(default=None, min_length=1, max_length=32)
    active: bool | None = None


class SubjectCreate(BaseModel):
    department_id: str | None = None
    semester_id: str | None = None
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    active: bool = True


class SubjectUpdate(BaseModel):
    department_id: str | None = None
    semester_id: str | None = None
    code: str | None = Field(default=None, min_length=2, max_length=32)
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    active: bool | None = None


class SubjectRead(ORMModel):
    id: str
    institution_id: str
    department_id: str | None = None
    semester_id: str | None = None
    code: str
    name: str
    description: str | None = None
    active: bool


class TeacherCreate(BaseModel):
    department_id: str | None = None
    code: str | None = Field(default=None, max_length=32)
    name: str = Field(min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=180)
    active: bool = True


class TeacherUpdate(BaseModel):
    department_id: str | None = None
    code: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=180)
    active: bool | None = None


class TeacherRead(ORMModel):
    id: str
    institution_id: str
    department_id: str | None = None
    code: str | None = None
    name: str
    email: str | None = None
    active: bool


class RoomCreate(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=160)
    building: str | None = Field(default=None, max_length=100)
    capacity: int | None = Field(default=None, ge=1, le=100000)
    room_type: RoomType = "classroom"
    active: bool = True


class RoomUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=32)
    name: str | None = Field(default=None, min_length=2, max_length=160)
    building: str | None = Field(default=None, max_length=100)
    capacity: int | None = Field(default=None, ge=1, le=100000)
    room_type: RoomType | None = None
    active: bool | None = None


class RoomRead(ORMModel):
    id: str
    institution_id: str
    code: str
    name: str
    building: str | None = None
    capacity: int | None = None
    room_type: str
    active: bool
