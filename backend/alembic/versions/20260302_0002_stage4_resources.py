"""Add Stage 4 academic resource management fields.

Revision ID: 20260302_0002
Revises: 20260301_0001
Create Date: 2026-03-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260302_0002"
down_revision: Union[str, None] = "20260301_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("institutions", sa.Column("short_name", sa.String(length=32), nullable=True))
    op.add_column("institutions", sa.Column("institution_type", sa.String(length=80), nullable=True))
    op.add_column("institutions", sa.Column("address", sa.String(length=240), nullable=True))
    op.add_column("institutions", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.create_unique_constraint("uq_institution_short_name", "institutions", ["short_name"])

    op.add_column("departments", sa.Column("code", sa.String(length=32), nullable=True))
    op.add_column("departments", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.create_unique_constraint("uq_department_institution_code", "departments", ["institution_id", "code"])

    op.add_column("semesters", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("class_groups", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))

    op.add_column("subjects", sa.Column("semester_id", sa.String(length=36), nullable=True))
    op.create_foreign_key("fk_subject_semester", "subjects", "semesters", ["semester_id"], ["id"], ondelete="SET NULL")
    op.add_column("subjects", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("subjects", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))

    op.add_column("teachers", sa.Column("code", sa.String(length=32), nullable=True))
    op.add_column("teachers", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.create_unique_constraint("uq_teacher_institution_code", "teachers", ["institution_id", "code"])

    op.add_column("rooms", sa.Column("building", sa.String(length=100), nullable=True))
    op.add_column("rooms", sa.Column("capacity", sa.Integer(), nullable=True))
    op.add_column("rooms", sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.create_check_constraint("ck_room_capacity_positive", "rooms", "capacity IS NULL OR capacity > 0")
    op.create_check_constraint("ck_room_type_supported", "rooms", "room_type IN ('classroom','laboratory','tutorial','other')")


def downgrade() -> None:
    op.drop_constraint("ck_room_type_supported", "rooms", type_="check")
    op.drop_constraint("ck_room_capacity_positive", "rooms", type_="check")
    op.drop_column("rooms", "active")
    op.drop_column("rooms", "capacity")
    op.drop_column("rooms", "building")

    op.drop_constraint("uq_teacher_institution_code", "teachers", type_="unique")
    op.drop_column("teachers", "active")
    op.drop_column("teachers", "code")

    op.drop_column("subjects", "active")
    op.drop_column("subjects", "description")
    op.drop_constraint("fk_subject_semester", "subjects", type_="foreignkey")
    op.drop_column("subjects", "semester_id")

    op.drop_column("class_groups", "active")
    op.drop_column("semesters", "active")

    op.drop_constraint("uq_department_institution_code", "departments", type_="unique")
    op.drop_column("departments", "active")
    op.drop_column("departments", "code")

    op.drop_constraint("uq_institution_short_name", "institutions", type_="unique")
    op.drop_column("institutions", "active")
    op.drop_column("institutions", "address")
    op.drop_column("institutions", "institution_type")
    op.drop_column("institutions", "short_name")
