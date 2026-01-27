"""Aggregate models for external imports."""

from .enums import (
    DomainStatus,
    LockerStatus,
    PaymentMode,
    PaymentProvider,
    PaymentStatus,
    ReservationStatus,
    StorageStatus,
    TenantDomainStatus,
    TenantDomainType,
    TenantDomainVerificationMethod,
    UserRole,
)
from .location import Location, Locker, Storage
from .reservation import AuditLog, Payment, Reservation
from .revenue import Settlement
from .staff import Staff
from .tenant import Tenant, TenantPlanLimit, User
from .tenant_domain import TenantDomain
from .password_reset import PasswordResetToken, PasswordResetMethod
from .phone_verification import PhoneLoginVerification
from .pricing import PricingRule

# Note: Ticket model is imported directly in routes to avoid circular imports
# from .ticket import Ticket, TicketStatus, TicketPriority, TicketTarget

__all__ = [
    "AuditLog",
    "DomainStatus",
    "Locker",  # Backward compatibility
    "LockerStatus",  # Backward compatibility
    "Location",
    "PasswordResetMethod",
    "PasswordResetToken",
    "Payment",
    "PaymentMode",
    "PaymentProvider",
    "PaymentStatus",
    "PhoneLoginVerification",
    "PricingRule",
    "Reservation",
    "ReservationStatus",
    "Settlement",
    "Staff",
    "Storage",
    "StorageStatus",
    "Tenant",
    "TenantDomain",
    "TenantDomainStatus",
    "TenantDomainType",
    "TenantDomainVerificationMethod",
    "TenantPlanLimit",
    "User",
    "UserRole",
]
