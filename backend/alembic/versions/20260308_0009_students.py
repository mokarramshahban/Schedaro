"""Add synthetic academic student records.

Revision ID: 20260308_0009
Revises: 20260308_0008
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260308_0009"
down_revision: Union[str, None] = "20260308_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "students",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("student_number", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=180), nullable=True),
        sa.Column("department_id", sa.String(length=36), nullable=False),
        sa.Column("semester_id", sa.String(length=36), nullable=False),
        sa.Column("class_group_id", sa.String(length=36), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_group_id"], ["class_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("institution_id", "student_number", name="uq_student_institution_number"),
    )
    op.create_index("ix_students_institution_id", "students", ["institution_id"])
    op.create_index("ix_student_class_group", "students", ["class_group_id"])
    op.create_index("ix_students_department_id", "students", ["department_id"])
    op.create_index("ix_students_semester_id", "students", ["semester_id"])


def downgrade() -> None:
    op.drop_index("ix_students_semester_id", table_name="students")
    op.drop_index("ix_students_department_id", table_name="students")
    op.drop_index("ix_student_class_group", table_name="students")
    op.drop_index("ix_students_institution_id", table_name="students")
    op.drop_table("students")
