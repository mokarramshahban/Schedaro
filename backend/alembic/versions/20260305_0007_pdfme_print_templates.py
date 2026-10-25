"""Add institution-scoped multi-template pdfme print designs.

Revision ID: 20260305_0007
Revises: 20260305_0006
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260305_0007"
down_revision: Union[str, None] = "20260305_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pdfme_print_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("institution_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("template", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pdfme_print_templates_institution_id", "pdfme_print_templates", ["institution_id"])


def downgrade() -> None:
    op.drop_index("ix_pdfme_print_templates_institution_id", table_name="pdfme_print_templates")
    op.drop_table("pdfme_print_templates")
