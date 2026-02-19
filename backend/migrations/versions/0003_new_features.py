"""Add password reset tokens, settlements, staff tables and rename lockers to storages."""

from alembic import op
import sqlalchemy as sa


revision = "0003_new_features"
down_revision = "0002_tenant_plan_limits"
branch_labels = None
depends_on = None


def _utc_now():
    return sa.text("timezone('utc', now())")


def upgrade() -> None:
    # Check if lockers table exists, if not check if storages exists
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Rename lockers table to storages (if lockers exists and storages doesn't)
    if "lockers" in existing_tables and "storages" not in existing_tables:
        op.rename_table("lockers", "storages")
    elif "storages" in existing_tables:
        # Already renamed, skip
        pass
    else:
        # Neither exists, this shouldn't happen but handle gracefully
        raise ValueError("Neither 'lockers' nor 'storages' table exists")
    
    # Update foreign key references (only if locker_id column exists)
    if "reservations" in existing_tables:
        existing_columns = [col["name"] for col in inspector.get_columns("reservations")]
        if "locker_id" in existing_columns and "storage_id" not in existing_columns:
            # Drop foreign key constraint
            try:
                op.drop_constraint("reservations_locker_id_fkey", "reservations", type_="foreignkey")
            except Exception:
                pass  # Constraint might not exist
            
            # Rename column using SQL (Alembic doesn't have rename_column)
            op.execute(sa.text('ALTER TABLE reservations RENAME COLUMN locker_id TO storage_id'))
            
            # Create new foreign key
            op.create_foreign_key(
                "reservations_storage_id_fkey",
                "reservations",
                "storages",
                ["storage_id"],
                ["id"],
                ondelete="CASCADE",
            )
            
            # Update index
            try:
                op.drop_index("ix_reservations_locker_id", "reservations")
            except Exception:
                pass  # Index might not exist
            op.create_index("ix_reservations_storage_id", "reservations", ["storage_id"])
    
    # Create password_reset_tokens table (if not exists)
    if "password_reset_tokens" not in existing_tables:
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("token", sa.String(length=255), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token"),
        )
        op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
        op.create_index("ix_password_reset_tokens_token", "password_reset_tokens", ["token"])
        op.create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"])
        op.create_index("ix_password_reset_tokens_is_used", "password_reset_tokens", ["is_used"])
    
    # Create settlements table (if not exists)
    if "settlements" not in existing_tables:
        op.create_table(
            "settlements",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("tenant_id", sa.String(length=36), nullable=False),
            sa.Column("payment_id", sa.String(length=36), nullable=False),
            sa.Column("reservation_id", sa.String(length=36), nullable=False),
            sa.Column("total_amount_minor", sa.Integer(), nullable=False),
            sa.Column("tenant_settlement_minor", sa.Integer(), nullable=False),
            sa.Column("kyradi_commission_minor", sa.Integer(), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="TRY"),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("commission_rate", sa.Float(), nullable=False, server_default="5.0"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["reservation_id"], ["reservations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("payment_id"),
        )
        op.create_index("ix_settlements_tenant_id", "settlements", ["tenant_id"])
        op.create_index("ix_settlements_payment_id", "settlements", ["payment_id"])
        op.create_index("ix_settlements_reservation_id", "settlements", ["reservation_id"])
        op.create_index("ix_settlements_status", "settlements", ["status"])
    
    # Create staff table (if not exists)
    if "staff" not in existing_tables:
        op.create_table(
            "staff",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("tenant_id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("assigned_location_ids", sa.String(length=512), nullable=True),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
        )
        op.create_index("ix_staff_tenant_id", "staff", ["tenant_id"])
        op.create_index("ix_staff_user_id", "staff", ["user_id"])
    
    # Create staff_storage_assignments association table (if not exists)
    if "staff_storage_assignments" not in existing_tables:
        op.create_table(
            "staff_storage_assignments",
            sa.Column("staff_id", sa.String(length=36), nullable=False),
            sa.Column("storage_id", sa.String(length=36), nullable=False),
            sa.ForeignKeyConstraint(["staff_id"], ["staff.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["storage_id"], ["storages.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("staff_id", "storage_id"),
        )
    
    # Add max_storages to tenant_plan_limits (for backward compatibility, keep max_lockers)
    if "tenant_plan_limits" in existing_tables:
        existing_plan_columns = [col["name"] for col in inspector.get_columns("tenant_plan_limits")]
        if "max_storages" not in existing_plan_columns:
            op.add_column("tenant_plan_limits", sa.Column("max_storages", sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove max_storages column
    op.drop_column("tenant_plan_limits", "max_storages")
    
    # Drop staff_storage_assignments table
    op.drop_table("staff_storage_assignments")
    
    # Drop staff table
    op.drop_index("ix_staff_user_id", "staff")
    op.drop_index("ix_staff_tenant_id", "staff")
    op.drop_table("staff")
    
    # Drop settlements table
    op.drop_index("ix_settlements_status", "settlements")
    op.drop_index("ix_settlements_reservation_id", "settlements")
    op.drop_index("ix_settlements_payment_id", "settlements")
    op.drop_index("ix_settlements_tenant_id", "settlements")
    op.drop_table("settlements")
    
    # Drop password_reset_tokens table
    op.drop_index("ix_password_reset_tokens_is_used", "password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_expires_at", "password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_token", "password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", "password_reset_tokens")
    op.drop_table("password_reset_tokens")
    
    # Revert storage_id back to locker_id
    op.drop_constraint("reservations_storage_id_fkey", "reservations", type_="foreignkey")
    op.drop_index("ix_reservations_storage_id", "reservations")
    op.execute(sa.text('ALTER TABLE reservations RENAME COLUMN storage_id TO locker_id'))
    op.create_foreign_key(
        "reservations_locker_id_fkey",
        "reservations",
        "storages",
        ["locker_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_reservations_locker_id", "reservations", ["locker_id"])
    
    # Rename storages table back to lockers
    op.rename_table("storages", "lockers")

