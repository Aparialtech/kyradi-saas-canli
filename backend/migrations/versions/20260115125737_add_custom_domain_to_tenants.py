"""Add custom_domain to tenants table for multi-tenant subdomain/domain support.

Revision ID: 20260115125737
Revises: 20251219_domain_status
Create Date: 2026-01-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260115125737'
down_revision: Union[str, None] = '20251219_domain_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add custom_domain column to tenants table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("tenants")}
    if "custom_domain" not in columns:
        op.add_column(
            "tenants",
            sa.Column("custom_domain", sa.String(255), nullable=True, unique=True),
        )

    indexes = {idx["name"] for idx in inspector.get_indexes("tenants")}
    if "ix_tenants_custom_domain" not in indexes:
        op.create_index(
            "ix_tenants_custom_domain",
            "tenants",
            ["custom_domain"],
            unique=True,
            postgresql_where=sa.text("custom_domain IS NOT NULL"),
        )


def downgrade() -> None:
    """Remove custom_domain column from tenants table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("tenants")}
    if "ix_tenants_custom_domain" in indexes:
        op.drop_index("ix_tenants_custom_domain", table_name="tenants")

    columns = {col["name"] for col in inspector.get_columns("tenants")}
    if "custom_domain" in columns:
        op.drop_column("tenants", "custom_domain")
