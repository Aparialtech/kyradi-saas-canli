"""Add domain_status column to tenants table.

Revision ID: 20251219_domain_status
Revises: 20251226_add_custom_domain_to_tenants
Create Date: 2024-12-19

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251219_domain_status"
down_revision = "20251226_add_custom_domain_to_tenants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add domain_status column for custom domain verification tracking."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("tenants")}
    if "domain_status" not in columns:
        op.add_column(
            "tenants",
            sa.Column(
                "domain_status",
                sa.String(20),
                nullable=False,
                server_default="unverified",
                comment="Custom domain verification status: unverified, pending, verified, failed"
            )
        )


def downgrade() -> None:
    """Remove domain_status column."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("tenants")}
    if "domain_status" in columns:
        op.drop_column("tenants", "domain_status")
