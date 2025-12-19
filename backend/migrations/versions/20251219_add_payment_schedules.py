"""Add payment_schedules and payment_transfers tables.

Revision ID: 20251219_payment_sched
Revises: 20251219_verify_code
Create Date: 2024-12-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251219_payment_sched'
down_revision: Union[str, None] = '20251219_verify_code'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _utc_now():
    return sa.text("timezone('utc', now())")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # Create payment_schedules table
    if "payment_schedules" not in existing_tables:
        op.create_table(
            "payment_schedules",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, onupdate=_utc_now()),
            sa.Column("tenant_id", sa.String(length=36), nullable=False),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("period_type", sa.String(length=20), nullable=False, server_default="weekly"),
            sa.Column("custom_days", sa.Integer(), nullable=True),
            sa.Column("min_transfer_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="100.00"),
            sa.Column("commission_rate", sa.Numeric(precision=5, scale=4), nullable=False, server_default="0.0500"),
            sa.Column("bank_name", sa.String(length=100), nullable=True),
            sa.Column("bank_account_holder", sa.String(length=200), nullable=True),
            sa.Column("bank_iban", sa.String(length=34), nullable=True),
            sa.Column("bank_swift", sa.String(length=11), nullable=True),
            sa.Column("next_payment_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_payment_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("partner_can_request", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("admin_notes", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id"),
        )
        op.create_index("ix_payment_schedules_tenant_id", "payment_schedules", ["tenant_id"])

    # Create payment_transfers table
    if "payment_transfers" not in existing_tables:
        op.create_table(
            "payment_transfers",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, onupdate=_utc_now()),
            sa.Column("tenant_id", sa.String(length=36), nullable=False),
            sa.Column("schedule_id", sa.String(length=36), nullable=True),
            sa.Column("gross_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("commission_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
            sa.Column("net_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("transfer_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reference_id", sa.String(length=100), nullable=True),
            sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
            sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
            sa.Column("bank_name", sa.String(length=100), nullable=True),
            sa.Column("bank_account_holder", sa.String(length=200), nullable=True),
            sa.Column("bank_iban", sa.String(length=34), nullable=True),
            sa.Column("processed_by_id", sa.String(length=36), nullable=True),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("is_manual_request", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("requested_by_id", sa.String(length=36), nullable=True),
            sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["schedule_id"], ["payment_schedules.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["processed_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_payment_transfers_tenant_id", "payment_transfers", ["tenant_id"])
        op.create_index("ix_payment_transfers_schedule_id", "payment_transfers", ["schedule_id"])
        op.create_index("ix_payment_transfers_status", "payment_transfers", ["status"])
        op.create_index("ix_payment_transfers_created_at", "payment_transfers", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_payment_transfers_created_at", table_name="payment_transfers")
    op.drop_index("ix_payment_transfers_status", table_name="payment_transfers")
    op.drop_index("ix_payment_transfers_schedule_id", table_name="payment_transfers")
    op.drop_index("ix_payment_transfers_tenant_id", table_name="payment_transfers")
    op.drop_table("payment_transfers")
    
    op.drop_index("ix_payment_schedules_tenant_id", table_name="payment_schedules")
    op.drop_table("payment_schedules")
