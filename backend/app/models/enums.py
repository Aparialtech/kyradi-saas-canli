"""Enumerations used across ORM models."""

from enum import Enum


class UserRole(str, Enum):
    """User role enumeration - yeni rol yapısı."""
    # Sistem seviyesi
    SUPER_ADMIN = "super_admin"  # Sistem Süper Admin
    
    # Otel seviyesi
    HOTEL_MANAGER = "hotel_manager"  # Otel Müdürü / Yönetici
    STORAGE_OPERATOR = "storage_operator"  # Depo Görevlisi
    ACCOUNTING = "accounting"  # Muhasebe / Finans
    
    # Backward compatibility
    SUPPORT = "support"  # Eski: Support
    TENANT_ADMIN = "tenant_admin"  # Eski: Tenant Admin (Hotel Manager'a map edilecek)
    STAFF = "staff"  # Eski: Staff (Storage Operator'a map edilecek)
    VIEWER = "viewer"  # Eski: Viewer (deprecated)


class StorageStatus(str, Enum):
    """Storage unit status enumeration."""
    IDLE = "idle"
    OCCUPIED = "occupied"
    FAULTY = "faulty"


# Backward compatibility alias
LockerStatus = StorageStatus


class ReservationStatus(str, Enum):
    """Reservation status lifecycle for luggage storage."""
    RESERVED = "reserved"  # Reservation created, no luggage dropped yet
    ACTIVE = "active"  # Customer arrived and dropped off luggage, storage is in use
    COMPLETED = "completed"  # Luggage picked up, reservation finished
    CANCELLED = "cancelled"  # Cancelled before luggage drop-off or by operator
    NO_SHOW = "no_show"  # Customer never came within allowed window; reservation expired
    LOST = "lost"  # Lost baggage case when delivery failed


class PaymentStatus(str, Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    PAID = "paid"  # POS or gateway payment completed
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentProvider(str, Enum):
    """Payment provider enumeration."""
    MAGIC_PAY = "MAGIC_PAY"
    POS = "POS"
    FAKE = "FAKE"  # For demo/testing


class PaymentMode(str, Enum):
    """Payment mode enumeration."""
    POS = "POS"  # Point of sale - cash/card at location
    CASH = "CASH"  # Cash payment (offline, no gateway)
    GATEWAY_DEMO = "GATEWAY_DEMO"  # Gateway demo mode (MagicPay demo)
    GATEWAY_LIVE = "GATEWAY_LIVE"  # Gateway live mode (real MagicPay)


class DomainStatus(str, Enum):
    """Domain verification status for tenant custom domains."""
    UNVERIFIED = "unverified"  # Domain added but not verified
    PENDING = "pending"  # Verification in progress
    VERIFIED = "verified"  # Domain ownership verified
    FAILED = "failed"  # Verification failed
