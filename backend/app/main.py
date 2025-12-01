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

app = FastAPI(
    title="KYRADİ API",
    version="0.1.0",
    description="FastAPI backend for the KYRADİ SaaS platform.",
)

# CORS Configuration - Allow all origins for maximum compatibility
# In production, you may want to restrict this to specific domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
)

app.include_router(api_router)

# Add global exception handler
app.add_exception_handler(Exception, global_exception_handler)


@app.on_event("startup")
async def startup_event() -> None:
    """Auto-create database tables and log AI status."""
    if settings.environment.lower() in {"local", "dev"}:
        await init_db()
    
    # Log AI configuration status
    import os
    openai_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if openai_key:
        logger.info(f"AI service configured: model={settings.ai_model}")
    else:
        logger.warning("AI service NOT configured: OPENAI_API_KEY missing")


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Simple readiness check endpoint."""
    return {"status": "ok"}
