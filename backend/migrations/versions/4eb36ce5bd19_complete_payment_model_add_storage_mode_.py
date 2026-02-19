"""complete_payment_model_add_storage_mode_transaction_paid_at

Revision ID: 4eb36ce5bd19
Revises: 11b5c02e1723
Create Date: 2025-11-26 16:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '4eb36ce5bd19'
down_revision = '11b5c02e1723'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add storage_id column
    op.add_column('payments', sa.Column('storage_id', sa.String(length=36), nullable=True))
    op.create_foreign_key(
        'fk_payments_storage_id',
        'payments',
        'storages',
        ['storage_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_payments_storage_id', 'payments', ['storage_id'])
    
    # Add mode column
    op.add_column('payments', sa.Column('mode', sa.String(length=32), nullable=False, server_default='GATEWAY_DEMO'))
    
    # Add transaction_id column
    op.add_column('payments', sa.Column('transaction_id', sa.String(length=128), nullable=True))
    op.create_index('ix_payments_transaction_id', 'payments', ['transaction_id'])
    
    # Add paid_at column
    op.add_column('payments', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    
    # Update provider default if needed
    op.alter_column('payments', 'provider',
                    existing_type=sa.String(length=32),
                    server_default='MAGIC_PAY',
                    existing_nullable=False)


def downgrade() -> None:
    # Remove indexes and foreign keys first
    op.drop_index('ix_payments_transaction_id', table_name='payments')
    op.drop_index('ix_payments_storage_id', table_name='payments')
    op.drop_constraint('fk_payments_storage_id', 'payments', type_='foreignkey')
    
    # Remove columns
    op.drop_column('payments', 'paid_at')
    op.drop_column('payments', 'transaction_id')
    op.drop_column('payments', 'mode')
    op.drop_column('payments', 'storage_id')
    
    # Remove provider default
    op.alter_column('payments', 'provider',
                    existing_type=sa.String(length=32),
                    server_default=None,
                    existing_nullable=False)
