"""add_luggage_fields_to_widget_reservations

Revision ID: 3cf5172dbb86
Revises: hourly_reservations
Create Date: 2025-11-28 01:09:58.112195
"""
from alembic import op
import sqlalchemy as sa



revision = '3cf5172dbb86'
down_revision = 'hourly_reservations'  # hourly_reservations
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if columns already exist (idempotency)
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "widget_reservations" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("widget_reservations")]
        
        # Add luggage_type column if it doesn't exist
        if "luggage_type" not in existing_columns:
            op.add_column(
                'widget_reservations',
                sa.Column('luggage_type', sa.String(64), nullable=True, comment='Luggage type: Cabin, Medium, Large, Backpack, Other')
            )
        
        # Add luggage_description column if it doesn't exist
        if "luggage_description" not in existing_columns:
            op.add_column(
                'widget_reservations',
                sa.Column('luggage_description', sa.Text(), nullable=True, comment='Luggage content description/summary (max 500 chars)')
            )
        
        # Add disclosure_consent column if it doesn't exist
        if "disclosure_consent" not in existing_columns:
            op.add_column(
                'widget_reservations',
                sa.Column('disclosure_consent', sa.Boolean(), nullable=False, server_default='false', comment='Disclosure text consent (required)')
            )


def downgrade() -> None:
    # Check if columns exist before dropping
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "widget_reservations" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("widget_reservations")]
        
        if "disclosure_consent" in existing_columns:
            op.drop_column('widget_reservations', 'disclosure_consent')
        if "luggage_description" in existing_columns:
            op.drop_column('widget_reservations', 'luggage_description')
        if "luggage_type" in existing_columns:
            op.drop_column('widget_reservations', 'luggage_type')
