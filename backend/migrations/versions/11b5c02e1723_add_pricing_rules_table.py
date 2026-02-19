"""add_pricing_rules_table

Revision ID: 11b5c02e1723
Revises: c20eed016def
Create Date: 2025-11-26 15:05:32.369829
"""
from alembic import op
import sqlalchemy as sa



revision = '11b5c02e1723'
down_revision = 'c20eed016def'
branch_labels = None
depends_on = None


def _utc_now():
    return sa.text("timezone('utc', now())")


def upgrade() -> None:
    # Check if table already exists
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    if "pricing_rules" not in existing_tables:
        op.create_table(
            "pricing_rules",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("tenant_id", sa.String(length=36), nullable=True),
            sa.Column("pricing_type", sa.String(length=16), nullable=False, server_default="daily"),
            sa.Column("price_per_hour_minor", sa.Integer(), nullable=False, server_default="1500"),
            sa.Column("price_per_day_minor", sa.Integer(), nullable=False, server_default="15000"),
            sa.Column("price_per_week_minor", sa.Integer(), nullable=False, server_default="90000"),
            sa.Column("price_per_month_minor", sa.Integer(), nullable=False, server_default="300000"),
            sa.Column("minimum_charge_minor", sa.Integer(), nullable=False, server_default="1500"),
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="TRY"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("notes", sa.String(length=500), nullable=True),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_pricing_rules_tenant_id", "pricing_rules", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_pricing_rules_tenant_id", table_name="pricing_rules")
    op.drop_table("pricing_rules")
