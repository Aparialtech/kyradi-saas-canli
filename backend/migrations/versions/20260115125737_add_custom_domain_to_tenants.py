"""Add custom_domain to tenants table for multi-tenant subdomain/domain support.

Revision ID: 20260115125737
Revises: c20eed016def
Create Date: 2026-01-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260115125737'
down_revision: Union[str, None] = 'c20eed016def'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add custom_domain column to tenants table."""
    # Add custom_domain column (nullable, unique)
    op.add_column(
        'tenants',
        sa.Column('custom_domain', sa.String(255), nullable=True, unique=True)
    )
    
    # Create unique index for custom_domain (supports NULL values)
    op.create_index(
        'ix_tenants_custom_domain',
        'tenants',
        ['custom_domain'],
        unique=True,
        postgresql_where=sa.text('custom_domain IS NOT NULL')
    )


def downgrade() -> None:
    """Remove custom_domain column from tenants table."""
    op.drop_index('ix_tenants_custom_domain', table_name='tenants')
    op.drop_column('tenants', 'custom_domain')
