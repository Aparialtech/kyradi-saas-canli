"""Payment service for creating and managing payments.

GLOBAL PAYMENT RULES:
1. Her reservation_id için sadece 1 payment olabilir
2. Payment oluşturmadan önce mutlaka mevcut payment kontrolü yapılır
3. Mevcut payment varsa tekrar insert yapılmaz, mevcut döndürülür
4. Tüm payment işlemleri bu modül üzerinden yapılır (single source of truth)
"""

from datetime import datetime, timezone
from typing import Optional, Tuple
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..models import Payment, PaymentStatus, Reservation, Storage, Tenant
from ..models.enums import PaymentMode, PaymentProvider

logger = logging.getLogger(__name__)


async def get_existing_payment(
    session: AsyncSession,
    reservation_id: str,
) -> Optional[Payment]:
    """Get existing payment for a reservation.
    
    Args:
        session: Database session
        reservation_id: Reservation ID
        
    Returns:
        Payment if exists, None otherwise
    """
    result = await session.execute(
        select(Payment).where(Payment.reservation_id == reservation_id)
    )
    return result.scalar_one_or_none()


async def _calculate_amount_for_reservation(
    session: AsyncSession,
    reservation: Reservation,
) -> Tuple[Optional[int], Optional[str]]:
    """Calculate payment amount using centralized pricing rules."""
    try:
        from .pricing_calculator import calculate_price_for_reservation

        calculation = await calculate_price_for_reservation(session, reservation)

        # Backfill reservation with calculated values if missing
        if not reservation.amount_minor:
            reservation.amount_minor = calculation.total_minor
        if not reservation.currency:
            reservation.currency = calculation.currency

        return calculation.total_minor, calculation.currency
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.error(
            "Pricing calculation failed for reservation %s: %s",
            getattr(reservation, "id", None),
            exc,
            exc_info=True,
        )
        fallback_amount = reservation.amount_minor or reservation.estimated_total_price
        return fallback_amount, reservation.currency


async def get_or_create_payment(
    session: AsyncSession,
    *,
    reservation_id: str,
    tenant_id: str,
    amount_minor: Optional[int],
    currency: str = "TRY",
    provider: str = PaymentProvider.MAGIC_PAY.value,
    mode: str = PaymentMode.GATEWAY_DEMO.value,
    storage_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    reservation: Optional[Reservation] = None,
) -> Tuple[Payment, bool]:
    """Get existing payment or create new one for a reservation (idempotent).
    
    Bu fonksiyon reservation başına sadece 1 payment olmasını garanti eder.
    Eğer payment zaten varsa, mevcut payment'ı döndürür.
    Yoksa yeni payment oluşturur.
    
    DUPLICATE PAYMENT PROTECTION:
    - Her çağrıda önce mevcut payment kontrol edilir
    - Mevcut varsa "Existing payment detected, skipping creation…" logu yazılır
    - Sadece yoksa yeni payment oluşturulur
    
    Args:
        session: Database session
        reservation_id: Reservation ID
        tenant_id: Tenant ID
        amount_minor: Payment amount in minor units
        currency: Currency code
        provider: Payment provider
        mode: Payment mode
        storage_id: Optional storage ID
        metadata: Optional metadata dict
        
    Returns:
        Tuple of (Payment, created) where created is True if new payment was created
    """
    # STEP 1: Check if payment already exists
    existing_payment = await get_existing_payment(session, reservation_id)

    # Try to calculate a consistent amount from centralized pricing
    pricing_amount: Optional[int] = None
    pricing_currency: Optional[str] = None

    if reservation is None:
        reservation = await session.get(Reservation, reservation_id)

    if reservation:
        pricing_amount, pricing_currency = await _calculate_amount_for_reservation(session, reservation)

    target_amount = pricing_amount if pricing_amount is not None else amount_minor
    target_currency = pricing_currency or currency or "TRY"

    if not target_amount or target_amount <= 0:
        logger.warning(
            "Payment amount missing or zero, falling back to reservation/estimate. "
            "reservation_id=%s tenant_id=%s",
            reservation_id,
            tenant_id,
        )
        if reservation:
            target_amount = (
                reservation.amount_minor
                or reservation.estimated_total_price
                or pricing_amount
                or amount_minor
                or 0
            )

    if existing_payment:
        logger.info(
            f"Existing payment detected, skipping creation. "
            f"reservation_id={reservation_id}, payment_id={existing_payment.id}, "
            f"status={existing_payment.status}"
        )
        # Optionally update metadata if provided (but don't change core fields)
        if metadata:
            existing_payment.meta = {**(existing_payment.meta or {}), **metadata}

        # If existing payment is missing amount, fill it from pricing (but do not override paid payments)
        if (
            existing_payment.status not in [PaymentStatus.PAID.value, PaymentStatus.CAPTURED.value]
            and (not existing_payment.amount_minor or existing_payment.amount_minor == 0)
            and target_amount
        ):
            existing_payment.amount_minor = target_amount
            existing_payment.currency = target_currency

        await session.flush()
        return existing_payment, False

    if not target_amount or target_amount <= 0:
        raise ValueError("Payment amount could not be determined from pricing rules")
    
    # STEP 2: Create new payment (no existing payment found)
    logger.info(
        f"Creating new payment for reservation_id={reservation_id}, "
        f"amount={target_amount}, provider={provider}, mode={mode}"
    )

    payment = Payment(
        tenant_id=tenant_id,
        reservation_id=reservation_id,
        storage_id=storage_id,
        provider=provider,
        mode=mode,
        status=PaymentStatus.PENDING.value,
        amount_minor=target_amount or 0,
        currency=target_currency,
        meta=metadata or {},
    )
    session.add(payment)
    
    try:
        await session.flush()
        logger.info(
            f"Payment created successfully: payment_id={payment.id}, "
            f"reservation_id={reservation_id}"
        )
        return payment, True
    except IntegrityError as e:
        # Race condition - another process created payment between our check and insert
        logger.warning(
            f"Race condition detected during payment creation for reservation_id={reservation_id}. "
            f"Fetching existing payment instead. Error: {e}"
        )
        await session.rollback()
        
        # Fetch the payment that was created by the other process
        existing_payment = await get_existing_payment(session, reservation_id)
        if existing_payment:
            logger.info(
                f"Found existing payment after race condition: payment_id={existing_payment.id}"
            )
            return existing_payment, False
        
        # This should not happen, but re-raise if we still can't find the payment
        logger.error(
            f"Could not find payment after IntegrityError for reservation_id={reservation_id}"
        )
        raise


async def create_payment_for_reservation(
    session: AsyncSession,
    *,
    reservation: Reservation,
    storage: Optional[Storage] = None,
    provider: str = PaymentProvider.MAGIC_PAY.value,
    mode: str = PaymentMode.GATEWAY_DEMO.value,
    create_checkout_session: bool = True,
) -> Payment:
    """Create a payment record for a reservation (idempotent).
    
    Bu fonksiyon:
    1. Önce mevcut payment var mı kontrol eder (get_or_create_payment kullanarak)
    2. Yoksa yeni Payment kaydı oluşturur
    3. Demo mode ise MagicPay checkout session oluşturur
    
    DUPLICATE PROTECTION:
    - get_or_create_payment fonksiyonu ile duplicate engellenir
    - "Payment already linked to reservation…" logu duplicate durumunda yazılır
    
    Args:
        session: Database session
        reservation: Reservation to create payment for
        storage: Optional storage (will use reservation.storage if not provided)
        provider: Payment provider (default: MAGIC_PAY)
        mode: Payment mode (default: GATEWAY_DEMO)
        create_checkout_session: Whether to create checkout session (for gateway mode)
    
    Returns:
        Payment record (existing or newly created)
    """
    # Get storage from reservation if not provided
    if storage is None:
        storage = getattr(reservation, 'storage', None)
    
    # Get tenant payment config
    tenant = await session.get(Tenant, reservation.tenant_id)
    tenant_metadata = _get_tenant_metadata(tenant)
    
    # Override provider/mode from tenant config if set
    provider = tenant_metadata.get("payment_provider", provider)
    mode = tenant_metadata.get("payment_mode", mode)

    # Get or create payment (idempotent - handles duplicate protection)
    payment, created = await get_or_create_payment(
        session,
        reservation_id=reservation.id,
        tenant_id=reservation.tenant_id,
        amount_minor=reservation.amount_minor,
        currency=reservation.currency,
        provider=provider,
        mode=mode,
        storage_id=storage.id if storage else None,
        metadata={},
        reservation=reservation,
    )
    
    # If existing payment found, log and optionally update
    if not created:
        logger.info(
            f"Payment already linked to reservation. "
            f"reservation_id={reservation.id}, payment_id={payment.id}"
        )
        # Update fields if they changed
        payment.provider = provider
        payment.mode = mode
        payment.amount_minor = reservation.amount_minor
        payment.currency = reservation.currency
        if storage:
            payment.storage_id = storage.id
        await session.flush()

    # Create checkout session for demo mode if needed
    await _maybe_create_checkout_session(
        session, payment, reservation, mode, provider, create_checkout_session
    )
    
    logger.info(
        f"Payment ready: payment_id={payment.id}, reservation_id={reservation.id}, "
        f"provider={provider}, mode={mode}, amount={payment.amount_minor}, "
        f"was_created={created}, has_checkout_url={bool(payment.meta and payment.meta.get('checkout_url'))}"
    )
    
    return payment


def _get_tenant_metadata(tenant: Optional[Tenant]) -> dict:
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
        except Exception:
            return {}
    
    if isinstance(tenant_metadata, dict):
        return tenant_metadata
    
    return {}


async def _maybe_create_checkout_session(
    session: AsyncSession,
    payment: Payment,
    reservation: Reservation,
    mode: str,
    provider: str,
    create_checkout_session: bool,
) -> None:
    """Create checkout session for demo mode if needed."""
    from .magicpay.client import normalize_payment_mode, DEMO_MODES
    
    normalized_mode = normalize_payment_mode(mode)
    is_demo_mode = normalized_mode == "demo" or mode in DEMO_MODES
    is_magicpay = provider == PaymentProvider.MAGIC_PAY.value or provider == "MAGIC_PAY"
    
    if not (is_demo_mode and is_magicpay and create_checkout_session):
        return
    
    # Only create checkout session if not already created
    if payment.provider_intent_id:
        logger.debug(
            f"Checkout session already exists for payment_id={payment.id}, "
            f"session_id={payment.provider_intent_id}"
        )
        return
    
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
            **(payment.meta or {}),
            "checkout_url": checkout_data.get("checkout_url"),
            "expires_at": checkout_data.get("expires_at"),
            "session_id": checkout_data.get("session_id"),
        }
        
        await session.flush()
        
        logger.info(
            f"Created MagicPay checkout session: payment_id={payment.id}, "
            f"reservation_id={reservation.id}, session_id={payment.provider_intent_id}, "
            f"checkout_url={checkout_data.get('checkout_url')}"
        )
    except Exception as exc:
        logger.error(f"Failed to create MagicPay checkout session: {exc}", exc_info=True)
        # Don't fail payment creation if checkout session fails
        # Payment will be created but without checkout URL


async def confirm_cash_payment(
    session: AsyncSession,
    *,
    payment: Payment,
    actor_user_id: Optional[str] = None,
) -> Payment:
    """Confirm a cash payment (offline payment).
    
    This function:
    1. Updates payment status to PAID
    2. Sets payment mode to CASH
    3. Sets paid_at timestamp
    4. Updates reservation status to active
    5. Creates settlement with commission from metadata
    
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
    
    # Set payment mode to CASH
    payment.mode = PaymentMode.CASH.value
    payment.status = PaymentStatus.PAID.value
    payment.paid_at = datetime.now(timezone.utc)
    payment.provider = PaymentProvider.POS.value
    payment.transaction_id = f"CASH_{payment.id[:8]}_{datetime.now(timezone.utc).timestamp():.0f}"
    
    await session.flush()
    
    # Update reservation status to active
    if payment.reservation_id:
        reservation = await session.get(Reservation, payment.reservation_id)
        if reservation:
            reservation.status = "active"
    
    # Create settlement with commission from metadata
    if payment.reservation_id:
        try:
            from .revenue import calculate_settlement, mark_settlement_completed
            from .quota_checks import get_tenant_commission_rate
            
            commission_rate = await get_tenant_commission_rate(session, payment.tenant_id)
            settlement = await calculate_settlement(session, payment, commission_rate=commission_rate)
            await session.flush()
            
            # Mark settlement as settled
            settlement = await mark_settlement_completed(session, settlement.id)
            await session.flush()
            
            logger.info(
                f"Created settlement for cash payment: payment_id={payment.id}, "
                f"settlement_id={settlement.id}, commission_rate={commission_rate}%"
            )
        except Exception as exc:
            logger.error(f"Failed to create settlement for cash payment: {exc}", exc_info=True)
    
    await session.commit()
    await session.refresh(payment)
    
    logger.info(f"Confirmed cash payment: payment_id={payment.id}, amount={payment.amount_minor}")
    
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
    
    # Create settlement with commission from metadata
    if payment.reservation_id:
        try:
            from .revenue import calculate_settlement, mark_settlement_completed
            from .quota_checks import get_tenant_commission_rate
            
            commission_rate = await get_tenant_commission_rate(session, payment.tenant_id)
            settlement = await calculate_settlement(session, payment, commission_rate=commission_rate)
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


async def link_payment_to_reservation(
    session: AsyncSession,
    *,
    payment_id: str,
    reservation_id: str,
) -> Optional[Payment]:
    """Link a payment to a reservation (only if not already linked).
    
    Bu fonksiyon:
    1. Önce bu reservation için başka payment var mı kontrol eder
    2. Varsa işlem yapmaz (duplicate önleme)
    3. Yoksa payment'ı reservation'a bağlar
    
    Args:
        session: Database session
        payment_id: Payment ID
        reservation_id: Reservation ID to link
        
    Returns:
        Updated Payment or None if already linked to another payment
    """
    # Check if reservation already has a payment
    existing_payment = await get_existing_payment(session, reservation_id)
    if existing_payment:
        if existing_payment.id == payment_id:
            logger.debug(
                f"Payment {payment_id} is already linked to reservation {reservation_id}"
            )
            return existing_payment
        else:
            logger.warning(
                f"Reservation {reservation_id} already has a different payment "
                f"(existing: {existing_payment.id}, attempted: {payment_id}). "
                f"Skipping link operation."
            )
            return None
    
    # Get payment and link
    payment = await session.get(Payment, payment_id)
    if not payment:
        logger.error(f"Payment {payment_id} not found")
        return None
    
    # Check if this payment is already linked to another reservation
    if payment.reservation_id and payment.reservation_id != reservation_id:
        logger.warning(
            f"Payment {payment_id} is already linked to reservation {payment.reservation_id}. "
            f"Cannot link to {reservation_id}."
        )
        return None
    
    payment.reservation_id = reservation_id
    await session.flush()
    
    logger.info(f"Linked payment {payment_id} to reservation {reservation_id}")
    return payment
