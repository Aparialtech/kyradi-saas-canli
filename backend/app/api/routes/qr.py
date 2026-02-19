"""QR verification endpoint."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...db.session import get_session
from ...dependencies import require_tenant_staff
from ...models import Reservation, ReservationStatus, Storage, User
from ...schemas import QRVerifyRequest, QRVerifyResponse

router = APIRouter(prefix="/qr", tags=["qr"])


def _serialize_reservation(
    reservation: Reservation,
    *,
    valid: bool,
    status_override: str | None = None,
) -> QRVerifyResponse:
    storage = getattr(reservation, "storage", None)
    location = getattr(storage, "location", None) if storage else None
    return QRVerifyResponse(
        valid=valid,
        reservation_id=reservation.id,
        locker_id=reservation.locker_id,
        storage_id=storage.id if storage else None,
        storage_code=getattr(storage, "code", None) if storage else None,
        location_id=getattr(location, "id", None) if location else None,
        location_name=getattr(location, "name", None) if location else None,
        status=status_override or reservation.status,
        status_override=status_override,
        customer_name=reservation.customer_name,
        full_name=reservation.full_name,
        customer_phone=reservation.customer_phone,
        phone_number=reservation.phone_number,
        customer_email=reservation.customer_email,
        tc_identity_number=reservation.tc_identity_number,
        passport_number=reservation.passport_number,
        hotel_room_number=reservation.hotel_room_number,
        start_at=reservation.start_at,
        end_at=reservation.end_at,
        qr_code=reservation.qr_code,
        baggage_count=reservation.baggage_count,
        baggage_type=reservation.baggage_type,
        weight_kg=reservation.weight_kg,
        notes=reservation.notes,
        evidence_url=reservation.evidence_url,
        handover_by=reservation.handover_by,
        handover_at=reservation.handover_at,
        returned_by=reservation.returned_by,
        returned_at=reservation.returned_at,
    )


@router.post("/verify", response_model=QRVerifyResponse)
async def verify_qr_code(
    payload: QRVerifyRequest,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> QRVerifyResponse:
    """Validate reservation QR codes.
    
    Returns reservation details for any status - allows viewing info regardless of validity.
    The 'valid' field indicates if the reservation is currently actionable (active & not expired).
    
    Possible responses:
    - valid=False, status="not_found" - QR code not found in this tenant
    - valid=False, status="cancelled" - Reservation was cancelled
    - valid=False, status="completed" - Reservation is completed
    - valid=False, status="expired" - Reservation time has passed
    - valid=False, status="reserved" - Reservation not yet checked in
    - valid=False, status="no_show" - Customer did not show up
    - valid=False, status="lost" - Item marked as lost
    - valid=True, status="active" - Active and actionable reservation
    """
    stmt = (
        select(Reservation)
        .options(
            selectinload(Reservation.storage).selectinload(Storage.location)
        )
        .where(
            Reservation.qr_code == payload.code,
            Reservation.tenant_id == current_user.tenant_id,
        )
    )
    reservation = (await session.execute(stmt)).scalar_one_or_none()
    
    # QR code not found - return minimal info
    if reservation is None:
        return QRVerifyResponse(
            valid=False,
            status="not_found",
            status_override="not_found",
            reservation_id=None,
            locker_id=None,
        )

    # Always return full reservation details, but mark validity based on status
    status = reservation.status
    
    # Check if reservation is cancelled
    if status == ReservationStatus.CANCELLED.value:
        return _serialize_reservation(reservation, valid=False, status_override="cancelled")
    
    # Check if reservation is completed
    if status == ReservationStatus.COMPLETED.value:
        return _serialize_reservation(reservation, valid=False, status_override="completed")
    
    # Check if reservation is reserved (not yet active/checked in)
    if status == ReservationStatus.RESERVED.value:
        return _serialize_reservation(reservation, valid=False, status_override="reserved")
    
    # Check for other non-active statuses (no_show, lost, etc.)
    if status != ReservationStatus.ACTIVE.value:
        # Return with the actual status as override for proper error messaging
        return _serialize_reservation(reservation, valid=False, status_override=status)

    # Check if reservation has expired (end_at in the past)
    if reservation.end_at and reservation.end_at < datetime.now(timezone.utc):
        return _serialize_reservation(reservation, valid=False, status_override="expired")

    # Reservation is active and valid
    return _serialize_reservation(reservation, valid=True)
