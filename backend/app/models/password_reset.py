"""Password reset token model."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from ..db.base import Base, IdentifiedMixin, TimestampMixin


class PasswordResetMethod(str, enum.Enum):
    """Password reset method types."""
    EMAIL_LINK = "email_link"
    SMS_CODE = "sms_code"


class PasswordResetToken(IdentifiedMixin, TimestampMixin, Base):
    """Password reset tokens for secure password recovery."""

    __tablename__ = "password_reset_tokens"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    method: Mapped[str] = mapped_column(
        String(16),
        default=PasswordResetMethod.EMAIL_LINK.value,
        nullable=False,
    )
    created_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv6 support
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    verification_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)  # 6-digit verification code

    user: Mapped["User"] = relationship("User", back_populates="password_reset_tokens")

    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)."""
        if self.is_used:
            return False
        if datetime.now(timezone.utc) > self.expires_at:
            return False
        return True

    @classmethod
    def create_token(
        cls,
        user_id: str,
        tenant_id: Optional[str] = None,
        expires_in_minutes: int = 30,
        method: str = PasswordResetMethod.EMAIL_LINK.value,
        created_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> "PasswordResetToken":
        """Create a new password reset token."""
        import secrets
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
        return cls(
            user_id=user_id,
            tenant_id=tenant_id,
            token=token,
            expires_at=expires_at,
            is_used=False,
            method=method,
            created_ip=created_ip,
            user_agent=user_agent,
        )

