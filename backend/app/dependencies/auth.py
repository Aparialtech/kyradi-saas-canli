"""Authentication related dependencies."""

import logging
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.security import decode_token
from ..db.session import get_session
from ..models import Tenant, User, UserRole
from ..services.audit import record_audit

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


logger = logging.getLogger(__name__)


def _safe_token_preview(token: str | None) -> str | None:
    if not token:
        return None
    return token[:10]



async def _record_security_audit(
    session: AsyncSession,
    *,
    action: str,
    user_id: str | None,
    token_tenant_id: str | None,
    host_tenant_id: str | None,
    request: Request | None,
) -> None:
    request_id = None
    correlation_id = None
    method = None
    path = None
    host = None
    user_agent = None
    ip = None

    if request:
        request_id = getattr(request.state, "request_id", None)
        if not request_id:
            request_id = request.headers.get("x-request-id") or str(uuid4())
            request.state.request_id = request_id
        correlation_id = getattr(request.state, "correlation_id", None) or request.headers.get("x-correlation-id")
        method = request.method
        path = request.url.path
        host = request.headers.get("host")
        user_agent = request.headers.get("user-agent")
        forwarded_for = request.headers.get("x-forwarded-for")
        ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else None)

    meta = {
        "user_id": user_id,
        "token_tenant_id": token_tenant_id,
        "host_tenant_id": host_tenant_id,
        "path": path,
        "method": method,
        "ip": ip,
        "user_agent": user_agent,
        "request_id": request_id,
        "correlation_id": correlation_id,
        "host": host,
    }

    try:
        await record_audit(
            session,
            tenant_id=host_tenant_id or token_tenant_id,
            actor_user_id=user_id,
            action=action,
            meta=meta,
        )
        await session.commit()
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning("Audit log failed for %s: %s", action, exc)
        try:
            await session.rollback()
        except Exception:
            pass


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    request: Request = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    """Decode JWT token and return the current user."""
    if request:
        if request.url.path.startswith("/auth/") or request.url.path.startswith("/admin/"):
            auth_header = request.headers.get("authorization")
            cookie_token = request.cookies.get("access_token")
            logger.info(
                "auth_req url=%s host=%s xf_host=%s x_vercel_host=%s origin=%s cookie_present=%s auth_present=%s token_tenant=%s tenant_state=%s",
                request.url.path,
                request.headers.get("host"),
                request.headers.get("x-forwarded-host"),
                request.headers.get("x-vercel-forwarded-host"),
                request.headers.get("origin"),
                bool(cookie_token),
                bool(auth_header),
                _safe_token_preview((auth_header.split(" ", 1)[1] if auth_header and " " in auth_header else None)),
                getattr(request.state, "tenant_id", None),
            )
            cookie_token = request.cookies.get("access_token")
            logger.info(
                "auth_me request host=%s xf_host=%s x_vercel_host=%s origin=%s cookie=%s auth=%s",
                request.headers.get("host"),
                request.headers.get("x-forwarded-host"),
                request.headers.get("x-vercel-forwarded-host"),
                request.headers.get("origin"),
                _safe_token_preview(cookie_token),
                _safe_token_preview(auth_header.split(" ", 1)[1] if auth_header and " " in auth_header else None),
            )
    if not token and request:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except ValueError as exc:
        # If header token is invalid, fall back to cookie token (if different).
        cookie_token = request.cookies.get("access_token") if request else None
        if cookie_token and cookie_token != token:
            try:
                payload = decode_token(cookie_token)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token",
                ) from exc
        else:
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
    if request:
        request.state.token_tenant_id = tenant_id
    request_tenant_id = getattr(request.state, "tenant_id", None) if request else None
    if request and not request_tenant_id and tenant_id:
        request.state.tenant_id = tenant_id
    effective_tenant_id = tenant_id or request_tenant_id

    if tenant_id and request_tenant_id and tenant_id != request_tenant_id:
        await _record_security_audit(
            session,
            action="security.tenant_mismatch",
            user_id=user.id,
            token_tenant_id=tenant_id,
            host_tenant_id=request_tenant_id,
            request=request,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant_mismatch")

    if user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        if effective_tenant_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context required")
        if user.tenant_id != effective_tenant_id:
            await _record_security_audit(
                session,
                action="security.tenant_mismatch",
                user_id=user.id,
                token_tenant_id=tenant_id,
                host_tenant_id=request_tenant_id,
                request=request,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant_mismatch")
        tenant = await session.execute(select(Tenant).where(Tenant.id == effective_tenant_id, Tenant.is_active == True))
        if tenant.scalar_one_or_none() is None:
            await _record_security_audit(
                session,
                action="security.tenant_mismatch",
                user_id=user.id,
                token_tenant_id=tenant_id,
                host_tenant_id=request_tenant_id,
                request=request,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant_mismatch")

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


async def require_tenant_operator(
    request: Request = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Ensure the current user operates on behalf of a tenant (read only allowed)."""
    if current_user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        await _enforce_tenant_host(request, session, current_user)
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


async def require_tenant_staff(
    request: Request = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Ensure the current user is tenant staff or admin (write operations)."""
    if current_user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        await _enforce_tenant_host(request, session, current_user)
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


async def require_tenant_admin(
    request: Request = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Ensure the current user is tenant admin or hotel manager."""
    if current_user.role in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        return current_user

    await _enforce_tenant_host(request, session, current_user)

    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.TENANT_ADMIN.value,
        UserRole.HOTEL_MANAGER.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant admin or hotel manager privileges required")
    return current_user


async def _enforce_tenant_host(
    request: Request | None,
    session: AsyncSession,
    current_user: User,
) -> None:
    tenant_required_prefixes = ("/users", "/partners/settings", "/staff")
    if request and request.url.path.startswith(tenant_required_prefixes):
        host_tenant_id = getattr(request.state, "tenant_id", None)
        if host_tenant_id is None:
            await _record_security_audit(
                session,
                action="security.tenant_host_missing",
                user_id=current_user.id,
                token_tenant_id=getattr(request.state, "token_tenant_id", None),
                host_tenant_id=None,
                request=request,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant host required")


async def require_storage_operator(
    request: Request = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Ensure the current user is storage operator."""
    if current_user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        await _enforce_tenant_host(request, session, current_user)
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.STORAGE_OPERATOR.value,
        UserRole.STAFF.value,  # Backward compatibility
        UserRole.HOTEL_MANAGER.value,
        UserRole.TENANT_ADMIN.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Storage operator privileges required")
    return current_user


async def require_accounting(
    request: Request = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Ensure the current user has accounting role."""
    if current_user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        await _enforce_tenant_host(request, session, current_user)
    _ensure_tenant_user(current_user)
    if current_user.role not in {
        UserRole.ACCOUNTING.value,
        UserRole.HOTEL_MANAGER.value,
        UserRole.TENANT_ADMIN.value,
    }:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accounting privileges required")
    return current_user
