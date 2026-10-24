"""Complete Stage 4 resource indexes.

Revision ID: 20260302_0003
Revises: 20260302_0002
Create Date: 2026-03-02
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260302_0003"
down_revision: Union[str, None] = "20260302_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_subjects_semester_id", "subjects", ["semester_id"])


def downgrade() -> None:
    op.drop_index("ix_subjects_semester_id", table_name="subjects")
