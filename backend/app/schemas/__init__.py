"""Convenience imports for schema modules."""

from .audit import AuditLogRead, AuditLogList
from .auth import (
    LoginRequest,
    TokenPayload,
    TokenResponse,
    UserRead,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    VerifyLoginSMSRequest,
    VerifyLoginSMSResponse,
    ResendLoginSMSRequest,
    ResendLoginSMSResponse,
)
from .user import UserCreate, UserUpdate, UserPasswordReset, PasswordResetResponse
from .admin_user import (
    AdminUserCreate,
    AdminUserRead,
    AdminUserUpdate,
)
from .locker import LockerCreate, LockerRead, LockerUpdate, StorageCreate, StorageRead, StorageUpdate
from .location import LocationCreate, LocationRead, LocationUpdate
from .payment import PaymentIntentCreate, PaymentRead, PaymentWebhookPayload
from .qr import QRVerifyRequest, QRVerifyResponse
from .report import AdminSummary, AdminTenantSummary, AdminDailyRevenue, AdminTopTenant, SystemHealth, PartnerSummary, LimitWarning, QuotaUsage
from .quota import PartnerQuotaInfo, PartnerQuotaLimits, PartnerQuotaUsage
from .revenue import RevenueSummary, SettlementRead
from .staff import StaffCreate, StaffRead, StaffUpdate
from .reservation import (
    ReservationCreate,
    ReservationListFilter,
    ReservationRead,
    ReservationStatusResponse,
    ReservationHandoverRequest,
    ReservationReturnRequest,
    ReservationExtendRequest,
)
from .tenant import (
    TenantCreate,
    TenantDetail,
    TenantMetrics,
    TenantPlanLimits,
    TenantPlanLimitsUpdate,
    TenantRead,
    TenantUpdate,
)
from .self_service import (
    SelfServiceReservationRequest,
    SelfServiceReservationResponse,
    SelfServiceReservationCreateRequest,
    SelfServiceReservationCreateResponse,
)
from .legal_texts import LegalTextsResponse

__all__ = [
    "AuditLogRead",
    "AuditLogList",
    "LoginRequest",
    "TokenPayload",
    "TokenResponse",
    "UserRead",
    "ForgotPasswordRequest",
    "ForgotPasswordResponse",
    "VerifyResetCodeRequest",
    "VerifyResetCodeResponse",
    "ResetPasswordRequest",
    "ResetPasswordResponse",
    "VerifyLoginSMSRequest",
    "VerifyLoginSMSResponse",
    "ResendLoginSMSRequest",
    "ResendLoginSMSResponse",
    "UserCreate",
    "UserUpdate",
    "UserPasswordReset",
    "PasswordResetResponse",
    "AdminUserCreate",
    "AdminUserRead",
    "AdminUserUpdate",
    "LockerCreate",  # Backward compatibility
    "LockerRead",  # Backward compatibility
    "LockerUpdate",  # Backward compatibility
    "StorageCreate",
    "StorageRead",
    "StorageUpdate",
    "LocationCreate",
    "LocationRead",
    "LocationUpdate",
    "PaymentIntentCreate",
    "PaymentRead",
    "PaymentWebhookPayload",
    "QRVerifyRequest",
    "QRVerifyResponse",
    "AdminSummary",
    "AdminTenantSummary",
    "AdminDailyRevenue",
    "AdminTopTenant",
    "SystemHealth",
    "PartnerSummary",
    "LimitWarning",
    "QuotaUsage",
    "PartnerQuotaInfo",
    "PartnerQuotaLimits",
    "PartnerQuotaUsage",
    "ReservationCreate",
    "ReservationListFilter",
    "ReservationRead",
    "ReservationStatusResponse",
    "ReservationHandoverRequest",
    "ReservationReturnRequest",
    "TenantCreate",
    "TenantDetail",
    "TenantMetrics",
    "TenantPlanLimits",
    "TenantPlanLimitsUpdate",
    "TenantRead",
    "TenantUpdate",
    "SelfServiceReservationRequest",
    "SelfServiceReservationResponse",
    "SelfServiceReservationCreateRequest",
    "SelfServiceReservationCreateResponse",
    "RevenueSummary",
    "SettlementRead",
    "StaffCreate",
    "StaffRead",
    "StaffUpdate",
    "LegalTextsResponse",
]
