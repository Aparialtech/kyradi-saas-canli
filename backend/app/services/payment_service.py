"""Payment service for creating and managing payments."""

from datetime import datetime, timezone
from typing import Optional
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..models import Payment, PaymentStatus, Reservation, Storage, Tenant
from ..models.enums import PaymentMode, PaymentProvider

logger = logging.getLogger(__name__)


async def create_payment_for_reservation(
    session: AsyncSession,
    *,
    reservation: Reservation,
    storage: Optional[Storage] = None,
    provider: str = PaymentProvider.MAGIC_PAY.value,
    mode: str = PaymentMode.GATEWAY_DEMO.value,
    create_checkout_session: bool = True,
) -> Payment:
    """Create a payment record for a reservation.
    
    This function:
    1. Creates a Payment record (PENDING status)
    2. If mode is GATEWAY_DEMO, creates checkout session via MagicPay client
    3. Links payment to reservation and storage
    
    Args:
        session: Database session
        reservation: Reservation to create payment for
        storage: Optional storage (will use reservation.storage if not provided)
        provider: Payment provider (default: MAGIC_PAY)
        mode: Payment mode (default: GATEWAY_DEMO)
        create_checkout_session: Whether to create checkout session (for gateway mode)
    
    Returns:
        Created Payment record
    """
    # Get storage from reservation if not provided
    if storage is None:
        storage = reservation.storage
    
    # Get tenant payment config
    tenant = await session.get(Tenant, reservation.tenant_id)
    tenant_metadata = getattr(tenant, "metadata_", None)
    if tenant_metadata is None:
        tenant_metadata = {}
    provider = (tenant_metadata or {}).get("payment_provider", provider)
    mode = (tenant_metadata or {}).get("payment_mode", mode)

    # Get or create payment per reservation to avoid duplicates
    existing_payment = await session.scalar(
        select(Payment).where(Payment.reservation_id == reservation.id)
    )
    if existing_payment:
        existing_payment.provider = provider
        existing_payment.mode = mode
        existing_payment.amount_minor = reservation.amount_minor
        existing_payment.currency = reservation.currency
        existing_payment.storage_id = storage.id if storage else existing_payment.storage_id
        await session.flush()
        payment = existing_payment
    else:
        payment = Payment(
            tenant_id=reservation.tenant_id,
            reservation_id=reservation.id,
            storage_id=storage.id if storage else None,
            provider=provider,
            mode=mode,
            status=PaymentStatus.PENDING.value,
            amount_minor=reservation.amount_minor,
            currency=reservation.currency,
            meta={},
        )
        session.add(payment)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            payment = await session.scalar(
                select(Payment).where(Payment.reservation_id == reservation.id)
            )
            if payment is None:
                raise
        await session.refresh(payment)
        # after commit ensure metadata updates can proceed without re-commit

    # If gateway demo mode, create checkout session
    if mode == PaymentMode.GATEWAY_DEMO.value and provider == PaymentProvider.MAGIC_PAY.value and create_checkout_session:
        try:
            from .magicpay.client import get_magicpay_client
            from .magicpay.service import MagicPayService
            
            magicpay_client = get_magicpay_client(payment_mode=mode)
            magicpay_service = MagicPayService(magicpay_client)
            
            # Create checkout session
            checkout_data = await magicpay_service.create_checkout_session(
                session=session,
                reservation=reservation,
                payment_mode=mode,
            )
            
            # Update payment with session info
            payment.provider_intent_id = checkout_data.get("session_id")
            payment.meta = {
                "checkout_url": checkout_data.get("checkout_url"),
                "expires_at": checkout_data.get("expires_at"),
                "session_id": checkout_data.get("session_id"),
            }
            
            await session.flush()
            
            logger.info(
                f"Created payment with MagicPay checkout session: payment_id={payment.id}, "
                f"reservation_id={reservation.id}, session_id={payment.provider_intent_id}"
            )
        except Exception as exc:
            logger.error(f"Failed to create MagicPay checkout session: {exc}", exc_info=True)
            # Don't fail payment creation if checkout session fails
            # Payment will be created but without checkout URL
    
    logger.info(
        f"Created payment: payment_id={payment.id}, reservation_id={reservation.id}, "
        f"provider={provider}, mode={mode}, amount={payment.amount_minor}"
    )
    
    return payment


async def confirm_pos_payment(
    session: AsyncSession,
    *,
    payment: Payment,
    actor_user_id: Optional[str] = None,
) -> Payment:
    """Confirm a POS payment (cash/card at location).
    
    This function:
    1. Updates payment status to PAID
    2. Sets paid_at timestamp
    3. Updates reservation status if linked
    4. Updates storage status
    5. Creates settlement
    6. Updates revenue
    
    Args:
        session: Database session
        payment: Payment to confirm
        actor_user_id: User ID who confirmed the payment
    
    Returns:
        Updated Payment record
    """
    if payment.status == PaymentStatus.PAID.value:
        logger.warning(f"Payment {payment.id} already confirmed")
        return payment
    
    if payment.mode != PaymentMode.POS.value:
        raise ValueError(f"Payment mode must be POS, got {payment.mode}")
    
    # Update payment
    payment.status = PaymentStatus.PAID.value
    payment.paid_at = datetime.now(timezone.utc)
    payment.transaction_id = f"POS_{payment.id[:8]}_{datetime.now(timezone.utc).timestamp():.0f}"
    
    await session.flush()
    
    # Update reservation if linked
    if payment.reservation_id:
        reservation = await session.get(Reservation, payment.reservation_id)
        if reservation:
            # Reservation status stays ACTIVE, payment status is tracked separately
            # But we can add a note that payment is completed
            pass
    
    # Update storage status if linked
    if payment.storage_id:
        storage = await session.get(Storage, payment.storage_id)
        if storage:
            # Storage remains OCCUPIED if reservation is still active
            pass
    
    # Create settlement
    if payment.reservation_id:
        try:
            from .revenue import calculate_settlement, mark_settlement_completed
            
            settlement = await calculate_settlement(session, payment, commission_rate=5.0)
            await session.flush()
            
            # Mark settlement as settled
            settlement = await mark_settlement_completed(session, settlement.id)
            await session.flush()
            
            logger.info(
                f"Created settlement for POS payment: payment_id={payment.id}, "
                f"settlement_id={settlement.id}"
            )
        except Exception as exc:
            logger.error(f"Failed to create settlement for POS payment: {exc}", exc_info=True)
            # Don't fail payment confirmation if settlement fails
    
    await session.commit()
    await session.refresh(payment)
    
    logger.info(f"Confirmed POS payment: payment_id={payment.id}, amount={payment.amount_minor}")
    
    return payment
