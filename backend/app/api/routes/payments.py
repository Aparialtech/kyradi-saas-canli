"""Payment intent endpoint."""

from uuid import uuid4
from typing import Dict, Any
from datetime import datetime, timezone
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
from ...services.payment_service import confirm_pos_payment, confirm_cash_payment
from ...services.magicpay.client import get_magicpay_client
from ...services.magicpay.service import MagicPayService
from ...services.payment_service import get_or_create_payment

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


class MagicPayCheckoutCreate(PaymentIntentCreate):
    """Payload for creating MagicPay checkout session."""
    provider: str = PaymentProvider.MAGIC_PAY.value


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


@router.post("/magicpay/checkout-session", response_model=Dict[str, Any])
async def create_magicpay_checkout_session(
    payload: MagicPayCheckoutCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Create MagicPay checkout session (alias for /payments/magicpay/checkout-session).
    
    This ensures the path /payments/magicpay/checkout-session always exists.
    """
    reservation = await session.get(Reservation, payload.reservation_id)
    if reservation is None or reservation.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    try:
        magicpay_client = get_magicpay_client(payment_mode=PaymentMode.GATEWAY_DEMO.value)
        magicpay_service = MagicPayService(magicpay_client)

        payment, _ = await get_or_create_payment(
            session,
            reservation_id=reservation.id,
            tenant_id=reservation.tenant_id,
            amount_minor=reservation.amount_minor,
            currency=reservation.currency,
            provider=PaymentProvider.MAGIC_PAY.value,
            mode=PaymentMode.GATEWAY_DEMO.value,
            storage_id=reservation.storage_id,
            metadata={"created_via": "payments_router_alias"},
            reservation=reservation,
        )

        if not payment.provider_intent_id or not (payment.meta or {}).get("checkout_url"):
            checkout_data = await magicpay_service.create_checkout_session(
                session=session,
                reservation=reservation,
                payment_mode=PaymentMode.GATEWAY_DEMO.value,
            )
            payment.provider_intent_id = checkout_data.get("session_id")
            payment.meta = {
                **(payment.meta or {}),
                "checkout_url": checkout_data.get("checkout_url"),
                "expires_at": checkout_data.get("expires_at"),
                "session_id": checkout_data.get("session_id"),
            }
            await session.flush()

        await session.commit()

        checkout_url = (
            payment.meta.get("checkout_url") if payment.meta else f"/payments/magicpay/demo/{payment.provider_intent_id}"
        )
        return {
            "payment_id": payment.id,
            "session_id": payment.provider_intent_id or "",
            "checkout_url": checkout_url,
            "amount_minor": payment.amount_minor,
            "currency": payment.currency,
            "expires_at": payment.meta.get("expires_at") if payment.meta else None,
        }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "MagicPay checkout session creation failed for reservation %s: %s",
            payload.reservation_id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MagicPay checkout session could not be created",
        ) from exc


@router.post("/{payment_id}/confirm-cash", response_model=Dict[str, Any])
async def confirm_cash_payment_endpoint(
    payment_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Confirm cash payment (offline payment).
    
    This endpoint:
    1. Updates payment status to PAID
    2. Sets payment mode to CASH
    3. Updates reservation status to active
    4. Creates settlement with commission calculation
    """
    payment = await session.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    
    if payment.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    if payment.status == PaymentStatus.PAID.value:
        return {
            "ok": True,
            "message": "Payment already confirmed",
            "payment_id": payment.id,
            "payment_status": payment.status,
        }
    
    # Set payment mode to CASH
    payment.mode = PaymentMode.CASH.value
    payment.status = PaymentStatus.PAID.value
    payment.provider = PaymentProvider.POS.value
    payment.paid_at = datetime.now(timezone.utc)
    
    # Update reservation status
    reservation = await session.get(Reservation, payment.reservation_id)
    if reservation:
        reservation.status = "active"
    
    try:
        # Confirm cash payment using service
        payment = await confirm_cash_payment(
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
            f"Cash payment confirmed: payment_id={payment.id}, "
            f"reservation_id={payment.reservation_id}, settlement_id={settlement.id if settlement else None}"
        )
        
        return {
            "ok": True,
            "message": "Cash payment confirmed successfully",
            "payment_id": payment.id,
            "payment_status": payment.status,
            "payment_mode": payment.mode,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            "settlement_id": settlement.id if settlement else None,
            "settlement_status": settlement.status if settlement else None,
            "amount_minor": payment.amount_minor,
            "currency": payment.currency,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error(f"Error confirming cash payment: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm cash payment: {str(exc)}",
        ) from exc


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
