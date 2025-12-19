"""add_tickets_table

Revision ID: 20251219_tickets
Revises: 
Create Date: 2025-12-19

Note: This migration adds the tickets table for the internal messaging system.
You may need to adjust the 'down_revision' to match your latest migration.
"""
from alembic import op
import sqlalchemy as sa


revision = '20251219_tickets'
down_revision = '6343c0184364'  # Latest migration: add_password_encrypted_to_users
branch_labels = None
depends_on = None


def _utc_now():
    return sa.text("timezone('utc', now())")


def upgrade() -> None:
    # Check if table already exists
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    if "tickets" not in existing_tables:
        op.create_table(
            "tickets",
            # Primary key
            sa.Column("id", sa.String(length=36), nullable=False),
            
            # Timestamps
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, onupdate=_utc_now()),
            
            # Main fields
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="medium"),
            sa.Column("target", sa.String(length=20), nullable=False, server_default="admin"),
            
            # Creator info
            sa.Column("creator_id", sa.String(length=36), nullable=False),
            sa.Column("tenant_id", sa.String(length=36), nullable=True),
            
            # Resolution info
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("resolved_by_id", sa.String(length=36), nullable=True),
            sa.Column("resolution_note", sa.Text(), nullable=True),
            
            # Read tracking
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_by_id", sa.String(length=36), nullable=True),
            
            # Foreign keys
            sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["read_by_id"], ["users.id"], ondelete="SET NULL"),
            
            # Primary key
            sa.PrimaryKeyConstraint("id"),
        )
        
        # Create indexes for better query performance
        op.create_index("ix_tickets_creator_id", "tickets", ["creator_id"])
        op.create_index("ix_tickets_tenant_id", "tickets", ["tenant_id"])
        op.create_index("ix_tickets_status", "tickets", ["status"])
        op.create_index("ix_tickets_created_at", "tickets", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_tickets_created_at", table_name="tickets")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_tenant_id", table_name="tickets")
    op.drop_index("ix_tickets_creator_id", table_name="tickets")
    op.drop_table("tickets")
