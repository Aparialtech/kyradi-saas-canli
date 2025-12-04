"""MagicPay payment service for managing checkout sessions and payments.

Bu modül MagicPay checkout session ve payment işlemlerini yönetir.

PAYMENT DUPLICATE KORUMASI:
- get_or_create_payment helper kullanılır
- Mevcut payment varsa tekrar INSERT yapılmaz
- Her metod idempotent çalışır
"""

from typing import Optional, Dict, Any
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...models import Payment, PaymentStatus, Reservation, ReservationStatus
from ..payment_service import get_or_create_payment, get_existing_payment
from .client import get_magicpay_client, MagicPayClient

logger = logging.getLogger(__name__)


class MagicPayService:
    """Service for managing MagicPay payment operations.
    
    Bu servis MagicPay checkout session ve payment işlemlerini yönetir.
    Tüm payment oluşturma işlemleri payment_service.get_or_create_payment
    üzerinden yapılır.
    """
    
    def __init__(self, client: MagicPayClient):
        """Initialize MagicPay service.
        
        Args:
            client: MagicPayClient instance
        """
        self.client = client
    
    async def create_checkout_session(
        self,
        session: AsyncSession,
        reservation: Reservation,
        payment_mode: str = "demo_local",
    ) -> Dict[str, Any]:
        """Create a checkout session for a reservation.
        
        Bu metod:
        1. Mevcut payment var mı kontrol eder (idempotent)
        2. Yoksa yeni payment oluşturur
        3. MagicPay checkout session oluşturur
        4. Payment'ı günceller
        
        DUPLICATE KORUMASI:
        - get_or_create_payment kullanarak duplicate payment engellenir
        - Mevcut payment varsa "Existing payment detected" logu görülür
        
        Args:
            session: Database session
            reservation: Reservation to create payment for
            payment_mode: Payment mode ("demo_local" | "GATEWAY_DEMO" | "live")
        
        Returns:
            Dict with checkout session data (checkout_url, session_id, expires_at, payment)
        """
        logger.info(
            f"Creating checkout session for reservation {reservation.id}, mode={payment_mode}"
        )
        
        # ============================================================
        # STEP 1: Get or create payment using helper (IDEMPOTENT)
        # ============================================================
        payment, was_created = await get_or_create_payment(
            session,
            reservation_id=reservation.id,
            tenant_id=reservation.tenant_id,
            amount_minor=reservation.amount_minor,
            currency=reservation.currency,
            provider="MAGIC_PAY",
            mode=payment_mode,
            storage_id=reservation.storage_id,
            metadata={"payment_mode": payment_mode},
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
        # STEP 2: Check if checkout session already exists
        # ============================================================
        if payment.provider_intent_id and payment.meta and payment.meta.get("checkout_url"):
            logger.info(
                f"Checkout session already exists for payment {payment.id}: "
                f"session_id={payment.provider_intent_id}"
            )
            return {
                "checkout_url": payment.meta.get("checkout_url"),
                "session_id": payment.provider_intent_id,
                "expires_at": payment.meta.get("expires_at"),
                "payment": payment,
            }
        
        # ============================================================
        # STEP 3: Create MagicPay checkout session
        # ============================================================
        checkout_data = await self.client.create_checkout_session(
            amount_minor=payment.amount_minor,
            currency=payment.currency,
            reservation_id=reservation.id,
            customer_name=reservation.customer_name or "Guest",
            customer_email=reservation.customer_email,
            metadata={
                "reservation_id": reservation.id,
                "tenant_id": reservation.tenant_id,
                "storage_id": reservation.storage_id,
            },
        )
        
        # ============================================================
        # STEP 4: Update payment with checkout session info
        # ============================================================
        payment.provider = "MAGIC_PAY"
        payment.mode = payment_mode
        payment.provider_intent_id = checkout_data["session_id"]
        payment.status = PaymentStatus.PENDING.value
        # Amount/currency already set via get_or_create_payment using pricing rules
        if not payment.currency:
            payment.currency = reservation.currency
        payment.meta = {
            **(payment.meta or {}),
            "payment_mode": payment_mode,
            "checkout_url": checkout_data["checkout_url"],
            "expires_at": checkout_data.get("expires_at"),
            "session_id": checkout_data["session_id"],
        }
        
        await session.flush()

        logger.info(
            f"Created MagicPay checkout session: payment_id={payment.id}, "
            f"session_id={checkout_data['session_id']}, "
            f"checkout_url={checkout_data['checkout_url']}, "
            f"reservation_id={reservation.id}"
        )

        return {
            "checkout_url": checkout_data["checkout_url"],
            "session_id": checkout_data["session_id"],
            "expires_at": checkout_data.get("expires_at"),
            "payment": payment,
        }
    
    async def complete_payment(
        self,
        session: AsyncSession,
        payment: Payment,
        result: str,  # "success" | "failed"
    ) -> Payment:
        """Complete a payment (demo/local mode only).
        
        Args:
            session: Database session
            payment: Payment record to complete
            result: "success" | "failed"
        
        Returns:
            Updated Payment record
        """
        logger.info(
            f"Completing payment {payment.id} with result={result}"
        )
        
        # Check if already completed
        if payment.status in [PaymentStatus.PAID.value, PaymentStatus.CAPTURED.value]:
            logger.info(
                f"Payment {payment.id} already completed with status={payment.status}"
            )
            return payment
        
        if result == "success":
            # Simulate successful payment
            payment_result = await self.client.simulate_success(payment.provider_intent_id)
            
            # Update payment status to PAID
            from datetime import datetime, timezone
            payment.status = PaymentStatus.PAID.value
            payment.paid_at = datetime.now(timezone.utc)
            payment.transaction_id = payment_result.get("transaction_id")
            payment.meta = payment.meta or {}
            payment.meta.update({
                "transaction_id": payment_result.get("transaction_id"),
                "captured_at": payment_result.get("captured_at"),
            })
            
            # Update reservation status if linked
            if payment.reservation_id:
                reservation = await session.get(Reservation, payment.reservation_id)
                if reservation:
                    # Note: Reservation status might need to be updated based on business logic
                    # For now, we keep it as ACTIVE, payment status is tracked separately
                    pass
            
            logger.info(
                f"MagicPay payment completed successfully: payment_id={payment.id}, "
                f"transaction_id={payment_result.get('transaction_id')}"
            )
        else:
            # Simulate failed payment
            payment_result = await self.client.simulate_failure(payment.provider_intent_id)
            
            # Update payment status
            payment.status = PaymentStatus.FAILED.value
            payment.meta = payment.meta or {}
            payment.meta.update({
                "error_code": payment_result.get("error_code"),
                "error_message": payment_result.get("error_message"),
            })
            
            logger.info(
                f"MagicPay payment failed: payment_id={payment.id}, "
                f"error: {payment_result.get('error_message')}"
            )
        
        await session.flush()
        return payment
    
    @staticmethod
    async def get_payment_by_session_id(
        session: AsyncSession,
        session_id: str,
        tenant_id: Optional[str] = None,
    ) -> Optional[Payment]:
        """Get payment record by MagicPay session ID.
        
        Args:
            session: Database session
            session_id: MagicPay session ID
            tenant_id: Optional tenant ID for security check
        
        Returns:
            Payment record or None
        """
        stmt = select(Payment).where(
            Payment.provider_intent_id == session_id,
            Payment.provider == "MAGIC_PAY",
        )
        
        if tenant_id:
            stmt = stmt.where(Payment.tenant_id == tenant_id)
        
        result = await session.execute(stmt)
        return result.scalar_one_or_none()
