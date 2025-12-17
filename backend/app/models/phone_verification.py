"""Phone login verification model for SMS-based login verification."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin


class PhoneLoginVerification(IdentifiedMixin, TimestampMixin, Base):
    """SMS verification codes for first login after password reset."""

    __tablename__ = "phone_login_verifications"

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
    code: Mapped[str] = mapped_column(String(6), nullable=False, index=True)  # 6-digit numeric code
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(SmallInteger, default=5, nullable=False)
    last_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)

    user: Mapped["User"] = relationship("User", back_populates="phone_verifications")

    def is_valid(self) -> bool:
        """Check if verification code is valid (not used, not expired, not exceeded max attempts)."""
        if self.is_used:
            return False
        if datetime.now(timezone.utc) > self.expires_at:
            return False
        if self.attempt_count >= self.max_attempts:
            return False
        return True

    def increment_attempt(self) -> None:
        """Increment attempt count."""
        self.attempt_count += 1

    @classmethod
    def create_verification(
        cls,
        user_id: str,
        tenant_id: Optional[str] = None,
        expires_in_minutes: int = 10,
        max_attempts: int = 5,
    ) -> "PhoneLoginVerification":
        """Create a new phone login verification code."""
        import secrets
        # Generate 6-digit numeric code (100000-999999)
        code = str(secrets.randbelow(900000) + 100000)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
        return cls(
            user_id=user_id,
            tenant_id=tenant_id,
            code=code,
            expires_at=expires_at,
            is_used=False,
            attempt_count=0,
            max_attempts=max_attempts,
            last_sent_at=datetime.now(timezone.utc),
        )

