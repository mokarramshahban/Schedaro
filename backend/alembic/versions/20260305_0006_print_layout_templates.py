"""Add institution-scoped print layout templates.

Revision ID: 20260305_0006
Revises: 20260304_0005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260305_0006"
down_revision: Union[str, None] = "20260304_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "print_layout_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("layout", sa.JSON(), nullable=False),
        sa.Column("logo_data_url", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("institution_id"),
    )
    op.create_index("ix_print_layout_templates_institution_id", "print_layout_templates", ["institution_id"])


def downgrade() -> None:
    op.drop_index("ix_print_layout_templates_institution_id", table_name="print_layout_templates")
    op.drop_table("print_layout_templates")
