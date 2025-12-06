"""Tenant user management schemas."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from ..models.enums import UserRole
from .auth import UserRead


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 karakter parola.")
    role: UserRole = UserRole.STAFF
    is_active: bool = True


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    phone_number: Optional[str] = Field(default=None, max_length=32, description="Telefon numarası (örn: 905551234567)")
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID to assign user to (admin only)")


class UserPasswordReset(BaseModel):
    password: str = Field(min_length=8, description="Yeni parola minimum 8 karakter olmalıdır.")
