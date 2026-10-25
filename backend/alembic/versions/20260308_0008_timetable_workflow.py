"""Add versioned timetable workflow.

Revision ID: 20260308_0008
Revises: 20260305_0007
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260308_0008"
down_revision: Union[str, None] = "20260305_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "timetable_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("academic_term_id", sa.String(length=36), nullable=False),
        sa.Column("class_group_id", sa.String(length=36), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="draft"),
        sa.Column("session_snapshot", sa.JSON(), nullable=False),
        sa.Column("creator_user_id", sa.String(length=36), nullable=False),
        sa.Column("last_editor_user_id", sa.String(length=36), nullable=False),
        sa.Column("submitted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("published_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("base_version_id", sa.String(length=36), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["academic_term_id"], ["academic_terms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_group_id"], ["class_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_group_id", "version_number", name="uq_timetable_version_group_number"),
    )
    op.create_index("ix_timetable_version_group_status", "timetable_versions", ["class_group_id", "status"])
    op.create_index("ix_timetable_versions_institution_id", "timetable_versions", ["institution_id"])
    op.create_index("ix_timetable_versions_academic_term_id", "timetable_versions", ["academic_term_id"])
    op.create_index("ix_timetable_versions_class_group_id", "timetable_versions", ["class_group_id"])
    op.create_table(
        "timetable_reviews",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("timetable_version_id", sa.String(length=36), nullable=False),
        sa.Column("reviewer_user_id", sa.String(length=36), nullable=False),
        sa.Column("decision", sa.String(length=24), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["timetable_version_id"], ["timetable_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timetable_reviews_timetable_version_id", "timetable_reviews", ["timetable_version_id"])


def downgrade() -> None:
    op.drop_index("ix_timetable_reviews_timetable_version_id", table_name="timetable_reviews")
    op.drop_table("timetable_reviews")
    op.drop_index("ix_timetable_versions_class_group_id", table_name="timetable_versions")
    op.drop_index("ix_timetable_versions_academic_term_id", table_name="timetable_versions")
    op.drop_index("ix_timetable_versions_institution_id", table_name="timetable_versions")
    op.drop_index("ix_timetable_version_group_status", table_name="timetable_versions")
    op.drop_table("timetable_versions")
