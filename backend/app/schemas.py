from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DayOfWeek = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
SessionType = Literal["Lecture", "Laboratory", "Tutorial"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class InstitutionRead(ORMModel):
    id: str
    name: str


class DepartmentRead(ORMModel):
    id: str
    institution_id: str
    name: str


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


class ClassGroupRead(ORMModel):
    id: str
    department_id: str
    semester_id: str
    academic_term_id: str
    section_name: str
    label: str


class ResourceRead(BaseModel):
    id: str
    code: str | None = None
    name: str
    room_type: str | None = None


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
    created_at: datetime
    updated_at: datetime


class SetupResponse(BaseModel):
    created: bool
    institution_id: str
    message: str
    counts: dict[str, int]
