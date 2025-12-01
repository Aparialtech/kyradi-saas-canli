"""
App reservations package bootstrap.

Fixes:
- Circular imports
- Wrong top-level 'reservations' imports
- Ensures models load before routers/services
"""

from importlib import import_module

from . import models  # noqa: F401

_SUBMODULES = (
    "router_public",
    "router_partner",
    "router_admin",
    "services",
)

for sub in _SUBMODULES:
    try:
        import_module(f"{__name__}.{sub}")
    except ImportError:
        pass  # Optional submodule

# Re-export for backward compatibility
try:
    from .router_public import router as public_router
    from .router_partner import reservations_router, config_router
    from .router_admin import router as admin_router
except ImportError:
    public_router = None
    reservations_router = None
    config_router = None
    admin_router = None

__all__ = ["public_router", "reservations_router", "config_router", "admin_router"]
