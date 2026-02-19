"""make_payment_reservation_id_nullable

Revision ID: c20eed016def
Revises: 3b3dc65cb4b1
Create Date: 2025-11-26 01:35:32.806356
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.exc import ProgrammingError

revision = 'c20eed016def'
down_revision = '3b3dc65cb4b1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('payments'):
        try:
            op.alter_column(
                'payments',
                'reservation_id',
                existing_type=sa.VARCHAR(length=36),
                nullable=True,
            )
        except ProgrammingError:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('payments'):
        try:
            op.alter_column(
                'payments',
                'reservation_id',
                existing_type=sa.VARCHAR(length=36),
                nullable=False,
            )
        except ProgrammingError:
            pass
