"""Add customer fields to reservations

Revision ID: add_reservation_customer_fields
Revises: 
Create Date: 2025-11-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.exc import ProgrammingError

# revision identifiers, used by Alembic.
revision = 'add_reservation_customer_fields'
down_revision = 'a1b2c3d4e5f6'  # password_reset_improvements_and_phone_verification
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('reservations'):
        try:
            op.add_column('reservations', sa.Column('full_name', sa.String(255), nullable=True))
            op.add_column('reservations', sa.Column('phone_number', sa.String(32), nullable=True))
            op.add_column('reservations', sa.Column('customer_email', sa.String(255), nullable=True))
            op.add_column('reservations', sa.Column('tc_identity_number', sa.String(11), nullable=True, comment='TC Kimlik No - Sensitive data, mask in logs'))
            op.add_column('reservations', sa.Column('passport_number', sa.String(20), nullable=True))
            op.add_column('reservations', sa.Column('hotel_room_number', sa.String(20), nullable=True))
            op.add_column('reservations', sa.Column('kvkk_consent', sa.Boolean(), nullable=False, server_default='false'))
            op.add_column('reservations', sa.Column('terms_consent', sa.Boolean(), nullable=False, server_default='false'))
        except ProgrammingError:
            pass

    if inspector.has_table('widget_reservations'):
        try:
            op.add_column('widget_reservations', sa.Column('full_name', sa.String(255), nullable=True))
            op.add_column('widget_reservations', sa.Column('phone_number', sa.String(64), nullable=True))
            op.add_column('widget_reservations', sa.Column('tc_identity_number', sa.String(11), nullable=True, comment='TC Kimlik No - Sensitive data, mask in logs'))
            op.add_column('widget_reservations', sa.Column('passport_number', sa.String(20), nullable=True))
            op.add_column('widget_reservations', sa.Column('hotel_room_number', sa.String(20), nullable=True))
            op.add_column('widget_reservations', sa.Column('luggage_count', sa.Integer(), nullable=True))
            op.add_column('widget_reservations', sa.Column('kvkk_consent', sa.Boolean(), nullable=False, server_default='false'))
            op.add_column('widget_reservations', sa.Column('terms_consent', sa.Boolean(), nullable=False, server_default='false'))
        except ProgrammingError:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('widget_reservations'):
        try:
            op.drop_column('widget_reservations', 'terms_consent')
            op.drop_column('widget_reservations', 'kvkk_consent')
            op.drop_column('widget_reservations', 'luggage_count')
            op.drop_column('widget_reservations', 'hotel_room_number')
            op.drop_column('widget_reservations', 'passport_number')
            op.drop_column('widget_reservations', 'tc_identity_number')
            op.drop_column('widget_reservations', 'phone_number')
            op.drop_column('widget_reservations', 'full_name')
        except ProgrammingError:
            pass

    if inspector.has_table('reservations'):
        try:
            op.drop_column('reservations', 'terms_consent')
            op.drop_column('reservations', 'kvkk_consent')
            op.drop_column('reservations', 'hotel_room_number')
            op.drop_column('reservations', 'passport_number')
            op.drop_column('reservations', 'tc_identity_number')
            op.drop_column('reservations', 'customer_email')
            op.drop_column('reservations', 'phone_number')
            op.drop_column('reservations', 'full_name')
        except ProgrammingError:
            pass
