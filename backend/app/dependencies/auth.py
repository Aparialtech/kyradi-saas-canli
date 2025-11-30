"""Authentication related dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.security import decode_token
from ..db.session import get_session
from ..models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Decode JWT token and return the current user."""
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    tenant_id = payload.get("tenant_id")
    if user.role != UserRole.SUPER_ADMIN.value and tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context required")

    if tenant_id and user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user


async def require_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user has admin level role."""
    if current_user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


async def require_super_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user is a super admin."""
    if current_user.role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin privileges required")
    return current_user


def _ensure_tenant_user(current_user: User) -> User:
    if current_user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant-scoped user required")
    return current_user


async def require_tenant_operator(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user operates on behalf of a tenant (read only allowed)."""
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.TENANT_ADMIN.value,
        UserRole.HOTEL_MANAGER.value,
        UserRole.STAFF.value,
        UserRole.STORAGE_OPERATOR.value,
        UserRole.ACCOUNTING.value,
        UserRole.VIEWER.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized role")
    return current_user


async def require_tenant_staff(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user is tenant staff or admin (write operations)."""
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.TENANT_ADMIN.value,
        UserRole.HOTEL_MANAGER.value,
        UserRole.STAFF.value,
        UserRole.STORAGE_OPERATOR.value,
        UserRole.ACCOUNTING.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role for this action")
    return current_user


async def require_tenant_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user is tenant admin or hotel manager."""
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.TENANT_ADMIN.value,
        UserRole.HOTEL_MANAGER.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant admin or hotel manager privileges required")
    return current_user


async def require_storage_operator(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user is storage operator."""
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.STORAGE_OPERATOR.value,
        UserRole.STAFF.value,  # Backward compatibility
        UserRole.HOTEL_MANAGER.value,
        UserRole.TENANT_ADMIN.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Storage operator privileges required")
    return current_user


async def require_accounting(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user has accounting role."""
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.ACCOUNTING.value,
        UserRole.HOTEL_MANAGER.value,
        UserRole.TENANT_ADMIN.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accounting privileges required")
    return current_user
