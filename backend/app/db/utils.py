"""Utility helpers for database management."""

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.exc import ProgrammingError

from ..core.config import settings
from ..core.security import get_password_hash
from ..models import Tenant, User, UserRole
from app.reservations.models import WidgetConfig
from .base import Base
from .session import AsyncSessionMaker, engine

logger = logging.getLogger(__name__)

async def init_db(db_engine: AsyncEngine | None = None) -> None:
    """Create all tables (useful for local development)."""
    engine_to_use = db_engine or engine
    async with engine_to_use.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_local_ddl(conn)
        await _ensure_ai_documents_table(conn)
        await _ensure_widget_tables(conn)

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


async def _seed_demo_tenant_and_users(session: AsyncSession) -> None:
    """Ensure demo tenant and default users exist."""
    # Ensure tenant exists
    tenant_stmt = select(Tenant).where(Tenant.slug == "demo-hotel")
    tenant = (await session.execute(tenant_stmt)).scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(
            slug="demo-hotel",
            name="Demo Hotel",
            plan="standard",
            is_active=True,
        )
        session.add(tenant)
        await session.flush()
        logger.info("Created demo tenant with slug 'demo-hotel'")
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

    # Ensure demo widget config exists (best effort)
    try:
        exists_row = await session.execute(text("SELECT to_regclass('public.widget_configs')"))
        if exists_row.scalar():
            cfg_stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id)
            cfg = (await session.execute(cfg_stmt)).scalar_one_or_none()
            if cfg is None:
                cfg = WidgetConfig(
                    tenant_id=tenant.id,
                    widget_public_key="demo_public",
                    widget_secret="demo_secret",
                    allowed_origins=["*"],
                    locale="tr-TR",
                    theme="light",
                    kvkk_text="",
                    form_defaults={},
                    notification_preferences={},
                    webhook_url="",
                )
                session.add(cfg)
                logger.info("Created demo widget config for tenant demo-hotel")
            else:
                logger.info("Demo widget config already exists, skipping creation")
        else:
            logger.warning("widget_configs table missing; skipping demo widget config seeding")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to seed demo widget config (ignored): %s", exc, exc_info=True)
