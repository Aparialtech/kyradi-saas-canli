"""Entrypoint for the KYRADİ FastAPI application."""

try:  # pragma: no cover - optional optimization
    import uvloop

    uvloop.install()
except Exception:  # noqa: BLE001 - uvloop is optional
    uvloop = None

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import api_router
from .core.config import settings
from .core.exceptions import global_exception_handler
from .db.utils import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("kyradi")

# Configure database error logger with more detail
db_error_logger = logging.getLogger("kyradi.db_errors")
db_error_logger.setLevel(logging.ERROR)
db_session_logger = logging.getLogger("kyradi.db_session")
db_session_logger.setLevel(logging.WARNING)

app = FastAPI(
    title="KYRADİ API",
    version="0.1.0",
    description="FastAPI backend for the KYRADİ SaaS platform.",
)

# =============================================================================
# CORS Configuration
# =============================================================================
# When credentials: "include" is used in frontend fetch requests,
# Access-Control-Allow-Origin CANNOT be "*". It must be the specific origin.

# Get allowed origins from settings (which includes defaults from config.py)
allowed_origins = list(settings.cors_origins)

# Add Vercel preview deployment pattern support
def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed, including Vercel preview deployments."""
    if not origin:
        return False
    # Check exact match
    if origin in allowed_origins:
        return True
    # Check Vercel preview deployments pattern
    if "vercel.app" in origin and ("kyradi" in origin.lower() or "aparialtechs" in origin.lower()):
        return True
    return False

# Build final allowed origins list - include all Vercel patterns
final_origins = allowed_origins.copy()

logger.info("Starting Kyradi backend...")
logger.info(f"CORS allowed origins: {final_origins}")

# Add CORS middleware BEFORE including routers
# This ensures ALL routes (including /auth/*) get CORS headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=final_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
    # Allow origin callback for dynamic Vercel preview URLs
    allow_origin_regex=r"https://kyradi.*\.vercel\.app|https://.*aparialtechs.*\.vercel\.app",
)

app.include_router(api_router)

# Add global exception handler
app.add_exception_handler(Exception, global_exception_handler)


@app.on_event("startup")
async def startup_event() -> None:
    """Auto-create database tables and log AI status."""
    
    # Always run critical schema migrations in all environments
    await ensure_critical_schema()
    
    # Full init_db (create tables + seeding) only in local/dev
    if settings.environment.lower() in {"local", "dev"}:
        await init_db()
    
    # Log AI configuration status
    # OpenAI API key'i değiştirmek için Railway'de OPENAI_API_KEY env değişkenini güncellemeniz yeterlidir.
    # Kod içinde hiçbir yerde key hard-coded değildir.
    if settings.openai_api_key:
        logger.info(f"AI service configured: model={settings.ai_model}, org_id={settings.openai_org_id or 'none'}")
    else:
        logger.warning("AI service NOT configured: OPENAI_API_KEY missing. AI chat will use fallback provider.")


async def ensure_critical_schema() -> None:
    """Ensure critical schema columns exist in all environments.
    
    This runs DDL statements that are necessary for the application to function.
    Uses IF NOT EXISTS clauses so it's safe to run multiple times.
    """
    from sqlalchemy import text
    from .db.session import engine
    
    critical_ddl = [
        # Storage columns
        "ALTER TABLE storages ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1",
        # Tenant columns
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255)",
        # User columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)",
        # Location columns
        "ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32)",
        "ALTER TABLE locations ADD COLUMN IF NOT EXISTS working_hours JSONB",
        # Pricing rules hierarchical columns
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'TENANT'",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS location_id VARCHAR(36)",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS storage_id VARCHAR(36)",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
    ]
    
    try:
        async with engine.begin() as conn:
            for statement in critical_ddl:
                try:
                    await conn.execute(text(statement))
                    logger.info(f"Critical schema check OK: {statement[:50]}...")
                except Exception as exc:
                    # Log but don't fail - table might not exist yet or column already exists
                    logger.debug(f"Schema DDL skipped: {statement[:50]}... - {exc}")
    except Exception as exc:
        logger.warning(f"Could not apply critical schema migrations: {exc}")


# Health checks are provided via api_router (/health)
