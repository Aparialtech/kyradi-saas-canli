"""Add pricing fields to widget_reservations table

Revision ID: add_pricing_widget_res
Revises: 
Create Date: 2025-01-15

This migration adds pricing fields to widget_reservations table to store
the pre-calculated price from the widget's pricing estimate API call.
This ensures price consistency between widget display and payment processing.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_pricing_widget_res'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add pricing fields to widget_reservations table."""
    # Check if columns already exist before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [col['name'] for col in inspector.get_columns('widget_reservations')]
    
    if 'amount_minor' not in existing_columns:
        op.add_column('widget_reservations', sa.Column(
            'amount_minor', 
            sa.Integer(), 
            nullable=True, 
            comment='Pre-calculated amount in minor units (kuruş) from pricing API'
        ))
    
    if 'pricing_rule_id' not in existing_columns:
        op.add_column('widget_reservations', sa.Column(
            'pricing_rule_id', 
            sa.String(length=36), 
            nullable=True, 
            comment='ID of the pricing rule used for calculation'
        ))
    
    if 'pricing_type' not in existing_columns:
        op.add_column('widget_reservations', sa.Column(
            'pricing_type', 
            sa.String(length=32), 
            nullable=True, 
            comment='Pricing type: daily, hourly, weekly, monthly'
        ))
    
    if 'currency' not in existing_columns:
        op.add_column('widget_reservations', sa.Column(
            'currency', 
            sa.String(length=3), 
            nullable=False, 
            server_default='TRY', 
            comment='Currency code'
        ))


def downgrade() -> None:
    """Remove pricing fields from widget_reservations table."""
    op.drop_column('widget_reservations', 'currency')
    op.drop_column('widget_reservations', 'pricing_type')
    op.drop_column('widget_reservations', 'pricing_rule_id')
    op.drop_column('widget_reservations', 'amount_minor')

