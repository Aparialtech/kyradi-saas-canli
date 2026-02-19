"""Role-based access control utilities."""

from typing import List, Set

from ..models.enums import UserRole


# Role hierarchy and permissions
ROLE_PERMISSIONS: dict[str, Set[str]] = {
    UserRole.SUPER_ADMIN.value: {
        "admin.*",
        "tenant.*",
        "user.*",
        "location.*",
        "storage.*",
        "reservation.*",
        "payment.*",
        "settlement.*",
        "report.*",
        "audit.*",
    },
    UserRole.HOTEL_MANAGER.value: {
        "user.*",
        "location.*",
        "storage.*",
        "reservation.*",
        "payment.*",
        "settlement.view",
        "report.*",
    },
    UserRole.STORAGE_OPERATOR.value: {
        "storage.view",
        "storage.update",
        "reservation.view",
        "reservation.create",
        "reservation.handover",
        "reservation.return",
        "qr.*",
    },
    UserRole.ACCOUNTING.value: {
        "payment.view",
        "settlement.*",
        "report.*",
        "revenue.*",
    },
    # Backward compatibility
    UserRole.TENANT_ADMIN.value: {
        "user.*",
        "location.*",
        "storage.*",
        "reservation.*",
        "payment.*",
        "settlement.view",
        "report.*",
    },
    UserRole.STAFF.value: {
        "storage.view",
        "storage.update",
        "reservation.view",
        "reservation.create",
        "reservation.handover",
        "reservation.return",
        "qr.*",
    },
    UserRole.SUPPORT.value: {
        "admin.*",
        "tenant.view",
        "user.view",
    },
    UserRole.VIEWER.value: {
        "reservation.view",
        "report.view",
    },
}


def has_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    permissions = ROLE_PERMISSIONS.get(role, set())
    
    # Check exact match
    if permission in permissions:
        return True
    
    # Check wildcard match (e.g., "admin.*" matches "admin.users.create")
    for perm in permissions:
        if perm.endswith(".*"):
            prefix = perm[:-2]
            if permission.startswith(prefix + ".") or permission == prefix:
                return True
    
    return False


def can_access_tenant(role: str, target_tenant_id: str, user_tenant_id: str | None) -> bool:
    """Check if user can access a specific tenant."""
    if role == UserRole.SUPER_ADMIN.value or role == UserRole.SUPPORT.value:
        return True
    
    # Other roles can only access their own tenant
    return user_tenant_id == target_tenant_id


def can_create_tenant(role: str) -> bool:
    """Check if user can create new tenants."""
    return role == UserRole.SUPER_ADMIN.value


def get_accessible_menus(role: str) -> List[str]:
    """Get list of menu items accessible by role."""
    menus = {
        UserRole.SUPER_ADMIN.value: [
            "overview",
            "tenants",
            "users",
            "audit",
            "reports",
        ],
        UserRole.HOTEL_MANAGER.value: [
            "overview",
            "locations",
            "storages",
            "reservations",
            "users",
            "reports",
            "settlements",
        ],
        UserRole.STORAGE_OPERATOR.value: [
            "overview",
            "storages",
            "reservations",
            "qr",
        ],
        UserRole.ACCOUNTING.value: [
            "overview",
            "payments",
            "settlements",
            "reports",
        ],
        # Backward compatibility
        UserRole.TENANT_ADMIN.value: [
            "overview",
            "locations",
            "storages",
            "reservations",
            "users",
            "reports",
        ],
        UserRole.STAFF.value: [
            "overview",
            "storages",
            "reservations",
            "qr",
        ],
    }
    return menus.get(role, [])

