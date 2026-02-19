import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.middleware.tenant_resolver import TenantResolverMiddleware
from app.models import Tenant, User, UserRole


def _ensure_tenant_middleware() -> None:
    if not any(middleware.cls is TenantResolverMiddleware for middleware in app.user_middleware):
        app.add_middleware(TenantResolverMiddleware)


@pytest.mark.asyncio
async def test_admin_login_on_admin_host(client: AsyncClient, db_session) -> None:
    _ensure_tenant_middleware()
    user = User(
        email="admin-host@example.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.SUPER_ADMIN.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/auth/admin/login",
        json={"email": user.email, "password": "Password123!"},
        headers={"Host": "admin.kyradi.com"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_partner_login_on_app_host(client: AsyncClient, db_session) -> None:
    _ensure_tenant_middleware()
    tenant = Tenant(slug="host-login", name="Host Login", plan="standard", is_active=True)
    db_session.add(tenant)
    await db_session.flush()

    user = User(
        tenant_id=tenant.id,
        email="partner-login@example.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.TENANT_ADMIN.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/auth/partner/login",
        json={"email": user.email, "password": "Password123!"},
        headers={"Host": "app.kyradi.com"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_partner_api_blocked_on_app_host(client: AsyncClient, db_session) -> None:
    _ensure_tenant_middleware()
    tenant = Tenant(slug="app-blocked", name="App Blocked", plan="standard", is_active=True)
    db_session.add(tenant)
    await db_session.flush()

    user = User(
        tenant_id=tenant.id,
        email="app-blocked@example.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.TENANT_ADMIN.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(subject=user.id, tenant_id=tenant.id, role=user.role)
    response = await client.get(
        "/users",
        headers={
            "Authorization": f"Bearer {token}",
            "Host": "app.kyradi.com",
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_partner_api_allows_tenant_host(client: AsyncClient, db_session) -> None:
    _ensure_tenant_middleware()
    tenant = Tenant(slug="tenant-allowed", name="Tenant Allowed", plan="standard", is_active=True)
    db_session.add(tenant)
    await db_session.flush()

    user = User(
        tenant_id=tenant.id,
        email="tenant-allowed@example.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.TENANT_ADMIN.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(subject=user.id, tenant_id=tenant.id, role=user.role)
    response = await client.get(
        "/users",
        headers={
            "Authorization": f"Bearer {token}",
            "Host": f"{tenant.slug}.kyradi.com",
        },
    )
    assert response.status_code == 200
