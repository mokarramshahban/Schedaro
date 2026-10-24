from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def new_id() -> str:
    return str(uuid4())


class Institution(Base):
    __tablename__ = "institutions"
    __table_args__ = (CheckConstraint("working_week IN ('monday-friday','monday-saturday')", name="ck_institution_working_week"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    short_name: Mapped[str | None] = mapped_column(String(32), unique=True)
    institution_type: Mapped[str | None] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(String(240))
    working_week: Mapped[str] = mapped_column(String(20), nullable=False, default="monday-saturday", server_default="monday-saturday")
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    departments: Mapped[list["Department"]] = relationship(back_populates="institution", cascade="all, delete-orphan")
    terms: Mapped[list["AcademicTerm"]] = relationship(back_populates="institution", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("institution_id", "name", name="uq_department_institution_name"),
        UniqueConstraint("institution_id", "code", name="uq_department_institution_code"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    institution: Mapped[Institution] = relationship(back_populates="departments")
    semesters: Mapped[list["Semester"]] = relationship(back_populates="department", cascade="all, delete-orphan")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="department")
    teachers: Mapped[list["Teacher"]] = relationship(back_populates="department")
    class_groups: Mapped[list["ClassGroup"]] = relationship(back_populates="department")


class AcademicTerm(Base):
    __tablename__ = "academic_terms"
    __table_args__ = (UniqueConstraint("institution_id", "academic_year", "term", name="uq_term_institution_year_term"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(32), nullable=False)
    term: Mapped[str] = mapped_column(String(64), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    institution: Mapped[Institution] = relationship(back_populates="terms")
    class_groups: Mapped[list["ClassGroup"]] = relationship(back_populates="academic_term")
    sessions: Mapped[list["TimetableSession"]] = relationship(back_populates="academic_term")


class Semester(Base):
    __tablename__ = "semesters"
    __table_args__ = (UniqueConstraint("department_id", "number", name="uq_semester_department_number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    department: Mapped[Department] = relationship(back_populates="semesters")
    class_groups: Mapped[list["ClassGroup"]] = relationship(back_populates="semester")


class ClassGroup(Base):
    __tablename__ = "class_groups"
    __table_args__ = (
        UniqueConstraint("department_id", "semester_id", "academic_term_id", "section_name", name="uq_class_group_scope"),
        CheckConstraint("length(trim(section_name)) > 0", name="ck_class_group_section_nonempty"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    semester_id: Mapped[str] = mapped_column(ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_term_id: Mapped[str] = mapped_column(ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    section_name: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    department: Mapped[Department] = relationship(back_populates="class_groups")
    semester: Mapped[Semester] = relationship(back_populates="class_groups")
    academic_term: Mapped[AcademicTerm] = relationship(back_populates="class_groups")
    sessions: Mapped[list["TimetableSession"]] = relationship(back_populates="class_group")


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("institution_id", "code", name="uq_subject_institution_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), index=True)
    semester_id: Mapped[str | None] = mapped_column(ForeignKey("semesters.id", ondelete="SET NULL"), index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    department: Mapped[Department | None] = relationship(back_populates="subjects")
    semester: Mapped[Semester | None] = relationship()
    sessions: Mapped[list["TimetableSession"]] = relationship(back_populates="subject")


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = (
        UniqueConstraint("institution_id", "email", name="uq_teacher_institution_email"),
        UniqueConstraint("institution_id", "code", name="uq_teacher_institution_code"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), index=True)
    code: Mapped[str | None] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str | None] = mapped_column(String(180))
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    department: Mapped[Department | None] = relationship(back_populates="teachers")
    sessions: Mapped[list["TimetableSession"]] = relationship(back_populates="teacher")


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("institution_id", "code", name="uq_room_institution_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    building: Mapped[str | None] = mapped_column(String(100))
    capacity: Mapped[int | None] = mapped_column(Integer)
    room_type: Mapped[str] = mapped_column(String(32), nullable=False, default="classroom")
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    sessions: Mapped[list["TimetableSession"]] = relationship(back_populates="room")


class TimetableSession(Base):
    __tablename__ = "timetable_sessions"
    __table_args__ = (
        CheckConstraint("start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute", name="ck_session_valid_interval"),
        CheckConstraint("day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday')", name="ck_session_valid_day"),
        CheckConstraint("session_type IN ('Lecture','Laboratory','Tutorial')", name="ck_session_valid_type"),
        Index("ix_session_scope_day", "academic_term_id", "day_of_week"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    academic_term_id: Mapped[str] = mapped_column(ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    class_group_id: Mapped[str] = mapped_column(ForeignKey("class_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False, index=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(12), nullable=False)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    session_type: Mapped[str] = mapped_column(String(16), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    academic_term: Mapped[AcademicTerm] = relationship(back_populates="sessions")
    class_group: Mapped[ClassGroup] = relationship(back_populates="sessions")
    subject: Mapped[Subject] = relationship(back_populates="sessions")
    teacher: Mapped[Teacher] = relationship(back_populates="sessions")
    room: Mapped[Room] = relationship(back_populates="sessions")


class SchedulingRequirement(Base):
    __tablename__ = "scheduling_requirements"
    __table_args__ = (UniqueConstraint("class_group_id", "subject_id", "session_type", name="uq_requirement_group_subject_type"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    class_group_id: Mapped[str] = mapped_column(ForeignKey("class_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False, index=True)
    session_type: Mapped[str] = mapped_column(String(16), nullable=False, default="Lecture")
    weekly_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    room_type: Mapped[str] = mapped_column(String(32), nullable=False, default="classroom")
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    class_group: Mapped[ClassGroup] = relationship()
    subject: Mapped[Subject] = relationship()
    teacher: Mapped[Teacher] = relationship()


class TeacherAvailability(Base):
    __tablename__ = "teacher_availability"
    __table_args__ = (CheckConstraint("start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute", name="ck_teacher_availability_interval"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_term_id: Mapped[str] = mapped_column(ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(12), nullable=False)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    teacher: Mapped[Teacher] = relationship()
    academic_term: Mapped[AcademicTerm] = relationship()


class PrintLayoutTemplate(Base):
    __tablename__ = "print_layout_templates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    layout: Mapped[dict] = mapped_column(JSON, nullable=False)
    logo_data_url: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    institution: Mapped[Institution] = relationship()


class TimetableProposal(Base):
    __tablename__ = "timetable_proposals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_term_id: Mapped[str] = mapped_column(ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    class_group_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    candidate_sessions: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    base_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
