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
        # TODO: Add file handler for production
    ],
)

app = FastAPI(
    title="KYRADİ API",
    version="0.1.0",
    description="FastAPI backend for the KYRADİ SaaS platform.",
)

extra_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://kyradi-saas-canli.vercel.app",
    "https://kyradi-saas-canli-cqly0ovkl-aparialtechs-projects.vercel.app",
]

base_origins = getattr(settings, "cors_allowed_origins", []) or []

# Listeyi eşsiz hale getir
allowed_origins = sorted(set(base_origins + extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],      # allow all HTTP methods
    allow_headers=["*"],      # allow all headers
)

app.include_router(api_router)

# Add global exception handler
app.add_exception_handler(Exception, global_exception_handler)


@app.on_event("startup")
async def startup_event() -> None:
    """Auto-create database tables in local environments."""
    if settings.environment.lower() in {"local", "dev"}:
        await init_db()


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Simple readiness check endpoint."""
    return {"status": "ok"}
