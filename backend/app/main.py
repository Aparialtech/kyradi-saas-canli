"""Entrypoint for the KYRADİ FastAPI application."""

try:  # pragma: no cover - optional optimization
    import uvloop

    uvloop.install()
except Exception:  # noqa: BLE001 - uvloop is optional
    uvloop = None

import logging
import re
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

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

app = FastAPI(
    title="KYRADİ API",
    version="0.1.0",
    description="FastAPI backend for the KYRADİ SaaS platform.",
)

# =============================================================================
# CORS Configuration - Fixed for credentials mode
# =============================================================================
# When credentials: "include" is used in frontend fetch requests,
# Access-Control-Allow-Origin CANNOT be "*". It must be the specific origin.

# Explicitly allowed origins
ALLOWED_ORIGINS = [
    # Production
    "https://kyradi-saas-canli.vercel.app",
    "https://kyradi-saas-canli-cqly0ovkl-aparialtechs-projects.vercel.app",
    # Local development
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# Patterns for dynamic origins (Vercel preview URLs)
ALLOWED_ORIGIN_PATTERNS = [
    r"https://kyradi-saas-canli-[a-z0-9-]+\.vercel\.app",
    r"https://kyradi-[a-z0-9-]+\.vercel\.app",
]


def is_origin_allowed(origin: str | None) -> bool:
    """Check if origin is in allowed list or matches allowed patterns."""
    if not origin:
        return False
    
    # Check exact match
    if origin in ALLOWED_ORIGINS:
        return True
    
    # Check pattern match (Vercel preview URLs)
    for pattern in ALLOWED_ORIGIN_PATTERNS:
        if re.match(pattern, origin):
            return True
    
    return False


class DynamicCORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware that handles dynamic Vercel preview URLs.
    
    This middleware properly handles credentials mode by returning the
    actual origin instead of "*" when the origin is allowed.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        origin = request.headers.get("origin")
        
        # Log CORS requests (debug level to avoid log spam)
        if origin:
            logger.debug(f"CORS request from origin={origin}")
        
        # Handle preflight (OPTIONS) requests
        if request.method == "OPTIONS":
            response = Response(status_code=200)
            if origin and is_origin_allowed(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, X-Tenant-ID, X-Widget-Token, X-Widget-Key, Accept, Origin"
                response.headers["Access-Control-Max-Age"] = "600"  # Cache preflight for 10 minutes
            return response
        
        # Process the actual request
        response = await call_next(request)
        
        # Add CORS headers to response
        if origin and is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Expose-Headers"] = "Content-Length, X-Request-ID"
        
        return response


# Add custom CORS middleware
app.add_middleware(DynamicCORSMiddleware)

# Also add standard CORS middleware as fallback for non-credential requests
# This handles cases where credentials are not included
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Tenant-ID", "X-Widget-Token", "X-Widget-Key", "Accept", "Origin"],
    expose_headers=["Content-Length", "X-Request-ID"],
    max_age=600,
)

app.include_router(api_router)

# Add global exception handler
app.add_exception_handler(Exception, global_exception_handler)


@app.on_event("startup")
async def startup_event() -> None:
    """Auto-create database tables and log AI status."""
    logger.info("Starting Kyradi backend...")
    logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")
    
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
