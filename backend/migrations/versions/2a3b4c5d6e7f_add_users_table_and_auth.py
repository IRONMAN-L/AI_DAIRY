"""add users table and user_id to entries

Revision ID: 2a3b4c5d6e7f
Revises: 18d7b0a7682a
Create Date: 2026-11-13 07:50:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "2a3b4c5d6e7f"
down_revision: Union[str, Sequence[str], None] = "18d7b0a7682a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2. Add user_id column and foreign key to entries
    with op.batch_alter_table("entries") as batch_op:
        batch_op.add_column(
            sa.Column("user_id", sa.Integer(), nullable=True)
        )
        batch_op.create_index("ix_entries_user_id", ["user_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_entries_user_id_users",
            "users",
            ["user_id"],
            ["id"]
        )


def downgrade() -> None:
    with op.batch_alter_table("entries") as batch_op:
        batch_op.drop_constraint("fk_entries_user_id_users", type_="foreignkey")
        batch_op.drop_index("ix_entries_user_id")
        batch_op.drop_column("user_id")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

