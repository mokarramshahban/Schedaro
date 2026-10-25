import base64
import json
import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DayOfWeek = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
WorkingWeek = Literal["monday-friday", "monday-saturday"]
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
    working_week: WorkingWeek = "monday-saturday"
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
    daily_start_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    daily_end_time: str = Field(default="17:00", pattern=r"^\d{2}:\d{2}$")
    quantum_minutes: int = Field(default=10, ge=5, le=60)
    time_limit_seconds: int = Field(default=30, ge=1, le=60)
    preference: Literal["balanced", "earlier", "gaps"] = "balanced"
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


class DayDistribution(BaseModel):
    day: DayOfWeek
    sessions: int
    minutes: int
    saved_sessions: int
    proposed_sessions: int
    excluded: bool = False


class GenerateTimetableResponse(BaseModel):
    proposal_id: str | None = None
    status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "MODEL_INVALID", "UNKNOWN"]
    message: str
    working_days: list[DayOfWeek] = []
    preference: Literal["balanced", "earlier", "gaps"] = "balanced"
    warnings: list[str] = []
    distribution: list[DayDistribution] = []
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
    working_week: WorkingWeek = "monday-saturday"
    active: bool = True


class InstitutionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    short_name: str | None = Field(default=None, max_length=32)
    institution_type: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=240)
    active: bool | None = None


class WorkingWeekUpdate(BaseModel):
    working_week: WorkingWeek


class WorkingWeekRead(BaseModel):
    institution_id: str
    working_week: WorkingWeek
    working_days: list[DayOfWeek]
    saturday_exception_count: int = 0
    warning: str | None = None


LayoutElementKind = Literal["dynamic", "custom", "logo", "divider"]
LayoutField = Literal["institution_name", "institution_type", "address", "department_name", "timetable_title", "semester_section", "academic_term"]
TextAlign = Literal["left", "center", "right"]


class PrintLayoutElement(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    kind: LayoutElementKind
    field: LayoutField | None = None
    text: str | None = Field(default=None, max_length=240)
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    width: float = Field(gt=0, le=100)
    height: float = Field(gt=0, le=100)
    align: TextAlign = "left"
    font_size: float = Field(default=10, ge=6, le=28)
    bold: bool = False
    visible: bool = True

    @model_validator(mode="after")
    def validate_element(self):
        if self.x + self.width > 100 or self.y + self.height > 100:
            raise ValueError("layout elements must remain within their region")
        if self.kind == "dynamic" and self.field is None:
            raise ValueError("dynamic elements require a safe predefined field")
        if self.kind == "custom" and not self.text:
            raise ValueError("custom elements require text")
        if self.kind in {"logo", "divider"} and (self.field is not None or self.text is not None):
            raise ValueError("logo and divider elements cannot contain text fields")
        return self


class PrintSignatureElement(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    label: str = Field(min_length=1, max_length=80)
    secondary_text: str | None = Field(default=None, max_length=120)
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    width: float = Field(gt=0, le=100)
    height: float = Field(gt=0, le=100)
    align: TextAlign = "center"
    show_line: bool = True

    @model_validator(mode="after")
    def validate_bounds(self):
        if self.x + self.width > 100 or self.y + self.height > 100:
            raise ValueError("signature elements must remain within the footer region")
        return self


class PrintLayoutPayload(BaseModel):
    header_elements: list[PrintLayoutElement] = Field(default_factory=list, max_length=20)
    footer_elements: list[PrintSignatureElement] = Field(default_factory=list, max_length=5)
    logo_data_url: str | None = Field(default=None, max_length=1_500_000)

    @field_validator("logo_data_url")
    @classmethod
    def validate_logo(cls, value: str | None):
        if value is None:
            return value
        match = re.fullmatch(r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)", value)
        if not match:
            raise ValueError("logo must be a PNG or JPEG data URL")
        try:
            decoded = base64.b64decode(match.group(2), validate=True)
        except ValueError as error:
            raise ValueError("logo data is not valid base64") from error
        if len(decoded) > 1_000_000:
            raise ValueError("logo must be 1 MB or smaller")
        if match.group(1) == "png" and not decoded.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("logo PNG signature is invalid")
        if match.group(1) == "jpeg" and not decoded.startswith(b"\xff\xd8\xff"):
            raise ValueError("logo JPEG signature is invalid")
        return value

    @model_validator(mode="after")
    def validate_ids(self):
        ids = [item.id for item in self.header_elements] + [item.id for item in self.footer_elements]
        if len(ids) != len(set(ids)):
            raise ValueError("layout element IDs must be unique")
        for elements, region in ((self.header_elements, "header"), (self.footer_elements, "footer")):
            for index, first in enumerate(elements):
                for second in elements[index + 1:]:
                    if first.x < second.x + second.width and first.x + first.width > second.x and first.y < second.y + second.height and first.y + first.height > second.y:
                        raise ValueError(f"{region} elements cannot overlap")
        return self


class PrintLayoutTemplateRead(PrintLayoutPayload):
    id: str
    institution_id: str
    version: int
    updated_at: datetime


class PdfmeTemplatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    template: dict = Field(min_length=1)
    is_default: bool = False
    active: bool = True

    @field_validator("template")
    @classmethod
    def validate_template(cls, value: dict):
        if len(json.dumps(value, separators=(",", ":"))) > 2_000_000:
            raise ValueError("pdfme template must be 2 MB or smaller")
        assets = value.get("__schedaroAssets")
        if assets is not None:
            if not isinstance(assets, dict) or set(assets) - {"letterhead"}:
                raise ValueError("pdfme assets are invalid")
            letterhead = assets.get("letterhead")
            if letterhead is not None:
                match = re.fullmatch(r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)", letterhead)
                if not match:
                    raise ValueError("letterhead must be a PNG or JPEG data URL")
                try:
                    decoded = base64.b64decode(match.group(2), validate=True)
                except ValueError as error:
                    raise ValueError("letterhead data is not valid base64") from error
                if len(decoded) > 1_000_000:
                    raise ValueError("letterhead must be 1 MB or smaller")
                if match.group(1) == "png" and not decoded.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ValueError("letterhead PNG signature is invalid")
                if match.group(1) == "jpeg" and not decoded.startswith(b"\xff\xd8\xff"):
                    raise ValueError("letterhead JPEG signature is invalid")
        base = value.get("basePdf")
        if not isinstance(base, dict) or base.get("width") != 297 or base.get("height") != 210:
            raise ValueError("pdfme templates must use A4 landscape dimensions")
        pages = value.get("schemas")
        if not isinstance(pages, list) or not pages or len(pages) > 10:
            raise ValueError("pdfme template must contain one to ten pages")
        allowed_types = {"text", "image", "line", "rectangle"}
        for page in pages:
            if not isinstance(page, list) or len(page) > 500:
                raise ValueError("pdfme template pages are invalid or too large")
            for schema in page:
                if not isinstance(schema, dict) or schema.get("type") not in allowed_types:
                    raise ValueError("unsupported or unsafe pdfme schema type")
                name = schema.get("name")
                if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", name):
                    raise ValueError("pdfme schema names must use safe identifiers")
        return value


class PdfmeTemplateRead(PdfmeTemplatePayload):
    id: str
    institution_id: str
    version: int
    created_at: datetime
    updated_at: datetime


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
