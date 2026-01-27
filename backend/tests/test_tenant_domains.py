import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.session import AsyncSessionMaker
from app.models import Tenant, TenantDomain, TenantDomainStatus, TenantDomainType, User, UserRole
from app.core.security import get_password_hash
from app.middleware.tenant_resolver import resolve_tenant_by_domain_record
from app.dependencies import require_admin_user
from app.main import app


def _override_admin():
    return None


def test_resolver_prefers_verified_domain(db_session, event_loop: asyncio.AbstractEventLoop) -> None:
    async def _prepare() -> str:
        tenant = Tenant(slug="demo-otel", name="Demo Otel", plan="standard", is_active=True)
        db_session.add(tenant)
        await db_session.flush()
        domain = TenantDomain(
            tenant_id=tenant.id,
            domain="panel.demo-otel.com",
            domain_type=TenantDomainType.CUSTOM_DOMAIN.value,
            status=TenantDomainStatus.VERIFIED.value,
            verification_method="DNS_TXT",
            is_primary=True,
        )
        db_session.add(domain)
        await db_session.commit()
        return tenant.id

    tenant_id = event_loop.run_until_complete(_prepare())
    resolved = event_loop.run_until_complete(resolve_tenant_by_domain_record("panel.demo-otel.com"))
    assert resolved is not None
    assert resolved.id == tenant_id


def test_verify_start_and_check_flow(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _prepare() -> str:
        tenant = Tenant(slug="verify-otel", name="Verify Otel", plan="standard", is_active=True)
        db_session.add(tenant)
        await db_session.flush()
        admin_user = User(
            email="admin@test.com",
            password_hash=get_password_hash("Admin!2025"),
            role=UserRole.SUPER_ADMIN.value,
            is_active=True,
        )
        db_session.add(admin_user)
        await db_session.commit()
        return tenant.id

    tenant_id = event_loop.run_until_complete(_prepare())

    app.dependency_overrides[require_admin_user] = _override_admin

    response = event_loop.run_until_complete(
        client.post(
            f"/admin/tenants/{tenant_id}/domains",
            json={"domain": "panel.verify-otel.com", "domain_type": "CUSTOM_DOMAIN", "is_primary": False},
        )
    )
    assert response.status_code == 201, response.text
    domain_id = response.json()["id"]

    start_response = event_loop.run_until_complete(
        client.post(f"/admin/tenants/{tenant_id}/domains/{domain_id}/verify/start")
    )
    assert start_response.status_code == 200, start_response.text
    start_payload = start_response.json()
    assert start_payload["verification_record_name"].startswith("_kyradi-verify.")
    assert start_payload["verification_token"]

    monkeypatch.setattr("app.api.routes.admin_tenant_domains.lookup_txt_record", lambda *_: True)

    check_response = event_loop.run_until_complete(
        client.post(f"/admin/tenants/{tenant_id}/domains/{domain_id}/verify/check")
    )
    assert check_response.status_code == 200, check_response.text
    check_payload = check_response.json()
    assert check_payload["verified"] is True

    app.dependency_overrides.pop(require_admin_user, None)
