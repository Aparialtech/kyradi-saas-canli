"""MagicPay payment endpoints.

Bu modül MagicPay ödeme işlemlerini yönetir.

PAYMENT DUPLICATE KORUMASI:
- get_or_create_payment kullanarak duplicate payment engellenır
- Mevcut payment varsa tekrar INSERT yapılmaz
- "Existing payment detected, skipping creation…" logu duplicate engellendiğini gösterir
"""

from typing import Any, Dict
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_staff
from ...models import Payment, PaymentStatus, Reservation, Tenant, User
from ...services.magicpay.client import get_magicpay_client
from ...services.magicpay.service import MagicPayService
from ...services.payment_service import get_or_create_payment, get_existing_payment
from ...services.revenue import calculate_settlement, mark_settlement_completed
from ...services.quota_checks import get_tenant_commission_rate

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
    
    Bu endpoint:
    1. Reservation bulur
    2. get_or_create_payment ile payment bulur/oluşturur (DUPLICATE YOK!)
    3. MagicPay checkout session oluşturur
    4. Checkout URL döner
    
    DUPLICATE KORUMASI:
    - Mevcut payment varsa yeni INSERT yapılmaz
    - Mevcut checkout session varsa tekrar oluşturulmaz
    """
    logger.info(
        f"Checkout session request: reservation_id={payload.reservation_id}, "
        f"user={current_user.email}, tenant={current_user.tenant_id}"
    )
    
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
    
    # ============================================================
    # STEP 1: Check if payment already exists using helper function
    # ============================================================
    existing_payment = await get_existing_payment(session, reservation.id)
    
    if existing_payment:
        logger.info(
            f"Found existing payment for reservation {reservation.id}: "
            f"payment_id={existing_payment.id}, status={existing_payment.status}"
        )
        
        # If payment has checkout URL, return it
        if existing_payment.status in [PaymentStatus.PENDING.value, PaymentStatus.AUTHORIZED.value]:
            checkout_url = None
            if existing_payment.meta:
                checkout_url = existing_payment.meta.get("checkout_url")
            
            if not checkout_url:
                checkout_url = f"/payments/magicpay/demo/{existing_payment.provider_intent_id}"
            
            logger.info(
                f"Returning existing checkout session: payment_id={existing_payment.id}, "
                f"checkout_url={checkout_url}"
            )
            
            return CheckoutSessionResponse(
                payment_id=existing_payment.id,
                session_id=existing_payment.provider_intent_id or "",
                checkout_url=checkout_url,
                amount_minor=existing_payment.amount_minor,
                currency=existing_payment.currency,
                expires_at=existing_payment.meta.get("expires_at") if existing_payment.meta else None,
            )
    
    # ============================================================
    # STEP 2: Get tenant payment config
    # ============================================================
    tenant = await session.get(Tenant, reservation.tenant_id)
    tenant_metadata = _get_tenant_metadata_safe(tenant)
    payment_mode = get_payment_mode_for_tenant(tenant_metadata)
    payment_provider = get_payment_provider_for_tenant(tenant_metadata)
    
    if payment_provider != "MAGIC_PAY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment provider {payment_provider} is not supported for this endpoint",
        )
    
    # ============================================================
    # STEP 3: Get or create payment using helper (IDEMPOTENT)
    # ============================================================
    payment, was_created = await get_or_create_payment(
        session,
        reservation_id=reservation.id,
        tenant_id=reservation.tenant_id,
        amount_minor=reservation.amount_minor,
        currency=reservation.currency,
        provider=payment_provider,
        mode=payment_mode,
        storage_id=reservation.storage_id,
        metadata={"created_via": "checkout_session_endpoint"},
        reservation=reservation,
    )
    
    if was_created:
        logger.info(f"Created new payment {payment.id} for reservation {reservation.id}")
    else:
        logger.info(
            f"Using existing payment {payment.id} for reservation {reservation.id} "
            f"(duplicate prevented)"
        )
    
    # ============================================================
    # STEP 4: Create checkout session if not already created
    # ============================================================
    if not payment.provider_intent_id:
        magicpay_client = get_magicpay_client(payment_mode=payment_mode)
        magicpay_service = MagicPayService(magicpay_client)
        
        # Create checkout session
        checkout_data = await magicpay_service.create_checkout_session(
            session=session,
            reservation=reservation,
            payment_mode=payment_mode,
        )
        
        # Update payment with session info
        payment.provider_intent_id = checkout_data.get("session_id")
        payment.meta = {
            **(payment.meta or {}),
            "checkout_url": checkout_data.get("checkout_url"),
            "expires_at": checkout_data.get("expires_at"),
            "session_id": checkout_data.get("session_id"),
        }
        await session.flush()
        
        logger.info(
            f"Created checkout session: payment_id={payment.id}, "
            f"session_id={payment.provider_intent_id}, "
            f"checkout_url={checkout_data.get('checkout_url')}"
        )
    else:
        logger.info(
            f"Checkout session already exists for payment {payment.id}: "
            f"session_id={payment.provider_intent_id}"
        )
    
    await session.commit()
    
    checkout_url = payment.meta.get("checkout_url") if payment.meta else f"/payments/magicpay/demo/{payment.provider_intent_id}"
    
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
    logger.info(
        f"Complete demo payment request: session_id={session_id}, "
        f"result={payload.result}, user={current_user.email}"
    )
    
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
    if payment.status in [PaymentStatus.CAPTURED.value, PaymentStatus.FAILED.value, PaymentStatus.PAID.value]:
        from ...models import Settlement
        
        existing_settlement = await session.execute(
            select(Settlement).where(Settlement.payment_id == payment.id)
        )
        settlement = existing_settlement.scalar_one_or_none()
        
        logger.info(
            f"Payment {payment.id} already completed with status={payment.status}"
        )
        
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
    
    # Allow both demo_local and GATEWAY_DEMO modes for this endpoint
    from ...services.magicpay.client import DEMO_MODES, normalize_payment_mode
    normalized_mode = normalize_payment_mode(payment_mode)
    is_demo = normalized_mode == "demo" or payment_mode in DEMO_MODES
    
    if not is_demo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only available in demo mode",
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
                commission_rate = await get_tenant_commission_rate(session, payment.tenant_id)
                settlement = await calculate_settlement(session, payment, commission_rate=commission_rate)
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
        f"result={payload.result}, new_status={payment.status}, "
        f"settlement_id={settlement.id if settlement else None}"
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


def _get_tenant_metadata_safe(tenant: Tenant | None) -> dict:
    """Safely get tenant metadata as dict."""
    if tenant is None:
        return {}
    
    tenant_metadata = getattr(tenant, "metadata_", None) or getattr(tenant, "metadata", None)
    
    if tenant_metadata is None:
        return {}
    
    if isinstance(tenant_metadata, str):
        import json
        try:
            return json.loads(tenant_metadata)
        except Exception as exc:
            logger.warning(f"Failed to get tenant metadata for commission calculation: {exc}")
            return {}
    
    if isinstance(tenant_metadata, dict):
        return tenant_metadata
    
    return {}
