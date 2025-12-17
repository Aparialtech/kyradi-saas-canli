"""add_used_at_to_password_reset_tokens

Revision ID: 3b3dc65cb4b1
Revises: 33bc002334ce
Create Date: 2025-11-25 14:03:27.412750
"""
from alembic import op
import sqlalchemy as sa



revision = '3b3dc65cb4b1'
down_revision = '33bc002334ce'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "password_reset_tokens" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("password_reset_tokens")]
        if "used_at" not in existing_columns:
            op.add_column("password_reset_tokens", sa.Column("used_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Check if column exists before dropping
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "password_reset_tokens" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("password_reset_tokens")]
        if "used_at" in existing_columns:
            op.drop_column("password_reset_tokens", "used_at")
