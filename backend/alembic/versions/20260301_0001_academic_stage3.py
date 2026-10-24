"""Create Stage 3 academic and timetable schema.

Revision ID: 20260301_0001
Revises:
Create Date: 2026-03-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260301_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "institutions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "departments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("institution_id", sa.String(length=36), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.UniqueConstraint("institution_id", "name", name="uq_department_institution_name"),
    )
    op.create_table(
        "academic_terms",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("institution_id", sa.String(length=36), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("academic_year", sa.String(length=32), nullable=False),
        sa.Column("term", sa.String(length=64), nullable=False),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("institution_id", "academic_year", "term", name="uq_term_institution_year_term"),
    )
    op.create_table(
        "semesters",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("department_id", sa.String(length=36), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.UniqueConstraint("department_id", "number", name="uq_semester_department_number"),
    )
    op.create_table(
        "class_groups",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("department_id", sa.String(length=36), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("semester_id", sa.String(length=36), sa.ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("academic_term_id", sa.String(length=36), sa.ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_name", sa.String(length=32), nullable=False),
        sa.CheckConstraint("length(trim(section_name)) > 0", name="ck_class_group_section_nonempty"),
        sa.UniqueConstraint("department_id", "semester_id", "academic_term_id", "section_name", name="uq_class_group_scope"),
    )
    op.create_table(
        "subjects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("institution_id", sa.String(length=36), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", sa.String(length=36), sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.UniqueConstraint("institution_id", "code", name="uq_subject_institution_code"),
    )
    op.create_table(
        "teachers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("institution_id", sa.String(length=36), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", sa.String(length=36), sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=180)),
        sa.UniqueConstraint("institution_id", "email", name="uq_teacher_institution_email"),
    )
    op.create_table(
        "rooms",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("institution_id", sa.String(length=36), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("room_type", sa.String(length=32), nullable=False, server_default="classroom"),
        sa.UniqueConstraint("institution_id", "code", name="uq_room_institution_code"),
    )
    op.create_table(
        "timetable_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("academic_term_id", sa.String(length=36), sa.ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_group_id", sa.String(length=36), sa.ForeignKey("class_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.String(length=36), sa.ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), sa.ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("room_id", sa.String(length=36), sa.ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("day_of_week", sa.String(length=12), nullable=False),
        sa.Column("start_minute", sa.Integer(), nullable=False),
        sa.Column("end_minute", sa.Integer(), nullable=False),
        sa.Column("session_type", sa.String(length=16), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute", name="ck_session_valid_interval"),
        sa.CheckConstraint("day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday')", name="ck_session_valid_day"),
        sa.CheckConstraint("session_type IN ('Lecture','Laboratory','Tutorial')", name="ck_session_valid_type"),
    )

    for table, column in (
        ("departments", "institution_id"),
        ("academic_terms", "institution_id"),
        ("semesters", "department_id"),
        ("class_groups", "department_id"),
        ("class_groups", "semester_id"),
        ("class_groups", "academic_term_id"),
        ("subjects", "institution_id"),
        ("subjects", "department_id"),
        ("teachers", "institution_id"),
        ("teachers", "department_id"),
        ("rooms", "institution_id"),
        ("timetable_sessions", "academic_term_id"),
        ("timetable_sessions", "class_group_id"),
        ("timetable_sessions", "subject_id"),
        ("timetable_sessions", "teacher_id"),
        ("timetable_sessions", "room_id"),
    ):
        op.create_index(f"ix_{table}_{column}", table, [column])
    op.create_index("ix_session_scope_day", "timetable_sessions", ["academic_term_id", "day_of_week"])

    for name, resource_column in (
        ("ex_session_class_overlap", "class_group_id"),
        ("ex_session_teacher_overlap", "teacher_id"),
        ("ex_session_room_overlap", "room_id"),
    ):
        op.execute(
            f"ALTER TABLE timetable_sessions ADD CONSTRAINT {name} EXCLUDE USING gist "
            f"(academic_term_id WITH =, day_of_week WITH =, {resource_column} WITH =, "
            "int4range(start_minute, end_minute, '[)') WITH &&)"
        )


def downgrade() -> None:
    op.drop_table("timetable_sessions")
    op.drop_table("rooms")
    op.drop_table("teachers")
    op.drop_table("subjects")
    op.drop_table("class_groups")
    op.drop_table("semesters")
    op.drop_table("academic_terms")
    op.drop_table("departments")
    op.drop_table("institutions")
