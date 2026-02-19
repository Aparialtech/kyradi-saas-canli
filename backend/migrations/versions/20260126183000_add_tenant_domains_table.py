"""Add tenant_domains table for multi-domain support.

Revision ID: 20260126183000
Revises: 20260115125737
Create Date: 2026-01-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260126183000"
down_revision: Union[str, None] = "20260115125737"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create tenant_domains table and indexes (idempotent)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "tenant_domains" not in existing_tables:
        op.create_table(
            "tenant_domains",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column("tenant_id", sa.String(36), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
            sa.Column("domain", sa.Text(), nullable=False),
            sa.Column("domain_type", sa.String(length=32), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
            sa.Column("verification_method", sa.String(length=16), nullable=False, server_default="DNS_TXT"),
            sa.Column("verification_token", sa.String(length=128), nullable=True),
            sa.Column("verification_record_name", sa.String(length=255), nullable=True),
            sa.Column("verification_record_value", sa.String(length=255), nullable=True),
            sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failure_reason", sa.Text(), nullable=True),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("tenant_domains")} if "tenant_domains" in existing_tables else set()

    if "ix_tenant_domains_domain" not in existing_indexes:
        op.create_index("ix_tenant_domains_domain", "tenant_domains", ["domain"], unique=True)
    if "ix_tenant_domains_tenant_id" not in existing_indexes:
        op.create_index("ix_tenant_domains_tenant_id", "tenant_domains", ["tenant_id"])
    if "ix_tenant_domains_primary_per_tenant" not in existing_indexes:
        op.create_index(
            "ix_tenant_domains_primary_per_tenant",
            "tenant_domains",
            ["tenant_id"],
            unique=True,
            postgresql_where=sa.text("is_primary = true"),
        )


def downgrade() -> None:
    """Drop tenant_domains table and indexes (idempotent)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    if "tenant_domains" not in existing_tables:
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("tenant_domains")}
    if "ix_tenant_domains_primary_per_tenant" in existing_indexes:
        op.drop_index("ix_tenant_domains_primary_per_tenant", table_name="tenant_domains")
    if "ix_tenant_domains_tenant_id" in existing_indexes:
        op.drop_index("ix_tenant_domains_tenant_id", table_name="tenant_domains")
    if "ix_tenant_domains_domain" in existing_indexes:
        op.drop_index("ix_tenant_domains_domain", table_name="tenant_domains")
    op.drop_table("tenant_domains")
