"""Security helpers for password hashing and JWT handling."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if the provided password matches the stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Return a secure hash of the password."""
    return pwd_context.hash(password)


def create_access_token(
    subject: str,
    tenant_id: Optional[str],
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT for the authenticated subject."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode: Dict[str, Any] = {
        "exp": expire,
        "sub": subject,
        "tenant_id": tenant_id,
        "role": role,
    }
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode a JWT and return the payload."""
    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            _resolve_verification_key(),
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError as exc:  # pragma: no cover - defensive guard
        raise ValueError("Invalid authentication token") from exc


def _resolve_verification_key() -> str:
    algorithm = (settings.jwt_algorithm or "HS256").upper()
    if algorithm.startswith(("RS", "ES")):
        return settings.jwt_public_key or settings.jwt_secret_key
    return settings.jwt_secret_key
