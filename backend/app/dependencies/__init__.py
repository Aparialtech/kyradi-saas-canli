"""Dependency shortcuts."""

from .auth import (
    get_current_active_user,
    get_current_user,
    oauth2_scheme,
    require_accounting,
    require_admin_user,
    require_super_admin,
    require_storage_operator,
    require_tenant_admin,
    require_tenant_staff,
    require_tenant_operator,
)

__all__ = [
    "get_current_user",
    "get_current_active_user",
    "require_admin_user",
    "require_super_admin",
    "require_accounting",
    "require_storage_operator",
    "require_tenant_operator",
    "require_tenant_staff",
    "require_tenant_admin",
    "oauth2_scheme",
]
