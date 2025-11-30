"""Utility helpers for database management."""

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine
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

    if settings.environment.lower() in {"local", "dev"}:
        await _seed_defaults()


async def _seed_defaults() -> None:
    """
    Temporary: disable seeding to avoid startup crashes
    when certain tables (e.g., widget_configs) do not exist.
    """
    return


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
