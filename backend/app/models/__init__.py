"""Aggregate models for external imports."""

from .enums import (
    LockerStatus,
    PaymentMode,
    PaymentProvider,
    PaymentStatus,
    ReservationStatus,
    StorageStatus,
    UserRole,
)
from .location import Location, Locker, Storage
from .reservation import AuditLog, Payment, Reservation
from .revenue import Settlement
from .staff import Staff
from .tenant import Tenant, TenantPlanLimit, User
from .password_reset import PasswordResetToken, PasswordResetMethod
from .phone_verification import PhoneLoginVerification
from .pricing import PricingRule
from .ticket import Ticket, TicketStatus, TicketPriority, TicketTarget

__all__ = [
    "Locker",  # Backward compatibility
    "LockerStatus",  # Backward compatibility
    "Location",
    "Payment",
    "PaymentMode",
    "PaymentProvider",
    "PaymentStatus",
    "PasswordResetToken",
    "PasswordResetMethod",
    "PhoneLoginVerification",
    "PricingRule",
    "Reservation",
    "ReservationStatus",
    "Settlement",
    "Staff",
    "Storage",
    "StorageStatus",
    "Tenant",
    "TenantPlanLimit",
    "User",
    "UserRole",
    "AuditLog",
    "Ticket",
    "TicketStatus",
    "TicketPriority",
    "TicketTarget",
]
