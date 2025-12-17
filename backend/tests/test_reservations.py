import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select

from app.models import AuditLog, Location, Locker, LockerStatus, ReservationStatus, Tenant
from app.schemas import ReservationCreate
from app.services.reservations import (
    create_reservation,
    mark_reservation_handover,
    mark_reservation_returned,
)


async def _create_active_reservation(session):
    tenant = (
        await session.execute(select(Tenant).where(Tenant.slug == "demo-hotel"))
    ).scalar_one()

    location = Location(
        tenant_id=tenant.id,
        name=f"Test Lokasyon {uuid4().hex[:6]}",
        address="Test adres",
    )
    session.add(location)
    await session.flush()

    locker = Locker(
        tenant_id=tenant.id,
        location_id=location.id,
        code=f"TC-{uuid4().hex[:6]}",
        status=LockerStatus.IDLE.value,
    )
    session.add(locker)
    await session.flush()

    start_at = datetime.now(timezone.utc)
    payload = ReservationCreate(
        locker_id=locker.id,
        start_at=start_at,
        end_at=start_at + timedelta(hours=4),
        customer_name="Test Misafir",
        baggage_count=1,
        notes="Ön not",
    )

    reservation = await create_reservation(
        session,
        tenant_id=tenant.id,
        locker=locker,
        payload=payload,
        actor_user_id="tester",
        source="partner",
    )
    return reservation


def test_mark_reservation_handover_records_audit(
    db_session,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    reservation = event_loop.run_until_complete(_create_active_reservation(db_session))

    updated = event_loop.run_until_complete(
        mark_reservation_handover(
            db_session,
            reservation=reservation,
            actor_user_id="tester",
            handover_by="staff@demo.com",
            handover_at=None,
            evidence_url="https://example.com/handover.jpg",
            notes="Teslim sırasında kontrol edildi",
        )
    )

    assert updated.handover_by == "staff@demo.com"
    assert updated.handover_at is not None
    assert updated.status == ReservationStatus.ACTIVE.value
    assert updated.notes == "Teslim sırasında kontrol edildi"

    audit = event_loop.run_until_complete(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "reservation.handover",
                AuditLog.entity_id == reservation.id,
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.meta_json is not None
    assert audit.meta_json.get("handover_by") == "staff@demo.com"


def test_mark_reservation_returned_completes_reservation(
    db_session,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    reservation = event_loop.run_until_complete(_create_active_reservation(db_session))

    updated = event_loop.run_until_complete(
        mark_reservation_returned(
            db_session,
            reservation=reservation,
            actor_user_id="tester",
            returned_by="guest@example.com",
            returned_at=None,
            evidence_url="https://example.com/return.jpg",
            notes="Bavul eksiksiz teslim aldı",
        )
    )

    assert updated.status == ReservationStatus.COMPLETED.value
    assert updated.returned_by == "guest@example.com"
    assert updated.returned_at is not None
    assert updated.notes == "Bavul eksiksiz teslim aldı"

    audit = event_loop.run_until_complete(
        db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "reservation.return",
                AuditLog.entity_id == reservation.id,
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.meta_json is not None
    assert audit.meta_json.get("returned_by") == "guest@example.com"
