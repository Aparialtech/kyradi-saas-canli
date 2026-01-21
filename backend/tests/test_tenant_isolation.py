import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.middleware import TenantResolverMiddleware
from app.models import AuditLog, Tenant, User, UserRole


def _ensure_tenant_middleware() -> None:
    if not any(middleware.cls is TenantResolverMiddleware for middleware in app.user_middleware):
        app.add_middleware(TenantResolverMiddleware)


@pytest.mark.asyncio
async def test_tenant_host_required(client: AsyncClient, db_session):
    _ensure_tenant_middleware()
    tenant = Tenant(slug="tenant-host", name="Tenant Host", plan="standard", is_active=True)
    db_session.add(tenant)
    await db_session.flush()

    user = User(
        tenant_id=tenant.id,
        email="tenant-host-admin@example.com",
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
    audit = await db_session.execute(select(AuditLog).where(AuditLog.action == "security.tenant_host_missing"))
    log_entry = audit.scalar_one_or_none()
    assert log_entry is not None
    assert log_entry.meta_json.get("host") == "app.kyradi.com"
    assert log_entry.meta_json.get("path") == "/users"
    assert log_entry.meta_json.get("request_id")


@pytest.mark.asyncio
async def test_tenant_token_mismatch_forbidden(client: AsyncClient, db_session):
    _ensure_tenant_middleware()
    tenant_one = Tenant(slug="tenant-one", name="Tenant One", plan="standard", is_active=True)
    tenant_two = Tenant(slug="tenant-two", name="Tenant Two", plan="standard", is_active=True)
    db_session.add_all([tenant_one, tenant_two])
    await db_session.flush()

    user = User(
        tenant_id=tenant_one.id,
        email="tenant1-admin@example.com",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.TENANT_ADMIN.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(subject=user.id, tenant_id=tenant_two.id, role=user.role)
    response = await client.get(
        "/users",
        headers={
            "Authorization": f"Bearer {token}",
            "Host": f"{tenant_one.slug}.kyradi.com",
        },
    )

    assert response.status_code == 403
    audit = await db_session.execute(select(AuditLog).where(AuditLog.action == "security.tenant_mismatch"))
    assert audit.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_tenant_token_match_allows_request(client: AsyncClient, db_session):
    _ensure_tenant_middleware()
    tenant = Tenant(slug="tenant-ok", name="Tenant OK", plan="standard", is_active=True)
    db_session.add(tenant)
    await db_session.flush()

    user = User(
        tenant_id=tenant.id,
        email="tenant-ok-admin@example.com",
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
