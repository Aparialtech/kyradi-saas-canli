"""Add custom_domain column to tenants table.

Revision ID: 20251226_add_custom_domain_to_tenants
Revises: 20251219_users_tenant_idx
Create Date: 2024-12-26

"""
from alembic import op
import sqlalchemy as sa


revision = "20251226_add_custom_domain_to_tenants"
down_revision = "20251219_users_tenant_idx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add custom_domain column."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("tenants")}
    if "custom_domain" not in columns:
        op.add_column(
            "tenants",
            sa.Column("custom_domain", sa.String(255), unique=True, nullable=True, index=True)
        )
    # Create unique index for custom_domain
    indexes = {idx["name"] for idx in inspector.get_indexes("tenants")}
    if "ix_tenants_custom_domain" not in indexes:
        op.create_index(
            "ix_tenants_custom_domain",
            "tenants",
            ["custom_domain"],
            unique=True,
            postgresql_where=sa.text("custom_domain IS NOT NULL")
        )


def downgrade() -> None:
    """Remove custom_domain column."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("tenants")}
    if "ix_tenants_custom_domain" in indexes:
        op.drop_index("ix_tenants_custom_domain", table_name="tenants")
    columns = {col["name"] for col in inspector.get_columns("tenants")}
    if "custom_domain" in columns:
        op.drop_column("tenants", "custom_domain")
