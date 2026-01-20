"""Authentication request and response schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from ..models.enums import UserRole
from .base import IdentifiedModel, ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    tenant_slug: Optional[str] = Field(default=None, description="Tenant slug; admin kullanıcıları için opsiyonel.")


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    status: Optional[str] = None  # "phone_verification_required" or None
    verification_id: Optional[str] = None  # ID of PhoneLoginVerification when status is "phone_verification_required"


class PartnerLoginResponse(BaseModel):
    """Response for partner login with tenant info for redirect."""
    access_token: str
    token_type: str = "bearer"
    tenant_slug: Optional[str] = None  # Tenant subdomain for redirect
    tenant_id: Optional[str] = None


class TokenPayload(BaseModel):
    sub: str
    tenant_id: Optional[str]
    role: UserRole
    exp: int


class UserRead(IdentifiedModel):
    email: EmailStr
    tenant_id: Optional[str]
    role: UserRole
    is_active: bool
    phone_number: Optional[str] = None
    full_name: Optional[str] = None
    birth_date: Optional[datetime] = None
    tc_identity_number: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    last_login_at: Optional[datetime] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None  # Only in development mode


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code from email")


class VerifyResetCodeResponse(BaseModel):
    message: str
    reset_token: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset token from code verification")
    new_password: str = Field(min_length=8, description="Yeni şifre minimum 8 karakter olmalıdır.")


class ResetPasswordResponse(BaseModel):
    message: str
    success: bool


class VerifyLoginSMSRequest(BaseModel):
    verification_id: str = Field(..., description="PhoneLoginVerification ID from login response")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit SMS verification code")


class VerifyLoginSMSResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    message: str


class ResendLoginSMSRequest(BaseModel):
    verification_id: str = Field(..., description="PhoneLoginVerification ID to resend code for")


class ResendLoginSMSResponse(BaseModel):
    message: str
    verification_id: str


# =====================
# Signup Schemas
# =====================

class SignupRequest(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str = Field(min_length=8, description="Şifre minimum 8 karakter olmalıdır.")
    full_name: Optional[str] = Field(default=None, max_length=255)
    phone_number: Optional[str] = Field(default=None, max_length=32)


class SignupResponse(BaseModel):
    """User registration response."""
    message: str
    user_id: str
    access_token: Optional[str] = None  # Auto-login after signup


# =====================
# Self-Service Tenant Creation Schemas
# =====================

class TenantOnboardingRequest(BaseModel):
    """Request to create a tenant and assign current user as owner."""
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=3, max_length=64, pattern=r'^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$')
    custom_domain: Optional[str] = Field(default=None, max_length=255)
    legal_name: Optional[str] = Field(default=None, max_length=255)
    brand_color: Optional[str] = Field(default=None, max_length=16)


class TenantOnboardingResponse(BaseModel):
    """Response after tenant creation."""
    message: str
    tenant_id: str
    tenant_slug: str
    redirect_url: str  # e.g., https://{slug}.kyradi.com/app
