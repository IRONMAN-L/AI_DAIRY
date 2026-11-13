"""add task tracking fields

Revision ID: 18d7b0a7682a
Revises:
Create Date: 2026-11-02 09:56:05.401200
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "18d7b0a7682a"
down_revision: Union[str, Sequence[str], None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    with op.batch_alter_table("entries") as batch_op:
        batch_op.add_column(
            sa.Column("original_date", sa.Date(), nullable=True)
        )

        batch_op.add_column(
            sa.Column("migrated_from_id", sa.Integer(), nullable=True)
        )

        batch_op.add_column(
            sa.Column("completed_at", sa.DateTime(), nullable=True)
        )

        batch_op.create_foreign_key(
            "fk_entries_migrated_from_id_entries",
            "entries",
            ["migrated_from_id"],
            ["id"]
        )

    # Preserve the original date for existing entries.
    op.execute(
        "UPDATE entries SET original_date = entry_date "
        "WHERE original_date IS NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""

    with op.batch_alter_table("entries") as batch_op:
        batch_op.drop_constraint(
            "fk_entries_migrated_from_id_entries",
            type_="foreignkey"
        )

        batch_op.drop_column("completed_at")
        batch_op.drop_column("migrated_from_id")
        batch_op.drop_column("original_date")