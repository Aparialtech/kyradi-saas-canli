"""Security helpers for widget authentication tokens."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import JWTError, jwt

from app.core.config import settings


class WidgetTokenError(Exception):
    """Raised when widget token verification fails."""


def create_widget_token(tenant_id: str, key_id: str, origin: str) -> str:
    """Create a short-lived JWT for widget submission."""
    expires_delta = timedelta(minutes=settings.jwt_widget_expire_min)
    payload = {
        "sub": "widget",
        "tenant_id": tenant_id,
        "key_id": key_id,
        "origin": origin,
        "iss": settings.jwt_widget_issuer,
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_widget_token(token: str) -> Dict[str, Any]:
    """Decode and validate a widget token."""
    if not token or not token.strip():
        raise WidgetTokenError("Widget token bulunamadı")
    
    try:
        payload: Dict[str, Any] = jwt.decode(
            token.strip(),
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_widget_issuer,
        )
    except JWTError as exc:
        # Provide more detailed error message
        error_msg = str(exc)
        if "expired" in error_msg.lower():
            raise WidgetTokenError("Widget token süresi dolmuş. Lütfen sayfayı yenileyin.") from exc
        elif "invalid" in error_msg.lower():
            raise WidgetTokenError("Widget token geçersiz.") from exc
        else:
            raise WidgetTokenError(f"Widget token doğrulanamadı: {error_msg}") from exc

    if payload.get("sub") != "widget":
        raise WidgetTokenError("Geçersiz widget token türü")
    return payload
