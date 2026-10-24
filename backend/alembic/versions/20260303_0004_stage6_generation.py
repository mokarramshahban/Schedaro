"""Add Stage 6 scheduling requirements, availability, locking and proposals.

Revision ID: 20260303_0004
Revises: 20260302_0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260303_0004"
down_revision: Union[str, None] = "20260302_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("timetable_sessions", sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "scheduling_requirements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("class_group_id", sa.String(length=36), nullable=False),
        sa.Column("subject_id", sa.String(length=36), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("session_type", sa.String(length=16), nullable=False, server_default="Lecture"),
        sa.Column("weekly_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("room_type", sa.String(length=32), nullable=False, server_default="classroom"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["class_group_id"], ["class_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_group_id", "subject_id", "session_type", name="uq_requirement_group_subject_type"),
    )
    op.create_index("ix_scheduling_requirements_class_group_id", "scheduling_requirements", ["class_group_id"])
    op.create_index("ix_scheduling_requirements_subject_id", "scheduling_requirements", ["subject_id"])
    op.create_index("ix_scheduling_requirements_teacher_id", "scheduling_requirements", ["teacher_id"])
    op.create_table(
        "teacher_availability",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("academic_term_id", sa.String(length=36), nullable=False),
        sa.Column("day_of_week", sa.String(length=12), nullable=False),
        sa.Column("start_minute", sa.Integer(), nullable=False),
        sa.Column("end_minute", sa.Integer(), nullable=False),
        sa.Column("available", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint("start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute", name="ck_teacher_availability_interval"),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["academic_term_id"], ["academic_terms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_teacher_availability_teacher_id", "teacher_availability", ["teacher_id"])
    op.create_index("ix_teacher_availability_academic_term_id", "teacher_availability", ["academic_term_id"])
    op.create_table(
        "timetable_proposals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("academic_term_id", sa.String(length=36), nullable=False),
        sa.Column("class_group_ids", sa.JSON(), nullable=False),
        sa.Column("candidate_sessions", sa.JSON(), nullable=False),
        sa.Column("base_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["academic_term_id"], ["academic_terms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timetable_proposals_institution_id", "timetable_proposals", ["institution_id"])
    op.create_index("ix_timetable_proposals_academic_term_id", "timetable_proposals", ["academic_term_id"])


def downgrade() -> None:
    op.drop_index("ix_timetable_proposals_academic_term_id", table_name="timetable_proposals")
    op.drop_index("ix_timetable_proposals_institution_id", table_name="timetable_proposals")
    op.drop_table("timetable_proposals")
    op.drop_index("ix_teacher_availability_academic_term_id", table_name="teacher_availability")
    op.drop_index("ix_teacher_availability_teacher_id", table_name="teacher_availability")
    op.drop_table("teacher_availability")
    op.drop_index("ix_scheduling_requirements_teacher_id", table_name="scheduling_requirements")
    op.drop_index("ix_scheduling_requirements_subject_id", table_name="scheduling_requirements")
    op.drop_index("ix_scheduling_requirements_class_group_id", table_name="scheduling_requirements")
    op.drop_table("scheduling_requirements")
    op.drop_column("timetable_sessions", "locked")
