"""Add custom_domain column to tenants table.

Revision ID: 20251226_custom_domain
Revises: 
Create Date: 2024-12-26

"""
from alembic import op
import sqlalchemy as sa


revision = "20251226_custom_domain"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add custom_domain column."""
    op.add_column(
        "tenants",
        sa.Column("custom_domain", sa.String(255), unique=True, nullable=True, index=True)
    )
    # Create unique index for custom_domain
    op.create_index(
        "ix_tenants_custom_domain",
        "tenants",
        ["custom_domain"],
        unique=True,
        postgresql_where=sa.text("custom_domain IS NOT NULL")
    )


def downgrade() -> None:
    """Remove custom_domain column."""
    op.drop_index("ix_tenants_custom_domain", table_name="tenants")
    op.drop_column("tenants", "custom_domain")
