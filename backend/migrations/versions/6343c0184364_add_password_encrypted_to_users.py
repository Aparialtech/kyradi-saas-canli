"""add_password_encrypted_to_users

Revision ID: 6343c0184364
Revises: add_pricing_widget_res
Create Date: 2025-12-18 14:01:00.390559
"""
from alembic import op
import sqlalchemy as sa



revision = '6343c0184364'
down_revision = 'add_pricing_widget_res'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add password_encrypted column for admin password viewing
    # WARNING: This is a security risk - passwords should not be stored in reversible format
    # Check if column already exists before adding
    conn = op.get_bind()
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='users' AND column_name='password_encrypted'
    """))
    if result.fetchone() is None:
        op.add_column('users', sa.Column('password_encrypted', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'password_encrypted')
