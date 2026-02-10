"""Integration endpoints (server-to-server).

Minimal additions only. No schema changes, no refactors.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.dependencies.auth import require_admin_user
from app.models import Reservation, Storage, User
from app.services.superapp_integration import (
    SIGNATURE_HEADER,
    extract_external_reservation_id,
    post_status_update,
    verify_signature,
)

logger = logging.getLogger("kyradi.api.integrations")

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class IntegrationCustomer(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class IntegrationReservationCreatePayload(BaseModel):
    externalReservationId: str = Field(..., min_length=1)
    paid: bool = False
    tenantId: Optional[str] = None
    storageId: Optional[str] = None
    lockerId: Optional[str] = None
    storageUnit: Optional[str] = None
    startAt: Optional[datetime] = None
    endAt: Optional[datetime] = None
    customer: Optional[IntegrationCustomer] = None
    notes: Optional[str] = None


class IntegrationAssignPayload(BaseModel):
    storageUnit: Optional[str] = None
    storageId: Optional[str] = None
    lockerId: Optional[str] = None
    operatorName: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None


async def require_integration_signature(request: Request) -> bytes:
    if not settings.superapp_integration_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integration not configured",
        )

    raw = await request.body()
    sig = request.headers.get(SIGNATURE_HEADER)
    if not verify_signature(settings.superapp_integration_secret, raw, sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    return raw


async def _resolve_tenant_id(request: Request, payload_tenant_id: Optional[str]) -> Optional[str]:
    tenant_id = getattr(request.state, "tenant_id", None)
    if tenant_id:
        return tenant_id
    if payload_tenant_id:
        return payload_tenant_id
    return None


async def _resolve_storage_id(session: AsyncSession, tenant_id: str, payload: IntegrationReservationCreatePayload) -> Optional[str]:
    storage_id = payload.storageId or payload.lockerId or payload.storageUnit
    if storage_id:
        storage = await session.get(Storage, storage_id)
        if storage and storage.tenant_id == tenant_id:
            return storage.id
        raise HTTPException(status_code=400, detail="Invalid storageId for tenant")

    stmt = select(Storage.id).where(Storage.tenant_id == tenant_id).order_by(Storage.created_at.asc()).limit(1)
    return (await session.execute(stmt)).scalar_one_or_none()


def _integration_notes(external_id: str, extra: Optional[str]) -> str:
    parts = [f"SUPERAPP_EXTERNAL_RES_ID:{external_id}"]
    if extra:
        parts.append(extra.strip())
    return "\n".join(parts)


@router.post("/reservations", status_code=status.HTTP_201_CREATED)
async def create_reservation_from_superapp(
    request: Request,
    payload: IntegrationReservationCreatePayload,
    _: bytes = Depends(require_integration_signature),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    tenant_id = await _resolve_tenant_id(request, payload.tenantId)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id_required")

    storage_id = await _resolve_storage_id(session, tenant_id, payload)
    if not storage_id:
        raise HTTPException(status_code=400, detail="no_storage_available")

    now = datetime.now(timezone.utc)
    start_at = payload.startAt or now
    end_at = payload.endAt or (start_at + timedelta(hours=1))

    cust = payload.customer or IntegrationCustomer()
    res = Reservation(
        tenant_id=tenant_id,
        storage_id=storage_id,
        customer_name=cust.name,
        full_name=cust.name,
        customer_email=cust.email,
        customer_phone=cust.phone,
        phone_number=cust.phone,
        start_at=start_at,
        end_at=end_at,
        amount_minor=0,
        currency="TRY",
        baggage_count=1,
        notes=_integration_notes(payload.externalReservationId, payload.notes),
    )
    session.add(res)
    await session.commit()
    await session.refresh(res)

    logger.info("Integration reservation created id=%s tenant_id=%s", res.id, tenant_id)
    return {"id": res.id, "tenant_id": tenant_id, "storage_id": storage_id}


@router.put("/reservations/{reservation_id}/assign")
async def assign_reservation_and_notify(
    reservation_id: str,
    payload: IntegrationAssignPayload,
    background: BackgroundTasks,
    _: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    res = await session.get(Reservation, reservation_id)
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")

    storage_id = payload.storageId or payload.lockerId or payload.storageUnit
    if storage_id:
        storage = await session.get(Storage, storage_id)
        if not storage or storage.tenant_id != res.tenant_id:
            raise HTTPException(status_code=400, detail="Invalid storageId for reservation tenant")
        res.storage_id = storage.id

    if payload.operatorName:
        res.notes = (res.notes or "").rstrip() + f"\nSUPERAPP_OPERATOR:{payload.operatorName}"

    if payload.note:
        res.notes = (res.notes or "").rstrip() + f"\nSUPERAPP_NOTE:{payload.note}"

    await session.commit()
    await session.refresh(res)

    external_id = extract_external_reservation_id(res.notes)
    if external_id:
        out = {
            "reservationId": external_id,
            "status": payload.status or "assigned",
            "storageUnit": res.storage_id,
            "operator": {"name": payload.operatorName},
            "note": payload.note,
        }
        background.add_task(
            post_status_update,
            payload=out,
            timeout_ms=settings.integration_timeout_ms,
            retry_count=settings.integration_retry_count,
        )

    logger.info("Integration reservation assigned id=%s tenant_id=%s", res.id, res.tenant_id)
    return {"id": res.id, "tenant_id": res.tenant_id, "storage_id": res.storage_id}
