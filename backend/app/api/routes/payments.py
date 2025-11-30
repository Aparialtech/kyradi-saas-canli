"""Payment intent endpoint."""

from uuid import uuid4
from typing import Dict, Any
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_staff, require_storage_operator, require_tenant_admin
from ...models import Payment, PaymentStatus, Reservation, User
from ...models.enums import PaymentMode, PaymentProvider
from ...schemas import PaymentIntentCreate, PaymentRead
from ...core.config import settings
from ...services.payment_service import confirm_pos_payment

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


@router.post("/create-intent", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment_intent(
    payload: PaymentIntentCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> PaymentRead:
    """Create or update a payment intent for a reservation."""
    if not settings.payments_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ödeme servisleri henüz etkin değil.",
        )
    reservation = await session.get(Reservation, payload.reservation_id)
    if reservation is None or reservation.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    payment_result = await session.execute(
        select(Payment).where(Payment.reservation_id == payload.reservation_id)
    )
    payment = payment_result.scalar_one_or_none()
    provider_intent_id = f"{payload.provider}_intent_{uuid4().hex[:12]}"

    if payment:
        payment.provider = payload.provider
        payment.provider_intent_id = provider_intent_id
        payment.status = PaymentStatus.PENDING.value
    else:
        payment = Payment(
            tenant_id=current_user.tenant_id,
            reservation_id=reservation.id,
            provider=payload.provider,
            provider_intent_id=provider_intent_id,
            status=PaymentStatus.PENDING.value,
            amount_minor=reservation.amount_minor or 0,
            currency=reservation.currency,
        )
        session.add(payment)

    await session.commit()
    await session.refresh(payment)
    return PaymentRead.model_validate(payment)


@router.post("/{payment_id}/confirm-pos", response_model=Dict[str, Any])
async def confirm_pos_payment_endpoint(
    payment_id: str,
    current_user: User = Depends(require_storage_operator),  # STORAGE_OPERATOR, MANAGER, TENANT_ADMIN can access
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Confirm a POS payment (cash/card at location).
    
    This endpoint:
    1. Updates payment status to PAID
    2. Sets paid_at timestamp
    3. Updates reservation status if linked
    4. Updates storage status
    5. Creates settlement
    6. Updates revenue
    
    Access: STORAGE_OPERATOR, MANAGER, TENANT_ADMIN
    """
    # Get payment
    payment = await session.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    
    # Check tenant access
    if payment.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # Check if payment mode is POS
    if payment.mode != PaymentMode.POS.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment mode must be POS, got {payment.mode}",
        )
    
    # Check if already paid
    if payment.status == PaymentStatus.PAID.value:
        from ...models import Settlement
        from sqlalchemy import select as sql_select
        
        existing_settlement = await session.execute(
            sql_select(Settlement).where(Settlement.payment_id == payment.id)
        )
        settlement = existing_settlement.scalar_one_or_none()
        
        return {
            "ok": True,
            "message": "Payment already confirmed",
            "payment_id": payment.id,
            "payment_status": payment.status,
            "settlement_id": settlement.id if settlement else None,
            "settlement_status": settlement.status if settlement else None,
        }
    
    try:
        # Confirm POS payment
        payment = await confirm_pos_payment(
            session,
            payment=payment,
            actor_user_id=current_user.id,
        )
        
        # Get settlement
        from ...models import Settlement
        from sqlalchemy import select as sql_select
        
        settlement_result = await session.execute(
            sql_select(Settlement).where(Settlement.payment_id == payment.id)
        )
        settlement = settlement_result.scalar_one_or_none()
        
        logger.info(
            f"POS payment confirmed: payment_id={payment.id}, "
            f"reservation_id={payment.reservation_id}, settlement_id={settlement.id if settlement else None}"
        )
        
        return {
            "ok": True,
            "message": "POS payment confirmed successfully",
            "payment_id": payment.id,
            "payment_status": payment.status,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            "transaction_id": payment.transaction_id,
            "settlement_id": settlement.id if settlement else None,
            "settlement_status": settlement.status if settlement else None,
            "total_amount": settlement.total_amount_minor if settlement else None,
            "tenant_settlement": settlement.tenant_settlement_minor if settlement else None,
            "kyradi_commission": settlement.kyradi_commission_minor if settlement else None,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error(f"Error confirming POS payment: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm POS payment: {str(exc)}",
        ) from exc
