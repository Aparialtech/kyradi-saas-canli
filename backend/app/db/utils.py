"""Utility helpers for database management.

IMPORTANT: This module must NOT import app.reservations.models at the top level
to avoid circular imports. Use lazy imports inside functions instead.
"""

import logging
from typing import TYPE_CHECKING

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.exc import ProgrammingError

from ..core.config import settings
from ..core.security import get_password_hash
from ..models import Tenant, User, UserRole
from .base import Base
from .session import AsyncSessionMaker, engine

# Type hints only - no runtime import
if TYPE_CHECKING:
    from app.reservations.models import WidgetConfig, WidgetReservation

logger = logging.getLogger(__name__)


async def init_db(db_engine: AsyncEngine | None = None) -> None:
    """Create all tables (useful for local development)."""
    engine_to_use = db_engine or engine
    async with engine_to_use.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_critical_ddl(conn)  # Always run critical schema changes
        await _apply_local_ddl(conn)
        await _ensure_ai_documents_table(conn)
        await _ensure_widget_tables(conn)

    try:
        await ensure_widget_tables_exist()
    except Exception as exc:  # noqa: BLE001
        logger.error("init_db: failed to ensure widget tables: %s", exc)

    # Apply widget-specific DDL AFTER widget tables are created
    async with engine_to_use.begin() as conn:
        await _apply_widget_ddl(conn)

    await _seed_defaults()


async def _seed_defaults() -> None:
    """Seed demo tenant and default admin users (idempotent and safe)."""
    async with AsyncSessionMaker() as session:
        try:
            await _seed_demo_tenant_and_users(session)
            await session.commit()
        except ProgrammingError as e:
            await session.rollback()
            err_text = str(getattr(e, "orig", "")) or str(e)
            if "UndefinedTable" in err_text or "does not exist" in err_text:
                logger.warning(
                    "Skipping seeding because required tables do not exist yet: %s",
                    err_text,
                )
                return
            raise
        except Exception as exc:  # noqa: BLE001
            await session.rollback()
            logger.warning("Seeding failed (ignored): %s", exc, exc_info=True)


async def _apply_local_ddl(conn) -> None:
    """Best-effort column migrations for local development."""
    if settings.environment.lower() not in {"local", "dev"}:
        return

    statements = [
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS baggage_count INTEGER DEFAULT 1",
        "ALTER TABLE reservations ALTER COLUMN baggage_count SET NOT NULL",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS baggage_type VARCHAR(64)",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS weight_kg DOUBLE PRECISION",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS evidence_url VARCHAR(512)",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS handover_by VARCHAR(255)",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS handover_at TIMESTAMPTZ",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS returned_by VARCHAR(255)",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ",
    ]

    for statement in statements:
        try:
            await conn.execute(text(statement))
        except Exception:  # noqa: BLE001
            # best effort; ignore errors (e.g. SQLite incompatibilities)
            pass


async def _apply_critical_ddl(conn) -> None:
    """Apply critical schema migrations that should run in all environments.
    
    These are schema changes needed for the application to function correctly.
    Uses IF NOT EXISTS to be idempotent and safe to run multiple times.
    """
    statements = [
        # Storage capacity column (required by Storage model)
        "ALTER TABLE storages ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1",
        # Ensure tenant metadata column exists
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB",
        # Tenant legal_name column (for invoices and legal documents)
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255)",
        # User columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_encrypted VARCHAR(500)",
        # Pricing rules hierarchical columns
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'TENANT'",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS location_id VARCHAR(36)",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS storage_id VARCHAR(36)",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
    ]

    for statement in statements:
        try:
            await conn.execute(text(statement))
            logger.info(f"Applied critical DDL: {statement}")
        except Exception as exc:  # noqa: BLE001
            # Log but don't fail - column might already exist or table might not exist yet
            logger.warning(f"DDL statement skipped: {statement[:60]}... - {exc}")


async def _apply_widget_ddl(conn) -> None:
    """Apply widget_reservations schema migrations after widget tables exist.
    
    This runs AFTER ensure_widget_tables_exist() to ensure the table exists.
    """
    statements = [
        # Widget reservations pricing fields (required for widget submissions)
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS amount_minor INTEGER",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS pricing_rule_id VARCHAR(36)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(32)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'TRY'",
        # Widget reservations additional fields
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS tc_identity_number VARCHAR(11)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS passport_number VARCHAR(32)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS hotel_room_number VARCHAR(32)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS luggage_count INTEGER",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS luggage_type VARCHAR(32)",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS luggage_description TEXT",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS kvkk_consent BOOLEAN DEFAULT FALSE",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS terms_consent BOOLEAN DEFAULT FALSE",
        "ALTER TABLE widget_reservations ADD COLUMN IF NOT EXISTS disclosure_consent BOOLEAN DEFAULT FALSE",
    ]

    for statement in statements:
        try:
            await conn.execute(text(statement))
            logger.info(f"Applied widget DDL: {statement}")
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Widget DDL skipped: {statement[:60]}... - {exc}")


async def _ensure_ai_documents_table(conn) -> None:
    """Create AI-specific storage structures if missing."""
    statements = [
        "CREATE EXTENSION IF NOT EXISTS vector",
        """
        CREATE TABLE IF NOT EXISTS ai_documents (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            doc_id TEXT NOT NULL,
            title TEXT,
            content TEXT NOT NULL,
            embedding VECTOR(3072),
            meta JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE (tenant_id, doc_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_ai_documents_tenant ON ai_documents (tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_ai_documents_embed ON ai_documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)",
    ]
    for statement in statements:
        try:
            await conn.execute(text(statement))
        except Exception:  # noqa: BLE001
            logger.debug("Skipping AI DDL statement: %s", statement.strip().splitlines()[0])


async def _ensure_widget_tables(conn) -> None:
    """Create widget configuration tables if missing."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS widget_configs (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            widget_public_key TEXT NOT NULL,
            widget_secret TEXT NOT NULL,
            allowed_origins TEXT[] NOT NULL,
            locale TEXT DEFAULT 'tr-TR',
            theme TEXT DEFAULT 'light',
            kvkk_text TEXT,
            form_defaults JSONB,
            notification_preferences JSONB,
            webhook_url TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE (tenant_id, widget_public_key)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS widget_reservations (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            config_id BIGINT REFERENCES widget_configs(id) ON DELETE CASCADE,
            external_ref TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            source TEXT NOT NULL DEFAULT 'widget',
            checkin_date DATE,
            checkout_date DATE,
            baggage_count INT,
            locker_size TEXT,
            guest_name TEXT,
            guest_email TEXT,
            guest_phone TEXT,
            notes TEXT,
            kvkk_approved BOOLEAN NOT NULL DEFAULT FALSE,
            origin TEXT,
            user_agent TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            target_url TEXT NOT NULL,
            request_body JSONB NOT NULL,
            signature TEXT,
            status_code INT,
            error TEXT,
            delivered_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_widget_reservations_tenant ON widget_reservations(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_widget_configs_tenant ON widget_configs(tenant_id)",
    ]
    for statement in statements:
        try:
            await conn.execute(text(statement))
        except Exception:  # noqa: BLE001
            logger.debug("Skipping widget DDL statement: %s", statement.strip().splitlines()[0])


async def ensure_widget_tables_exist() -> None:
    """Ensure widget-related tables exist using SQLAlchemy metadata.
    
    LAZY IMPORT: We import the models here to avoid circular imports.
    """
    # Lazy import to avoid circular dependency
    from app.reservations.models import WidgetConfig, WidgetReservation
    
    async with engine.begin() as conn:
        def create_tables(sync_conn) -> None:
            WidgetConfig.__table__.create(bind=sync_conn, checkfirst=True)
            WidgetReservation.__table__.create(bind=sync_conn, checkfirst=True)

        await conn.run_sync(create_tables)
    logger.info("ensure_widget_tables_exist: widget tables ensured")


async def _seed_demo_tenant_and_users(session: AsyncSession) -> None:
    """Ensure demo tenant and default users exist."""
    # Fixed demo tenant ID for consistent frontend access
    DEMO_TENANT_ID = "7d7417b7-17fe-4857-ab14-dd3f390ec497"
    
    # Ensure tenant exists
    tenant_stmt = select(Tenant).where(Tenant.slug == "demo-hotel")
    tenant = (await session.execute(tenant_stmt)).scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(
            id=DEMO_TENANT_ID,
            slug="demo-hotel",
            name="Demo Hotel",
            plan="standard",
            is_active=True,
        )
        session.add(tenant)
        await session.flush()
        logger.info("Created demo tenant with slug 'demo-hotel' and ID '%s'", DEMO_TENANT_ID)
    else:
        logger.info("Demo tenant already exists, skipping creation")

    # Partner admin user for demo tenant
    demo_user_stmt = select(User).where(User.email == "admin@demo.com")
    demo_user = (await session.execute(demo_user_stmt)).scalar_one_or_none()
    if demo_user is None:
        demo_user = User(
            tenant_id=tenant.id,
            email="admin@demo.com",
            password_hash=get_password_hash("Kyradi!2025"),
            role=UserRole.TENANT_ADMIN.value,
            is_active=True,
        )
        session.add(demo_user)
        logger.info("Created demo tenant admin user admin@demo.com")
    else:
        logger.info("Demo tenant admin user already exists, skipping creation")

    # Platform super admin user
    platform_admin_stmt = select(User).where(User.email == "admin@kyradi.com")
    platform_admin = (await session.execute(platform_admin_stmt)).scalar_one_or_none()
    if platform_admin is None:
        platform_admin = User(
            tenant_id=None,
            email="admin@kyradi.com",
            password_hash=get_password_hash("Kyradi!2025"),
            role=UserRole.SUPER_ADMIN.value,
            is_active=True,
        )
        session.add(platform_admin)
        logger.info("Created platform super admin user admin@kyradi.com")
    else:
        logger.info("Platform super admin user already exists, skipping creation")

    await _seed_demo_widget_config(session, tenant.id)
    await _seed_demo_location_and_storage(session, tenant.id)


async def _seed_demo_widget_config(session: AsyncSession, demo_tenant_id: str) -> None:
    """Seed demo widget config if missing.
    
    LAZY IMPORT: We import the model here to avoid circular imports.
    Uses scalars().first() to handle multiple existing configs gracefully.
    """
    # Lazy import to avoid circular dependency
    from app.reservations.models import WidgetConfig
    
    try:
        cfg_stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == demo_tenant_id).order_by(WidgetConfig.created_at)
        cfg_result = await session.execute(cfg_stmt)
        cfg = cfg_result.scalars().first()
        if cfg is None:
            cfg = WidgetConfig(
                tenant_id=demo_tenant_id,
                widget_public_key="demo-public-key",
                widget_secret="demo-secret",
                allowed_origins=[
                    "https://kyradi-saas-canli.vercel.app",
                    "https://kyradi-saas-canli-cqly0ovkl-aparialtechs-projects.vercel.app",
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ],
                locale="tr-TR",
                theme="light",
                kvkk_text="",
                form_defaults={},
                notification_preferences={},
                webhook_url="",
            )
            session.add(cfg)
            await session.flush()
            logger.info("Created demo widget config for tenant %s", demo_tenant_id)
        else:
            logger.info("Demo widget config already exists for tenant %s, skipping", demo_tenant_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to seed demo widget config (ignored): %s", exc, exc_info=True)


async def _seed_demo_location_and_storage(session: AsyncSession, demo_tenant_id: str) -> None:
    """Seed demo location and storage if missing (required for availability).
    
    Uses raw SQL for checking existing records to avoid column mismatch issues
    when the database schema is out of sync with the model.
    """
    from ..models import Location, Storage, StorageStatus
    
    DEMO_LOCATION_ID = "loc-demo-0001-0001-000000000001"
    DEMO_STORAGE_ID = "str-demo-0001-0001-000000000001"
    
    try:
        # Check if demo location exists using raw SQL to avoid column issues
        loc_check = await session.execute(
            text("SELECT id FROM locations WHERE tenant_id = :tenant_id LIMIT 1"),
            {"tenant_id": demo_tenant_id}
        )
        existing_loc = loc_check.fetchone()
        
        if existing_loc is None:
            loc = Location(
                id=DEMO_LOCATION_ID,
                tenant_id=demo_tenant_id,
                name="Demo Lobi",
                address="Demo Hotel, Taksim, Istanbul",
                latitude=41.0082,
                longitude=28.9784,
                opening_hour=0,
                closing_hour=24,
                timezone="Europe/Istanbul",
            )
            session.add(loc)
            await session.flush()
            logger.info("Created demo location for tenant %s", demo_tenant_id)
            location_id = DEMO_LOCATION_ID
        else:
            location_id = existing_loc[0]
            logger.info("Demo location already exists for tenant %s, using existing ID %s", demo_tenant_id, location_id)
        
        # Check if demo storage exists using raw SQL to avoid column issues
        storage_check = await session.execute(
            text("SELECT id FROM storages WHERE tenant_id = :tenant_id LIMIT 1"),
            {"tenant_id": demo_tenant_id}
        )
        existing_storage = storage_check.fetchone()
        
        if existing_storage is None:
            # Use raw SQL INSERT to avoid ORM column validation issues
            await session.execute(
                text("""
                    INSERT INTO storages (id, tenant_id, location_id, code, status, created_at)
                    VALUES (:id, :tenant_id, :location_id, :code, :status, NOW())
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": DEMO_STORAGE_ID,
                    "tenant_id": demo_tenant_id,
                    "location_id": location_id,
                    "code": "DEMO-001",
                    "status": StorageStatus.IDLE.value,
                }
            )
            await session.flush()
            logger.info("Created demo storage for tenant %s", demo_tenant_id)
        else:
            logger.info("Demo storage already exists for tenant %s, skipping", demo_tenant_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to seed demo location/storage (ignored): %s", exc, exc_info=True)
