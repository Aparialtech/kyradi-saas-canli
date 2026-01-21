"""Add composite index for users pagination performance.

Revision ID: 20251219_users_tenant_idx
Revises: 20251219_domain_status
Create Date: 2024-12-19

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "20251219_users_tenant_idx"
down_revision = "20251219_domain_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add composite indexes for efficient user list pagination."""
    # Index for tenant user listing with sorting
    op.create_index(
        "ix_users_tenant_created",
        "users",
        ["tenant_id", "created_at"],
        postgresql_using="btree"
    )
    
    # Index for email search within tenant
    op.create_index(
        "ix_users_tenant_email",
        "users",
        ["tenant_id", "email"],
        postgresql_using="btree"
    )


def downgrade() -> None:
    """Remove indexes."""
    op.drop_index("ix_users_tenant_email", table_name="users")
    op.drop_index("ix_users_tenant_created", table_name="users")
