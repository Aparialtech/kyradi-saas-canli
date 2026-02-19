"""Add verification_code column to password_reset_tokens table.

Revision ID: 20251219_verify_code
Revises: 20251219_tickets
Create Date: 2024-12-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251219_verify_code'
down_revision: Union[str, None] = '20251219_tickets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add verification_code column to password_reset_tokens table
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "password_reset_tokens" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("password_reset_tokens")]
        if "verification_code" not in columns:
            op.add_column(
                "password_reset_tokens",
                sa.Column("verification_code", sa.String(length=6), nullable=True)
            )


def downgrade() -> None:
    # Remove verification_code column from password_reset_tokens table
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "password_reset_tokens" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("password_reset_tokens")]
        if "verification_code" in columns:
            op.drop_column("password_reset_tokens", "verification_code")
