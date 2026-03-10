"""Add tenant_domains table for multi-domain support.

Revision ID: 20260126180000
Revises: 20260115125737
Create Date: 2026-01-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260126180000"
down_revision: Union[str, None] = "20260115125737"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create tenant_domains table and indexes."""
    op.create_table(
        "tenant_domains",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("domain", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("verification_token", sa.String(length=128), nullable=True),
        sa.Column("verification_method", sa.String(length=16), nullable=False, server_default="TXT"),
        sa.Column("expected_dns_record", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_tenant_domains_domain", "tenant_domains", ["domain"], unique=True)
    op.create_index("ix_tenant_domains_tenant_id", "tenant_domains", ["tenant_id"])
    op.create_index(
        "ix_tenant_domains_primary_per_tenant",
        "tenant_domains",
        ["tenant_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )


def downgrade() -> None:
    """Drop tenant_domains table and indexes."""
    op.drop_index("ix_tenant_domains_primary_per_tenant", table_name="tenant_domains")
    op.drop_index("ix_tenant_domains_tenant_id", table_name="tenant_domains")
    op.drop_index("ix_tenant_domains_domain", table_name="tenant_domains")
    op.drop_table("tenant_domains")
