"""Add institution-level working-week configuration.

Revision ID: 20260304_0005
Revises: 20260303_0004
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260304_0005"
down_revision: Union[str, None] = "20260303_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("institutions", sa.Column("working_week", sa.String(length=20), nullable=False, server_default="monday-saturday"))
    op.create_check_constraint("ck_institution_working_week", "institutions", "working_week IN ('monday-friday','monday-saturday')")


def downgrade() -> None:
    op.drop_constraint("ck_institution_working_week", "institutions", type_="check")
    op.drop_column("institutions", "working_week")
