"""Entrypoint for the KYRADİ FastAPI application."""

try:  # pragma: no cover - optional optimization
    import uvloop

    uvloop.install()
except Exception:  # noqa: BLE001 - uvloop is optional
    uvloop = None

import logging
import re

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from .api import api_router
from ai.router import api_router as ai_router
from .core.config import settings
from .core.exceptions import global_exception_handler
from .db.utils import init_db
from .middleware import TenantResolverMiddleware

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

# Static allowed origins
STATIC_ORIGINS = {
    "https://app.kyradi.com",
    "https://admin.kyradi.com",
    "https://branding.kyradi.com",
    "https://kyradi.com",
    "https://www.kyradi.com",
    "https://kyradi-saas-canli.vercel.app",
    "https://kyradi-saas-canli-git-main-aparialtechs-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
}

# Add origins from settings
STATIC_ORIGINS.update(settings.cors_origins)

# Patterns for dynamic Vercel preview deployments
VERCEL_PATTERNS = [
    re.compile(r"https://kyradi.*\.vercel\.app$"),
    re.compile(r"https://.*aparialtechs.*\.vercel\.app$"),
    re.compile(r"https://.*-aparialtechs-projects\.vercel\.app$"),
]

def is_origin_allowed(origin: str) -> bool:
    """Check if origin is allowed (static list or Vercel pattern)."""
    if not origin:
        return False
    normalized = origin.strip().lower()
    if normalized.endswith(".kyradi.com") or normalized.endswith(".kyradi.app"):
        return True
    if normalized in STATIC_ORIGINS:
        return True
    for pattern in VERCEL_PATTERNS:
        if pattern.match(normalized):
            return True
    return False

class DynamicCORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware that supports dynamic Vercel preview URLs."""
    
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        
        # Handle preflight OPTIONS request
        if request.method == "OPTIONS":
            if not origin:
                return Response(status_code=200)
            if is_origin_allowed(origin):
                return Response(
                    status_code=200,
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With, Accept, Origin, X-Tenant-ID",
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Max-Age": "600",
                    },
                )
            else:
                return Response(status_code=403, content="CORS not allowed")
        
        # Process actual request
        response = await call_next(request)
        
        # Add CORS headers to response
        if is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Expose-Headers"] = "*"
        
        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title="KYRADİ API",
        version="0.1.0",
        description="FastAPI backend for the KYRADİ SaaS platform.",
    )
    app.router.redirect_slashes = False

    logger.info("Starting Kyradi backend...")
    logger.info(f"CORS static origins: {STATIC_ORIGINS}")

    # Add custom CORS middleware BEFORE including routers
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
    app.add_middleware(DynamicCORSMiddleware)
    app.add_middleware(TenantResolverMiddleware)

    app.include_router(ai_router, prefix="/ai", tags=["ai"])
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

        # Log Email configuration status
        logger.info(f"📧 Email provider: {settings.email_provider}")

        if settings.email_provider.lower() == "resend":
            if settings.resend_api_key:
                logger.info(f"✅ Resend API key configured (starts with: {settings.resend_api_key[:10]}...)")
            else:
                logger.warning("⚠️ EMAIL_PROVIDER=resend but RESEND_API_KEY is missing!")
        elif settings.email_provider.lower() == "smtp":
            logger.info(f"📧 SMTP: {settings.smtp_host}:{settings.smtp_port}")
        elif settings.email_provider.lower() == "log":
            logger.warning("⚠️ Email provider is 'log' - emails will NOT be sent, only logged!")
            logger.warning("   To fix: Set EMAIL_PROVIDER=resend and RESEND_API_KEY in Railway")

        # Log AI configuration status
        # OpenAI API key'i değiştirmek için Railway'de OPENAI_API_KEY env değişkenini güncellemeniz yeterlidir.
        # Kod içinde hiçbir yerde key hard-coded değildir.
        if settings.openai_api_key:
            logger.info(f"AI service configured: model={settings.ai_model}, org_id={settings.openai_org_id or 'none'}")
        else:
            logger.warning("AI service NOT configured: OPENAI_API_KEY missing. AI chat will use fallback provider.")

    return app


app = create_app()

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
        "ALTER TABLE storages ADD COLUMN IF NOT EXISTS working_hours JSONB",
        # Tenant columns
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255)",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_status VARCHAR(20) NOT NULL DEFAULT 'unverified'",
        # User columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS tc_identity_number VARCHAR(11)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS district VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
        # Location columns
        "ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32)",
        "ALTER TABLE locations ADD COLUMN IF NOT EXISTS working_hours JSONB",
        # Pricing rules hierarchical columns
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'TENANT'",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS location_id VARCHAR(36)",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS storage_id VARCHAR(36)",
        "ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
        # Payment schedules table
        """CREATE TABLE IF NOT EXISTS payment_schedules (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(36) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
            is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            period_type VARCHAR(20) NOT NULL DEFAULT 'weekly',
            custom_days INTEGER,
            min_transfer_amount NUMERIC(10,2) NOT NULL DEFAULT 100.00,
            commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0500,
            bank_name VARCHAR(100),
            bank_account_holder VARCHAR(200),
            bank_iban VARCHAR(34),
            bank_swift VARCHAR(11),
            next_payment_date TIMESTAMPTZ,
            last_payment_date TIMESTAMPTZ,
            partner_can_request BOOLEAN NOT NULL DEFAULT TRUE,
            admin_notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        )""",
        # Payment transfers table
        """CREATE TABLE IF NOT EXISTS payment_transfers (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            schedule_id VARCHAR(36) REFERENCES payment_schedules(id) ON DELETE SET NULL,
            gross_amount NUMERIC(10,2) NOT NULL,
            commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
            net_amount NUMERIC(10,2) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            transfer_date TIMESTAMPTZ,
            reference_id VARCHAR(100),
            period_start TIMESTAMPTZ,
            period_end TIMESTAMPTZ,
            bank_name VARCHAR(100),
            bank_account_holder VARCHAR(200),
            bank_iban VARCHAR(34),
            processed_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
            processed_at TIMESTAMPTZ,
            notes TEXT,
            error_message TEXT,
            is_manual_request BOOLEAN NOT NULL DEFAULT FALSE,
            requested_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
            requested_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        )""",
        # Index for payment transfers
        "CREATE INDEX IF NOT EXISTS idx_payment_transfers_tenant ON payment_transfers(tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_transfers_status ON payment_transfers(status)",
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
