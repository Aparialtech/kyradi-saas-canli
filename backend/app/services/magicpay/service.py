"""MagicPay payment service for managing checkout sessions and payments."""

from typing import Optional
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...models import Payment, PaymentStatus, Reservation, ReservationStatus
from .client import get_magicpay_client, MagicPayClient

logger = logging.getLogger(__name__)


class MagicPayService:
    """Service for managing MagicPay payment operations."""
    
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
    ) -> Payment:
        """Create a checkout session for a reservation.
        
        This method:
        1. Creates a MagicPay checkout session
        2. Creates a Payment record in database
        3. Links payment to reservation
        
        Args:
            session: Database session
            reservation: Reservation to create payment for
            payment_mode: Payment mode ("demo_local" | "live")
        
        Returns:
            Created Payment record
        """
        # Create checkout session via MagicPay client
        checkout_data = await self.client.create_checkout_session(
            amount_minor=reservation.amount_minor,
            currency=reservation.currency,
            reservation_id=reservation.id,
            customer_name=reservation.customer_name or "Guest",
            customer_email=None,  # TODO: Add email to reservation if needed
            metadata={
                "reservation_id": reservation.id,
                "tenant_id": reservation.tenant_id,
                "storage_id": reservation.storage_id,
            },
        )
        
        # Create payment record
        payment = Payment(
            tenant_id=reservation.tenant_id,
            reservation_id=reservation.id,
            provider="MAGIC_PAY",
            provider_intent_id=checkout_data["session_id"],
            status=PaymentStatus.PENDING.value,
            amount_minor=reservation.amount_minor,
            currency=reservation.currency,
            meta={
                "payment_mode": payment_mode,
                "checkout_url": checkout_data["checkout_url"],
                "expires_at": checkout_data.get("expires_at"),
                "session_id": checkout_data["session_id"],
            },
        )
        
        session.add(payment)
        await session.flush()
        
        logger.info(
            f"Created MagicPay checkout session: payment_id={payment.id}, "
            f"session_id={checkout_data['session_id']}, reservation_id={reservation.id}"
        )
        
        return payment
    
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

