"""add_storage_capacity

Revision ID: add_storage_capacity
Revises: 3cf5172dbb86
Create Date: 2025-11-30 18:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "add_storage_capacity"
down_revision = "3cf5172dbb86"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "storages" not in inspector.get_table_names():
        return
    existing_columns = [col["name"] for col in inspector.get_columns("storages")]
    if "capacity" not in existing_columns:
        op.add_column("storages", sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"))
        op.alter_column("storages", "capacity", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "storages" not in inspector.get_table_names():
        return
    existing_columns = [col["name"] for col in inspector.get_columns("storages")]
    if "capacity" in existing_columns:
        op.drop_column("storages", "capacity")

