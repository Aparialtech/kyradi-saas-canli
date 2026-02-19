"""Public (unauthenticated) endpoints for self-service flows."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from ...db.session import get_session
from ...models import Location, Reservation, Storage, Tenant

# Backward compatibility
Locker = Storage
from ...schemas import (
    SelfServiceReservationRequest,
    SelfServiceReservationResponse,
    SelfServiceReservationCreateRequest,
    SelfServiceReservationCreateResponse,
    ReservationCreate,
    ReservationHandoverRequest,
    ReservationReturnRequest,
)
from ...services.reservations import (
    create_reservation as create_reservation_service,
    mark_reservation_handover,
    mark_reservation_returned,
)
from ...core.config import settings
from ...schemas import LegalTextsResponse
from ...services.limits import get_plan_limits_for_tenant, self_service_reservations_last24h

router = APIRouter(prefix="/public", tags=["public"])


def _mask_name(name: str | None) -> str | None:
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    if len(name) <= 2:
        return name[0] + "*"
    parts = name.split()
    masked_parts = [part[0] + "***" for part in parts]
    return " ".join(masked_parts)


async def _get_reservation_by_code(
    session: AsyncSession,
    code: str,
) -> tuple[Reservation, Storage, Location, Tenant] | None:
    stmt = (
        select(Reservation, Storage, Location, Tenant)
        .join(Storage, Reservation.storage_id == Storage.id)
        .join(Location, Storage.location_id == Location.id)
        .join(Tenant, Reservation.tenant_id == Tenant.id)
        .where(Reservation.qr_code == code)
    )
    result = await session.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return row


@router.post("/reservations/lookup", response_model=SelfServiceReservationResponse)
async def lookup_reservation(
    payload: SelfServiceReservationRequest,
    session: AsyncSession = Depends(get_session),
) -> SelfServiceReservationResponse:
    """Return limited reservation details for self-service QR journeys."""
    data = await _get_reservation_by_code(session, payload.code)
    if data is None:
        return SelfServiceReservationResponse(status="not_found", valid=False)
    reservation, storage, location, tenant = data
    masked_name = _mask_name(reservation.customer_name)
    return SelfServiceReservationResponse(
        reservation_id=reservation.id,
        tenant_slug=tenant.slug,
        locker_code=storage.code,  # Backward compatibility: field name stays locker_code
        location_name=location.name,
        status=reservation.status,
        start_at=reservation.start_at,
        end_at=reservation.end_at,
        customer_hint=masked_name,
        customer_phone=reservation.customer_phone,
        baggage_count=reservation.baggage_count,
        baggage_type=reservation.baggage_type,
        notes=reservation.notes,
        evidence_url=reservation.evidence_url,
        handover_by=reservation.handover_by,
        handover_at=reservation.handover_at,
        returned_by=reservation.returned_by,
        returned_at=reservation.returned_at,
        valid=True,
    )


@router.post("/reservations", response_model=SelfServiceReservationCreateResponse, status_code=201)
async def create_self_service_reservation(
    payload: SelfServiceReservationCreateRequest,
    session: AsyncSession = Depends(get_session),
) -> SelfServiceReservationCreateResponse:
    """Allow customers to create a reservation via QR/self-service flow."""
    tenant_result = await session.execute(
        select(Tenant).where(Tenant.slug == payload.tenant_slug, Tenant.is_active.is_(True))
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found or inactive")

    storage_result = await session.execute(
        select(Storage).where(
            Storage.tenant_id == tenant.id,
            Storage.code == payload.locker_code,  # Backward compatibility: field name stays locker_code
        )
    )
    storage = storage_result.scalar_one_or_none()
    if storage is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage not found")

    if storage.status != "idle":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Storage is not available")

    limits = await get_plan_limits_for_tenant(session, tenant.id)
    if limits.max_self_service_daily is not None:
        recent_self_service = await self_service_reservations_last24h(session, tenant.id)
        if recent_self_service >= limits.max_self_service_daily:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Plan limit reached: maximum self-service reservations in last 24h",
            )

    reservation_payload = ReservationCreate(
        storage_id=storage.id,
        start_at=payload.start_at,
        end_at=payload.end_at,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        baggage_count=payload.baggage_count,
        baggage_type=payload.baggage_type,
        weight_kg=payload.weight_kg,
        notes=payload.notes,
    )

    try:
        reservation = await create_reservation_service(
            session,
            tenant_id=tenant.id,
            storage=storage,
            payload=reservation_payload,
            actor_user_id=None,
            source="self_service",
        )
    except ValueError as exc:
        message = str(exc)
        logger.warning(f"ValueError in self-service reservation creation: {message} (tenant={tenant.slug})")
        if "Plan limit" in message:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message) from exc
        if "Storage already reserved" in message or "Locker already reserved" in message:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc

    return SelfServiceReservationCreateResponse(
        reservation_id=reservation.id,
        qr_code=reservation.qr_code or "",
        status=reservation.status,
        locker_code=storage.code,  # Backward compatibility: field name stays locker_code
        start_at=reservation.start_at,
        end_at=reservation.end_at,
    )


@router.post("/reservations/{code}/handover", response_model=SelfServiceReservationResponse)
async def self_handover_reservation(
    code: str,
    payload: ReservationHandoverRequest,
    session: AsyncSession = Depends(get_session),
) -> SelfServiceReservationResponse:
    """Allow customer to confirm handover via QR."""
    data = await _get_reservation_by_code(session, code)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    reservation, storage, location, tenant = data
    try:
        updated = await mark_reservation_handover(
            session,
            reservation=reservation,
            actor_user_id=None,
            handover_by=payload.handover_by or "self_service",
            handover_at=payload.handover_at,
            evidence_url=payload.evidence_url,
            notes=payload.notes,
            source="self_service",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return SelfServiceReservationResponse(
        reservation_id=updated.id,
        tenant_slug=tenant.slug,
        locker_code=storage.code,  # Backward compatibility: field name stays locker_code
        location_name=location.name,
        status=updated.status,
        start_at=updated.start_at,
        end_at=updated.end_at,
        customer_hint=_mask_name(updated.customer_name),
        customer_phone=updated.customer_phone,
        baggage_count=updated.baggage_count,
        baggage_type=updated.baggage_type,
        notes=updated.notes,
        evidence_url=updated.evidence_url,
        handover_by=updated.handover_by,
        handover_at=updated.handover_at,
        returned_by=updated.returned_by,
        returned_at=updated.returned_at,
        valid=True,
    )


@router.post("/reservations/{code}/return", response_model=SelfServiceReservationResponse)
async def self_return_reservation(
    code: str,
    payload: ReservationReturnRequest,
    session: AsyncSession = Depends(get_session),
) -> SelfServiceReservationResponse:
    """Allow customer to confirm pickup/return via QR."""
    data = await _get_reservation_by_code(session, code)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    reservation, storage, location, tenant = data
    try:
        updated = await mark_reservation_returned(
            session,
            reservation=reservation,
            actor_user_id=None,
            returned_by=payload.returned_by or "self_service",
            returned_at=payload.returned_at,
            evidence_url=payload.evidence_url,
            notes=payload.notes,
            source="self_service",
        )
    except ValueError as exc:
        logger.warning(f"ValueError in self-service return: {str(exc)} (code={code})")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return SelfServiceReservationResponse(
        reservation_id=updated.id,
        tenant_slug=tenant.slug,
        locker_code=storage.code,  # Backward compatibility: field name stays locker_code
        location_name=location.name,
        status=updated.status,
        start_at=updated.start_at,
        end_at=updated.end_at,
        customer_hint=_mask_name(updated.customer_name),
        customer_phone=updated.customer_phone,
        baggage_count=updated.baggage_count,
        baggage_type=updated.baggage_type,
        notes=updated.notes,
        evidence_url=updated.evidence_url,
        handover_by=updated.handover_by,
        handover_at=updated.handover_at,
        returned_by=updated.returned_by,
        returned_at=updated.returned_at,
        valid=True,
    )


@router.get("/legal-texts", response_model=LegalTextsResponse)
async def legal_texts() -> LegalTextsResponse:
    """Return texts required for KVKK, Aydınlatma, and Terms displays."""
    return LegalTextsResponse(
        kvkk_text=settings.kvkk_text,
        aydinlatma_text=settings.aydinlatma_text,
        terms_text=settings.terms_text,
    )
