"""MagicPay payment endpoints."""

from typing import Any, Dict
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_staff
from ...models import Payment, PaymentStatus, Reservation, Tenant, User
from ...services.magicpay.client import get_magicpay_client
from ...services.magicpay.service import MagicPayService
from ...services.revenue import calculate_settlement, mark_settlement_completed

router = APIRouter(prefix="/payments/magicpay", tags=["magicpay"])
logger = logging.getLogger(__name__)


class CheckoutSessionCreate(BaseModel):
    """Request to create a MagicPay checkout session."""
    reservation_id: str = Field(..., description="Reservation ID to create payment for")


class CheckoutSessionResponse(BaseModel):
    """Response with checkout session details."""
    payment_id: str
    session_id: str
    checkout_url: str
    amount_minor: int
    currency: str
    expires_at: float | None = None


class DemoCompleteRequest(BaseModel):
    """Request to complete demo payment."""
    result: str = Field(..., description="'success' or 'failed'")


class DemoCompleteResponse(BaseModel):
    """Response after completing demo payment."""
    ok: bool
    message: str
    payment_id: str
    payment_status: str
    settlement_id: str | None = None
    settlement_status: str | None = None
    total_amount: int | None = None
    tenant_settlement: int | None = None
    kyradi_commission: int | None = None


def get_payment_mode_for_tenant(tenant_metadata: dict | None) -> str:
    """Get payment mode for tenant from metadata.
    
    Defaults to 'demo_local' if not configured.
    """
    if not tenant_metadata:
        return "demo_local"
    return tenant_metadata.get("payment_mode", "demo_local")


def get_payment_provider_for_tenant(tenant_metadata: dict | None) -> str:
    """Get payment provider for tenant from metadata.
    
    Defaults to 'MAGIC_PAY' if not configured.
    """
    if not tenant_metadata:
        return "MAGIC_PAY"
    return tenant_metadata.get("payment_provider", "MAGIC_PAY")


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> CheckoutSessionResponse:
    """Create a MagicPay checkout session for a reservation.
    
    This endpoint:
    1. Finds the reservation
    2. Creates a MagicPay checkout session
    3. Creates a Payment record
    4. Returns checkout URL for frontend redirect
    """
    # Get reservation
    reservation = await session.get(Reservation, payload.reservation_id)
    if reservation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )
    
    # Check tenant access
    if reservation.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # Check if payment already exists
    from sqlalchemy import select
    existing_payment = await session.execute(
        select(Payment).where(
            Payment.reservation_id == reservation.id,
            Payment.provider == "MAGIC_PAY",
        )
    )
    existing = existing_payment.scalar_one_or_none()
    
    if existing and existing.status in [PaymentStatus.PENDING.value, PaymentStatus.AUTHORIZED.value]:
        # Return existing payment session
        checkout_url = existing.meta.get("checkout_url") if existing.meta else None
        if not checkout_url:
            checkout_url = f"/payments/magicpay/demo/{existing.provider_intent_id}"
        
        return CheckoutSessionResponse(
            payment_id=existing.id,
            session_id=existing.provider_intent_id or "",
            checkout_url=checkout_url,
            amount_minor=existing.amount_minor,
            currency=existing.currency,
            expires_at=existing.meta.get("expires_at") if existing.meta else None,
        )
    
    # Get tenant payment config
    tenant = await session.get(Tenant, reservation.tenant_id)
    payment_mode = get_payment_mode_for_tenant(tenant.metadata_ if tenant else None)
    payment_provider = get_payment_provider_for_tenant(tenant.metadata_ if tenant else None)
    
    if payment_provider != "MAGIC_PAY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment provider {payment_provider} is not supported for this endpoint",
        )
    
    # Get MagicPay client
    magicpay_client = get_magicpay_client(payment_mode=payment_mode)
    magicpay_service = MagicPayService(magicpay_client)
    
    # Create checkout session
    payment = await magicpay_service.create_checkout_session(
        session=session,
        reservation=reservation,
        payment_mode=payment_mode,
    )
    
    await session.commit()
    
    checkout_url = payment.meta.get("checkout_url") if payment.meta else f"/payments/magicpay/demo/{payment.provider_intent_id}"
    
    logger.info(
        f"Created MagicPay checkout session: payment_id={payment.id}, "
        f"reservation_id={reservation.id}, checkout_url={checkout_url}"
    )
    
    return CheckoutSessionResponse(
        payment_id=payment.id,
        session_id=payment.provider_intent_id or "",
        checkout_url=checkout_url,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
        expires_at=payment.meta.get("expires_at") if payment.meta else None,
    )


@router.post("/demo/{session_id}/complete", response_model=DemoCompleteResponse)
async def complete_demo_payment(
    session_id: str,
    payload: DemoCompleteRequest,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> DemoCompleteResponse:
    """Complete a demo payment (demo/local mode only).
    
    This endpoint:
    1. Finds payment by session_id
    2. Simulates payment success/failure
    3. Updates payment status
    4. Creates settlement if successful
    5. Updates revenue records
    """
    # Get payment
    payment = await MagicPayService.get_payment_by_session_id(
        session,
        session_id=session_id,
        tenant_id=current_user.tenant_id,
    )
    
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    
    # Check if already completed
    if payment.status in [PaymentStatus.CAPTURED.value, PaymentStatus.FAILED.value]:
        from ...models import Settlement
        from sqlalchemy import select
        
        existing_settlement = await session.execute(
            select(Settlement).where(Settlement.payment_id == payment.id)
        )
        settlement = existing_settlement.scalar_one_or_none()
        
        return DemoCompleteResponse(
            ok=True,
            message=f"Payment already {payment.status.lower()}",
            payment_id=payment.id,
            payment_status=payment.status,
            settlement_id=settlement.id if settlement else None,
            settlement_status=settlement.status if settlement else None,
            total_amount=settlement.total_amount_minor if settlement else None,
            tenant_settlement=settlement.tenant_settlement_minor if settlement else None,
            kyradi_commission=settlement.kyradi_commission_minor if settlement else None,
        )
    
    # Get tenant payment config
    tenant = await session.get(Tenant, payment.tenant_id)
    payment_mode = get_payment_mode_for_tenant(tenant.metadata_ if tenant else None)
    
    if payment_mode != "demo_local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only available in demo_local mode",
        )
    
    # Get MagicPay client and service
    magicpay_client = get_magicpay_client(payment_mode=payment_mode)
    magicpay_service = MagicPayService(magicpay_client)
    
    # Complete payment
    payment = await magicpay_service.complete_payment(
        session=session,
        payment=payment,
        result=payload.result,
    )
    
    await session.flush()
    
    # If successful, create settlement
    settlement = None
    if payload.result == "success" and payment.status == PaymentStatus.PAID.value:
        # Create settlement
        if payment.reservation_id:
            try:
                settlement = await calculate_settlement(session, payment, commission_rate=5.0)
                await session.flush()
                
                # Mark settlement as settled
                settlement = await mark_settlement_completed(session, settlement.id)
                await session.flush()
                
                logger.info(
                    f"Created settlement for MagicPay payment: payment_id={payment.id}, "
                    f"settlement_id={settlement.id}"
                )
            except Exception as exc:
                logger.error(f"Failed to create settlement: {exc}", exc_info=True)
                # Don't fail the whole request if settlement creation fails
    
    await session.commit()
    
    logger.info(
        f"Completed MagicPay demo payment: payment_id={payment.id}, "
        f"result={payload.result}, settlement_id={settlement.id if settlement else None}"
    )
    
    return DemoCompleteResponse(
        ok=True,
        message=f"Payment {payload.result}",
        payment_id=payment.id,
        payment_status=payment.status,
        settlement_id=settlement.id if settlement else None,
        settlement_status=settlement.status if settlement else None,
        total_amount=settlement.total_amount_minor if settlement else None,
        tenant_settlement=settlement.tenant_settlement_minor if settlement else None,
        kyradi_commission=settlement.kyradi_commission_minor if settlement else None,
    )


@router.get("/demo/{session_id}", response_model=Dict[str, Any])
async def get_demo_payment_info(
    session_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Get payment information for demo checkout page."""
    payment = await MagicPayService.get_payment_by_session_id(
        session,
        session_id=session_id,
        tenant_id=current_user.tenant_id,
    )
    
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    
    # Get reservation
    reservation = None
    if payment.reservation_id:
        reservation = await session.get(Reservation, payment.reservation_id)
    
    # Get tenant
    tenant = await session.get(Tenant, payment.tenant_id)
    
    return {
        "payment_id": payment.id,
        "session_id": session_id,
        "amount_minor": payment.amount_minor,
        "currency": payment.currency,
        "status": payment.status,
        "reservation": {
            "id": reservation.id if reservation else None,
            "customer_name": reservation.customer_name if reservation else None,
            "storage_id": reservation.storage_id if reservation else None,
        } if reservation else None,
        "tenant": {
            "id": tenant.id if tenant else None,
            "name": tenant.name if tenant else None,
        } if tenant else None,
    }

