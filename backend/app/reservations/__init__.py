"""
App reservations package.

Structure:
- models.py    → SQLAlchemy ORM models (WidgetConfig, WidgetReservation, WebhookDelivery)
- schemas.py   → Pydantic schemas for API
- services.py  → Business logic
- router_*.py  → FastAPI routers

Import order to avoid circular imports:
1. models (only depends on app.db.base)
2. schemas (no internal dependencies)
3. services (imports models)
4. routers (imports services, schemas, models)

IMPORTANT: Do NOT import models at package level to avoid circular imports.
Import them explicitly where needed: from app.reservations.models import WidgetConfig
"""

# Do NOT import models, services, or routers here at package level
# This prevents circular import issues

# Only expose router references for backward compatibility
# These are imported lazily when needed
__all__ = [
    "public_router",
    "reservations_router", 
    "config_router",
    "admin_router",
]


def __getattr__(name: str):
    """Lazy loading of routers to avoid circular imports."""
    if name == "public_router":
        from .router_public import router
        return router
    elif name == "reservations_router":
        from .router_partner import reservations_router
        return reservations_router
    elif name == "config_router":
        from .router_partner import config_router
        return config_router
    elif name == "admin_router":
        from .router_admin import router
        return router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
