import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select

from app.models import AuditLog, Location, Locker, LockerStatus, Reservation, Tenant, User
from app.schemas import ReservationCreate
from app.services.reservations import create_reservation


async def _bootstrap_reservation(db_session):
    tenant = (
        await db_session.execute(select(Tenant).where(Tenant.slug == "demo-hotel"))
    ).scalar_one()

    admin_user = (
        await db_session.execute(select(User).where(User.email == "admin@demo.com"))
    ).scalar_one()

    location = Location(
        tenant_id=tenant.id,
        name=f"Test Lokasyon {uuid4().hex[:6]}",
        address="Test adres",
    )
    db_session.add(location)
    await db_session.flush()

    locker = Locker(
        tenant_id=tenant.id,
        location_id=location.id,
        code=f"T-{uuid4().hex[:6]}",
        status=LockerStatus.IDLE.value,
    )
    db_session.add(locker)
    await db_session.flush()

    start_at = datetime.now(timezone.utc)
    reservation = await create_reservation(
        db_session,
        tenant_id=tenant.id,
        locker=locker,
        payload=ReservationCreate(
            locker_id=locker.id,
            start_at=start_at,
            end_at=start_at + timedelta(hours=4),
            customer_name="API Test Misafir",
        ),
        actor_user_id=admin_user.id,
        source="partner",
    )
    return reservation


async def _override_plan_limits(db_session, tenant_id: str, overrides: dict) -> None:
    tenant = await db_session.get(Tenant, tenant_id)
    if tenant is None:
        return
    base_plan = tenant.plan.split("::")[0]
    tenant.plan = f"{base_plan}::custom"
    metadata = tenant.metadata_ or {}
    metadata.setdefault("plan_limits", {})
    metadata["plan_limits"].update(overrides)
    tenant.metadata_ = metadata
    await db_session.commit()


async def _create_additional_locker(db_session, tenant_id: str, location_id: str | None = None) -> Locker:
    if location_id is None:
        location = Location(
            tenant_id=tenant_id,
            name=f"Ek Lokasyon {uuid4().hex[:6]}",
            address="Test",
        )
        db_session.add(location)
        await db_session.flush()
        location_id = location.id
    locker = Locker(
        tenant_id=tenant_id,
        location_id=location_id,
        code=f"E-{uuid4().hex[:6]}",
        status=LockerStatus.IDLE.value,
    )
    db_session.add(locker)
    await db_session.flush()
    await db_session.commit()
    await db_session.refresh(locker)
    return locker


async def _login_partner(client: AsyncClient) -> str:
    response = await client.post(
        "/auth/login",
        json={
            "email": "admin@demo.com",
            "password": "Kyradi!2025",
            "tenant_slug": "demo-hotel",
        },
    )
    assert response.status_code == 200
    data = response.json()
    return data["access_token"]


def test_partner_handover_and_return_flow(
    client: AsyncClient,
    db_session,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    reservation = event_loop.run_until_complete(_bootstrap_reservation(db_session))
    token = event_loop.run_until_complete(_login_partner(client))
    headers = {"Authorization": f"Bearer {token}"}

    handover_response = event_loop.run_until_complete(
        client.post(
            f"/reservations/{reservation.id}/handover",
            json={"notes": "Test handover", "evidence_url": "https://example.com/handover.jpg"},
            headers=headers,
        )
    )
    assert handover_response.status_code == 200
    handover_data = handover_response.json()
    assert handover_data["handover_by"]
    assert handover_data["handover_at"] is not None

    updated_reservation = event_loop.run_until_complete(db_session.get(Reservation, reservation.id))
    assert updated_reservation is not None
    assert updated_reservation.handover_by == handover_data["handover_by"]

    handover_audit = event_loop.run_until_complete(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "reservation.handover",
                AuditLog.entity_id == reservation.id,
            )
        )
    ).scalar_one_or_none()
    assert handover_audit is not None

    return_response = event_loop.run_until_complete(
        client.post(
            f"/reservations/{reservation.id}/return",
            json={"notes": "Çıkış tamamlandı", "evidence_url": "https://example.com/return.jpg"},
            headers=headers,
        )
    )
    assert return_response.status_code == 200
    return_data = return_response.json()
    assert return_data["status"] == "completed"
    assert return_data["returned_at"] is not None

    completed_reservation = event_loop.run_until_complete(db_session.get(Reservation, reservation.id))
    assert completed_reservation is not None
    assert completed_reservation.status == "completed"

    return_audit = event_loop.run_until_complete(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "reservation.return",
                AuditLog.entity_id == reservation.id,
            )
        )
    ).scalar_one_or_none()
    assert return_audit is not None


def test_self_service_handover_and_return_flow(
    client: AsyncClient,
    db_session,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    reservation = event_loop.run_until_complete(_bootstrap_reservation(db_session))
    qr_code = reservation.qr_code
    assert qr_code

    handover_response = event_loop.run_until_complete(
        client.post(
            f"/public/reservations/{qr_code}/handover",
            json={"handover_by": "self-service", "notes": "Bıraktım"},
        )
    )
    assert handover_response.status_code == 200
    handover_data = handover_response.json()
    assert handover_data["handover_by"] == "self-service"

    updated = event_loop.run_until_complete(db_session.get(Reservation, reservation.id))
    assert updated is not None
    assert updated.handover_by == "self-service"

    return_response = event_loop.run_until_complete(
        client.post(
            f"/public/reservations/{qr_code}/return",
            json={"returned_by": "guest", "notes": "Aldım"},
        )
    )
    assert return_response.status_code == 200
    return_data = return_response.json()
    assert return_data["status"] == "completed"
    assert return_data["returned_by"] == "guest"

    completed = event_loop.run_until_complete(db_session.get(Reservation, reservation.id))
    assert completed is not None
    assert completed.status == "completed"

    handover_audit = event_loop.run_until_complete(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "reservation.handover",
                AuditLog.entity_id == reservation.id,
            )
        )
    ).scalar_one_or_none()
    return_audit = event_loop.run_until_complete(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "reservation.return",
                AuditLog.entity_id == reservation.id,
            )
        )
    ).scalar_one_or_none()
    assert handover_audit is not None
    assert return_audit is not None


def test_total_reservation_limit_enforced(
    client: AsyncClient,
    db_session,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    reservation = event_loop.run_until_complete(_bootstrap_reservation(db_session))
    tenant_id = reservation.tenant_id
    event_loop.run_until_complete(_override_plan_limits(db_session, tenant_id, {"max_reservations_total": 1}))

    extra_locker = event_loop.run_until_complete(_create_additional_locker(db_session, tenant_id))

    token = event_loop.run_until_complete(_login_partner(client))
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "locker_id": extra_locker.id,
        "start_at": reservation.start_at.isoformat(),
        "end_at": (reservation.end_at + timedelta(hours=1)).isoformat(),
    }
    response = event_loop.run_until_complete(client.post("/reservations", json=payload, headers=headers))
    assert response.status_code == 403
    assert "Plan limit" in response.json()["detail"]


def test_report_export_limit_enforced(
    client: AsyncClient,
    db_session,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    reservation = event_loop.run_until_complete(_bootstrap_reservation(db_session))
    tenant_id = reservation.tenant_id
    event_loop.run_until_complete(_override_plan_limits(db_session, tenant_id, {"max_report_exports_daily": 1}))

    token = event_loop.run_until_complete(_login_partner(client))
    headers = {"Authorization": f"Bearer {token}"}

    first = event_loop.run_until_complete(client.post("/reports/reservations/export-log", headers=headers))
    assert first.status_code == 200

    second = event_loop.run_until_complete(client.post("/reports/reservations/export-log", headers=headers))
    assert second.status_code == 403
