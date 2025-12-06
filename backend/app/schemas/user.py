"""Tenant user management schemas."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from ..models.enums import UserRole
from .auth import UserRead


class UserCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=8, description="Minimum 8 karakter parola. Opsiyonel, auto_generate_password=true ise boş bırakılabilir.")
    role: UserRole = UserRole.STAFF
    is_active: bool = True
    full_name: Optional[str] = Field(default=None, max_length=255, description="Kullanıcının tam adı")
    phone_number: Optional[str] = Field(default=None, max_length=32, description="Telefon numarası (örn: 905551234567)")
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID to assign user to (optional for super admin users)")
    auto_generate_password: bool = Field(default=False, description="Otomatik güvenli parola oluştur")


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    phone_number: Optional[str] = Field(default=None, max_length=32, description="Telefon numarası (örn: 905551234567)")
    full_name: Optional[str] = Field(default=None, max_length=255, description="Kullanıcının tam adı")
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID to assign user to (admin only)")


class UserPasswordReset(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8, description="Yeni parola minimum 8 karakter olmalıdır. Boş bırakılırsa otomatik oluşturulur.")
    auto_generate: bool = Field(default=True, description="Otomatik güvenli parola oluştur")


class PasswordResetResponse(BaseModel):
    """Response for password reset operations."""
    new_password: Optional[str] = Field(default=None, description="Yeni oluşturulan parola (sadece auto_generate=true ise)")
    message: str
