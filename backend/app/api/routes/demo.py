"""Demo flow endpoints for testing the complete reservation → payment → settlement flow.

Bu modül demo akışı için test endpoint'leri sağlar.

PAYMENT DUPLICATE KORUMASI:
- Tüm payment işlemleri payment_service.get_or_create_payment üzerinden yapılır
- link_payment_to_reservation ile duplicate linking engellenir
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_staff
from ...models import Payment, PaymentStatus, Reservation, ReservationStatus, Storage, StorageStatus, User
from ...schemas import StorageRead
from ...services.payment_providers import get_payment_provider, FakePaymentProvider
from ...services.payment_service import get_existing_payment, link_payment_to_reservation
from ...services.revenue import calculate_settlement, mark_settlement_completed
from ...services.storage_availability import is_storage_available
from ...services.widget_conversion import convert_widget_reservation_to_reservation

router = APIRouter(prefix="/demo", tags=["demo"])
logger = logging.getLogger(__name__)


@router.get("/available-storages", response_model=List[StorageRead])
async def list_available_storages(
    start_at: datetime = Query(..., description="Reservation start datetime"),
    end_at: datetime = Query(..., description="Reservation end datetime"),
    preferred_location_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> List[StorageRead]:
    """Return storages that are available for the provided time window."""
    if start_at >= end_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_at must be before end_at")

    stmt = select(Storage).where(Storage.tenant_id == current_user.tenant_id)
    if preferred_location_id:
        stmt = stmt.where(Storage.location_id == preferred_location_id)
    stmt = stmt.order_by(Storage.created_at.asc())

    result = await session.execute(stmt)
    storages = result.scalars().all()

    available: List[StorageRead] = []
    for storage in storages:
        if storage.status == StorageStatus.FAULTY.value:
            continue
        if storage.status == StorageStatus.IDLE.value:
            available.append(StorageRead.model_validate(storage))
            continue
        if await is_storage_available(
            session,
            storage_id=storage.id,
            start_datetime=start_at,
            end_datetime=end_at,
        ):
            available.append(StorageRead.model_validate(storage))

    logger.debug(
        f"Available storages for {start_at} - {end_at}: {len(available)} out of {len(storages)}"
    )
    return available



@router.post("/payments/{payment_intent_id}/simulate", response_model=Dict[str, Any])
async def simulate_payment_success(
    payment_intent_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Simulate successful payment for demo purposes.
    
    This endpoint:
    1. Finds the payment by intent_id
    2. Updates payment status to CAPTURED
    3. Creates settlement record
    4. Marks settlement as settled
    5. Updates storage status
    
    Use this for testing the complete flow without actual payment gateway.
    """
    logger.info(
        f"Simulate payment request: intent_id={payment_intent_id}, "
        f"user={current_user.email}, tenant={current_user.tenant_id}"
    )
    
    # Find payment by provider_intent_id
    stmt = select(Payment).where(
        Payment.provider_intent_id == payment_intent_id,
        Payment.tenant_id == current_user.tenant_id,
    )
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()
    
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    
    if payment.status in [PaymentStatus.CAPTURED.value, PaymentStatus.PAID.value]:
        logger.info(f"Payment {payment.id} already completed with status={payment.status}")
        return {
            "ok": True,
            "message": "Payment already captured",
            "payment_id": payment.id,
            "status": payment.status,
        }
    
    # Update payment status
    payment.status = PaymentStatus.CAPTURED.value
    await session.flush()
    
    # If payment doesn't have reservation_id, try to link it
    if not payment.reservation_id and payment.meta:
        widget_reservation_id = payment.meta.get("widget_reservation_id")
        if widget_reservation_id:
            from reservations.models import WidgetReservation
            widget_reservation = await session.get(WidgetReservation, widget_reservation_id)
            if widget_reservation and widget_reservation.status == "converted":
                # Try to find the converted reservation
                stmt_res = select(Reservation).where(
                    Reservation.tenant_id == current_user.tenant_id,
                ).order_by(Reservation.created_at.desc()).limit(1)
                result_res = await session.execute(stmt_res)
                latest_reservation = result_res.scalar_one_or_none()
                if latest_reservation:
                    # Use helper to safely link payment
                    linked_payment = await link_payment_to_reservation(
                        session,
                        payment_id=payment.id,
                        reservation_id=latest_reservation.id,
                    )
                    if linked_payment:
                        logger.info(
                            f"Linked payment {payment.id} to reservation {latest_reservation.id}"
                        )
    
    # Create settlement if not exists
    from ...models import Settlement
    existing_settlement_stmt = select(Settlement).where(Settlement.payment_id == payment.id)
    existing_settlement_result = await session.execute(existing_settlement_stmt)
    settlement = existing_settlement_result.scalar_one_or_none()
    
    if settlement is None:
        # If payment has no reservation_id, create settlement without reservation
        if not payment.reservation_id:
            # Create settlement without reservation (for widget flow where payment is created first)
            total_amount_minor = payment.amount_minor
            commission_minor = int(total_amount_minor * 5.0 / 100.0)
            tenant_settlement_minor = total_amount_minor - commission_minor
            
            settlement = Settlement(
                tenant_id=payment.tenant_id,
                payment_id=payment.id,
                reservation_id=None,  # Will be updated later when reservation is created
                total_amount_minor=total_amount_minor,
                tenant_settlement_minor=tenant_settlement_minor,
                kyradi_commission_minor=commission_minor,
                currency=payment.currency,
                status="pending",
                commission_rate=5.0,
            )
            session.add(settlement)
            await session.flush()
            logger.info(f"Created settlement {settlement.id} without reservation")
        else:
            # Create settlement with default 5% commission
            settlement = await calculate_settlement(session, payment, commission_rate=5.0)
            await session.flush()
            logger.info(f"Created settlement {settlement.id} for reservation {payment.reservation_id}")
    
    # Mark settlement as settled (use flush instead of commit to avoid double commit)
    settlement.status = "settled"
    from datetime import datetime, timezone
    settlement.settled_at = datetime.now(timezone.utc)
    await session.flush()
    
    await session.commit()
    
    logger.info(
        f"Demo payment simulated: payment_id={payment.id}, "
        f"amount={payment.amount_minor}, settlement_id={settlement.id}"
    )
    
    return {
        "ok": True,
        "message": "Payment simulated successfully",
        "payment_id": payment.id,
        "payment_status": payment.status,
        "settlement_id": settlement.id,
        "settlement_status": settlement.status,
        "total_amount": settlement.total_amount,
        "tenant_settlement": settlement.tenant_settlement,
        "kyradi_commission": settlement.kyradi_commission,
    }


@router.post("/widget-reservations/{widget_reservation_id}/convert", response_model=Dict[str, Any])
async def convert_widget_to_reservation(
    widget_reservation_id: int,
    storage_id: str | None = None,
    preferred_location_id: str | None = None,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Convert a WidgetReservation to a normal Reservation with storage assignment.
    
    Bu endpoint:
    1. WidgetReservation'ı bulur
    2. Uygun storage bulur/atar
    3. Normal Reservation oluşturur
    4. Storage durumunu OCCUPIED yapar
    5. Payment oluşturur (widget_conversion içinde, duplicate yok!)
    
    PAYMENT DUPLICATE KORUMASI:
    - Payment oluşturma widget_conversion.convert_widget_reservation_to_reservation
      içinde yapılır
    - get_or_create_payment kullanılır
    - Duplicate INSERT yapılmaz
    """
    logger.info(
        f"Convert widget reservation request: widget_id={widget_reservation_id}, "
        f"storage_id={storage_id}, user={current_user.email}"
    )
    
    try:
        reservation = await convert_widget_reservation_to_reservation(
            session,
            widget_reservation_id=widget_reservation_id,
            tenant_id=current_user.tenant_id,
            storage_id=storage_id,
            preferred_location_id=preferred_location_id,
        )
        await session.flush()
        
        # Check if payment was created by conversion
        payment = await get_existing_payment(session, reservation.id)
        
        if payment:
            logger.info(
                f"Found payment {payment.id} for reservation {reservation.id} "
                f"(created by conversion)"
            )
        else:
            logger.warning(
                f"No payment found for reservation {reservation.id} after conversion"
            )
        
        await session.commit()
        
        logger.info(
            f"Widget reservation converted: widget_id={widget_reservation_id}, "
            f"reservation_id={reservation.id}, storage_id={reservation.storage_id}, "
            f"payment_id={payment.id if payment else None}"
        )
        
        return {
            "ok": True,
            "message": "Widget reservation converted successfully",
            "widget_reservation_id": widget_reservation_id,
            "reservation_id": reservation.id,
            "storage_id": reservation.storage_id,
            "status": reservation.status,
            "payment_id": payment.id if payment else None,
            "payment_status": payment.status if payment else None,
        }
    except ValueError as exc:
        await session.rollback()
        error_msg = str(exc)
        logger.error(f"ValueError in widget conversion: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        ) from exc
    except Exception as exc:
        await session.rollback()
        import traceback
        error_detail = str(exc)
        logger.error(f"Unexpected error in widget conversion: {error_detail}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conversion failed: {error_detail}",
        ) from exc
