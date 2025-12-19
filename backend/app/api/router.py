"""Aggregate API router for the KYRADİ backend.

This module assembles all API routers. 

Import order matters to avoid circular imports:
1. Core routes (auth, admin, etc.) 
2. Reservation routes (direct imports from router files)
3. AI router (optional, safe import)
"""

import logging
from typing import Optional

from fastapi import APIRouter

from app.core.config import settings

# Import reservation routers DIRECTLY from router files (not from __init__)
# This avoids circular imports
from app.reservations.router_admin import router as widget_admin_router
from app.reservations.router_partner import reservations_router as widget_partner_router
from app.reservations.router_partner import config_router as widget_config_router
from app.reservations.router_public import router as widget_public_router

from .routes import (
    admin,
    admin_users,
    partner_reservations,
    partner_settings,
    partner_storages,
    partner_reports,
    partner_mail,
    audit,
    auth,
    demo,
    locations,
    lockers,
    magicpay,
    payment_schedules,
    pricing,
    public,
    payments,
    qr,
    reports,
    reservations,
    revenue,
    staff,
    tickets,
    users,
    webhooks,
    health,
)

logger = logging.getLogger("kyradi.api")

api_router = APIRouter()

# =============================================================================
# CORE ROUTES - These must always work
# =============================================================================

api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(admin_users.router)
api_router.include_router(partner_reservations.router)
api_router.include_router(partner_settings.router)
api_router.include_router(partner_storages.router)
api_router.include_router(partner_mail.router)
api_router.include_router(audit.router)
api_router.include_router(demo.router)
api_router.include_router(locations.router)
api_router.include_router(lockers.router)
api_router.include_router(lockers.legacy_router)  # Backward compatibility

if settings.enable_internal_reservations:
    api_router.include_router(reservations.router)

api_router.include_router(public.router)
api_router.include_router(payments.router)
api_router.include_router(magicpay.router)
api_router.include_router(pricing.router)
api_router.include_router(users.router)
api_router.include_router(staff.router)
api_router.include_router(tickets.router)
# TODO: Enable after running migration: alembic upgrade head
# api_router.include_router(payment_schedules.router)
api_router.include_router(qr.router)
api_router.include_router(reports.router)
api_router.include_router(revenue.router)

# Partner reports router (unified reporting endpoints)
from .routes import partner_reports
api_router.include_router(partner_reports.router)
api_router.include_router(webhooks.router)
api_router.include_router(health.router)

# =============================================================================
# WIDGET RESERVATION ROUTES
# =============================================================================

api_router.include_router(widget_public_router)
api_router.include_router(widget_partner_router)
api_router.include_router(widget_config_router)
api_router.include_router(widget_admin_router)

# =============================================================================
# AI ROUTER - Optional, safe import
# =============================================================================

_ai_router_loaded = False
_ai_error: Optional[str] = None

try:
    from app.ai import router as ai_router, is_ai_available
    
    if ai_router is not None:
        api_router.include_router(ai_router)
        _ai_router_loaded = True
        logger.info("AI router registered successfully")
    else:
        _ai_error = "AI router is None"
        logger.warning("AI router is None - AI endpoints disabled")
except ImportError as e:
    _ai_error = f"Import error: {e}"
    logger.warning(f"AI router import failed: {e}")
except Exception as e:
    _ai_error = f"Unexpected error: {e}"
    logger.error(f"AI router registration failed: {e}")


def is_ai_router_enabled() -> bool:
    """Check if AI router was successfully loaded."""
    return _ai_router_loaded


def get_ai_router_error() -> Optional[str]:
    """Get AI router error if any."""
    return _ai_error
