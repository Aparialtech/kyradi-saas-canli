"""Security helpers for password hashing and JWT handling."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import base64
import os

from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet

from .config import settings

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

# Password encryption key (for admin viewing - WARNING: Security risk!)
def _get_encryption_key() -> bytes:
    """Get or generate encryption key for password storage."""
    key_env = os.getenv("PASSWORD_ENCRYPTION_KEY")
    if key_env:
        return base64.urlsafe_b64decode(key_env.encode())
    # Generate a key if not set (for development)
    # In production, set PASSWORD_ENCRYPTION_KEY environment variable
    key = Fernet.generate_key()
    return key


_fernet = Fernet(_get_encryption_key())


def encrypt_password(password: str) -> str:
    """Encrypt password for admin viewing (WARNING: Security risk!)."""
    return _fernet.encrypt(password.encode()).decode()


def decrypt_password(encrypted_password: str) -> str:
    """Decrypt password for admin viewing."""
    try:
        return _fernet.decrypt(encrypted_password.encode()).decode()
    except Exception:
        return ""  # Return empty if decryption fails


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
