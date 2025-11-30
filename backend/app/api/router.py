"""Aggregate API router for the KYRADİ backend."""

from fastapi import APIRouter

from app.ai import router as ai_router
from app.core.config import settings
from reservations import admin_router as widget_admin_router
from reservations import reservations_router as widget_partner_router
from reservations import public_router as widget_public_router
from reservations import config_router as widget_config_router

from .routes import (
    admin,
    admin_users,
    partner_reservations,
    partner_storages,
    audit,
    auth,
    demo,
    locations,
    lockers,
    magicpay,
    pricing,
    public,
    payments,
    qr,
    reports,
    reservations,
    revenue,
    staff,
    users,
    webhooks,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(admin_users.router)
api_router.include_router(partner_reservations.router)
api_router.include_router(partner_storages.router)
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
api_router.include_router(qr.router)
api_router.include_router(reports.router)
api_router.include_router(revenue.router)
api_router.include_router(webhooks.router)
api_router.include_router(ai_router)
api_router.include_router(widget_public_router)
api_router.include_router(widget_partner_router)
api_router.include_router(widget_config_router)
api_router.include_router(widget_admin_router)
