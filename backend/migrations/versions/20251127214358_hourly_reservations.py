"""Add hourly reservation fields and update status enum

Revision ID: hourly_reservations
Revises: add_reservation_customer_fields
Create Date: 2025-11-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'hourly_reservations'
down_revision = 'add_reservation_customer_fields'  # Add customer fields to reservations
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add hourly reservation fields to reservations table
    op.add_column('reservations', sa.Column('start_datetime', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reservations', sa.Column('end_datetime', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reservations', sa.Column('duration_hours', sa.Numeric(10, 2), nullable=True))
    op.add_column('reservations', sa.Column('hourly_rate', sa.Integer(), nullable=True))
    op.add_column('reservations', sa.Column('estimated_total_price', sa.Integer(), nullable=True))
    
    # Add indexes for datetime fields
    op.create_index('ix_reservations_start_datetime', 'reservations', ['start_datetime'])
    op.create_index('ix_reservations_end_datetime', 'reservations', ['end_datetime'])
    
    # Add default_hourly_rate to tenants table
    op.add_column('tenants', sa.Column('default_hourly_rate', sa.Integer(), nullable=True, server_default='1500'))
    
    # Update existing reservations: copy start_at/end_at to start_datetime/end_datetime
    op.execute("""
        UPDATE reservations 
        SET start_datetime = start_at, 
            end_datetime = end_at
        WHERE start_datetime IS NULL
    """)
    
    # Calculate duration_hours for existing reservations
    op.execute("""
        UPDATE reservations 
        SET duration_hours = EXTRACT(EPOCH FROM (end_datetime - start_datetime)) / 3600.0
        WHERE start_datetime IS NOT NULL AND end_datetime IS NOT NULL
    """)


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_reservations_end_datetime', table_name='reservations')
    op.drop_index('ix_reservations_start_datetime', table_name='reservations')
    
    # Remove hourly fields from reservations
    op.drop_column('reservations', 'estimated_total_price')
    op.drop_column('reservations', 'hourly_rate')
    op.drop_column('reservations', 'duration_hours')
    op.drop_column('reservations', 'end_datetime')
    op.drop_column('reservations', 'start_datetime')
    
    # Remove default_hourly_rate from tenants
    op.drop_column('tenants', 'default_hourly_rate')
