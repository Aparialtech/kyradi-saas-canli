"""Add tenant_plan_limits table."""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "0002_tenant_plan_limits"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


CUSTOM_PLAN_SUFFIX = "::custom"


def _utc_now():
    return sa.text("timezone('utc', now())")


PLAN_FIELDS = (
    "max_locations",
    "max_lockers",
    "max_active_reservations",
    "max_users",
    "max_self_service_daily",
    "max_reservations_total",
    "max_report_exports_daily",
    "max_storage_mb",
)


def upgrade() -> None:
    # Check if table already exists (for idempotency)
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    if "tenant_plan_limits" not in existing_tables:
        op.create_table(
            "tenant_plan_limits",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_utc_now()),
            sa.Column("tenant_id", sa.String(length=36), nullable=False),
            sa.Column("max_locations", sa.Integer(), nullable=True),
            sa.Column("max_lockers", sa.Integer(), nullable=True),
            sa.Column("max_active_reservations", sa.Integer(), nullable=True),
            sa.Column("max_users", sa.Integer(), nullable=True),
            sa.Column("max_self_service_daily", sa.Integer(), nullable=True),
            sa.Column("max_reservations_total", sa.Integer(), nullable=True),
            sa.Column("max_report_exports_daily", sa.Integer(), nullable=True),
            sa.Column("max_storage_mb", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_unique_constraint(
            "uq_tenant_plan_limits_tenant_id",
            "tenant_plan_limits",
            ["tenant_id"],
        )

    bind = op.get_bind()
    tenants = sa.table(
        "tenants",
        sa.column("id", sa.String(length=36)),
        sa.column("plan", sa.String(length=64)),
        sa.column("metadata", sa.JSON()),
    )
    plan_table = sa.table(
        "tenant_plan_limits",
        sa.column("id", sa.String(length=36)),
        sa.column("tenant_id", sa.String(length=36)),
        *(sa.column(field, sa.Integer()) for field in PLAN_FIELDS),
    )

    rows = bind.execute(sa.select(tenants.c.id, tenants.c.plan, tenants.c.metadata)).fetchall()
    to_insert = []
    for tenant_id, plan, metadata in rows:
        metadata = metadata or {}
        plan_limits = metadata.get("plan_limits")
        if plan_limits:
            record = {"id": str(uuid4()), "tenant_id": tenant_id}
            for field in PLAN_FIELDS:
                if field in plan_limits:
                    record[field] = plan_limits[field]
            to_insert.append(record)

        needs_update = False
        updated_plan = plan
        if updated_plan and updated_plan.endswith(CUSTOM_PLAN_SUFFIX):
            updated_plan = updated_plan.replace(CUSTOM_PLAN_SUFFIX, "")
            needs_update = True
        if "plan_limits" in metadata:
            metadata = dict(metadata)
            metadata.pop("plan_limits", None)
            needs_update = True
        if needs_update:
            bind.execute(
                sa.update(tenants)
                .where(tenants.c.id == tenant_id)
                .values(
                    plan=updated_plan,
                    metadata=metadata or None,
                )
            )

    if to_insert:
        op.bulk_insert(plan_table, to_insert)


def downgrade() -> None:
    bind = op.get_bind()
    tenants = sa.table(
        "tenants",
        sa.column("id", sa.String(length=36)),
        sa.column("plan", sa.String(length=64)),
        sa.column("metadata", sa.JSON()),
    )
    plan_table = sa.table(
        "tenant_plan_limits",
        sa.column("tenant_id", sa.String(length=36)),
        *(sa.column(field, sa.Integer()) for field in PLAN_FIELDS),
    )

    plan_rows = bind.execute(sa.select(plan_table)).fetchall()
    for row in plan_rows:
        tenant_id = row.tenant_id
        tenant_row = bind.execute(sa.select(tenants).where(tenants.c.id == tenant_id)).first()
        if not tenant_row:
            continue
        metadata = dict(tenant_row.metadata or {})
        metadata["plan_limits"] = {field: getattr(row, field) for field in PLAN_FIELDS}
        updated_plan = tenant_row.plan or "standard"
        if not updated_plan.endswith(CUSTOM_PLAN_SUFFIX):
            updated_plan = f"{updated_plan}{CUSTOM_PLAN_SUFFIX}"
        bind.execute(
            sa.update(tenants)
            .where(tenants.c.id == tenant_id)
            .values(
                plan=updated_plan,
                metadata=metadata,
            )
        )

    op.drop_constraint("uq_tenant_plan_limits_tenant_id", "tenant_plan_limits", type_="unique")
    op.drop_table("tenant_plan_limits")
