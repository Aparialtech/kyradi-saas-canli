"""MagicPay payment gateway client interface and implementations."""

from abc import ABC, abstractmethod
from typing import Any, Optional
from datetime import datetime
import secrets
import logging

logger = logging.getLogger(__name__)


class MagicPayClient(ABC):
    """Interface for MagicPay payment gateway client.
    
    This interface defines the contract for MagicPay integration.
    Implementations can be:
    - FakeMagicPayClient: For demo/local development
    - RealMagicPayClient: For production integration with actual MagicPay API
    """
    
    @abstractmethod
    async def create_checkout_session(
        self,
        amount_minor: int,
        currency: str,
        reservation_id: str,
        customer_name: str,
        customer_email: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a checkout session for hosted payment page.
        
        Returns:
            dict with:
                - session_id: Unique session identifier
                - checkout_url: URL to redirect user to MagicPay hosted page
                - expires_at: Session expiration timestamp
        """
        raise NotImplementedError
    
    @abstractmethod
    async def verify_payment(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Verify payment status for a session.
        
        Returns:
            dict with:
                - status: "success" | "failed" | "pending"
                - transaction_id: Payment transaction ID
                - amount: Confirmed amount
        """
        raise NotImplementedError
    
    @abstractmethod
    async def simulate_success(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Simulate successful payment (demo/local only).
        
        This method should only work in demo/local mode.
        In production, payments are verified via webhooks.
        """
        raise NotImplementedError
    
    @abstractmethod
    async def simulate_failure(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Simulate failed payment (demo/local only)."""
        raise NotImplementedError


class FakeMagicPayClient(MagicPayClient):
    """Fake MagicPay client for demo/local development.
    
    This implementation simulates MagicPay behavior without actual API calls.
    It generates fake session IDs, checkout URLs, and transaction IDs.
    
    IMPORTANT: This should ONLY be used when payment_mode is "demo_local".
    """
    
    def __init__(self, base_url: Optional[str] = None):
        """Initialize fake MagicPay client.
        
        Args:
            base_url: Base URL for generating fake checkout URLs
        """
        self.base_url = base_url or "https://demo.magicpay.com"
        logger.info("FakeMagicPayClient initialized (demo/local mode)")
    
    async def create_checkout_session(
        self,
        amount_minor: int,
        currency: str,
        reservation_id: str,
        customer_name: str,
        customer_email: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a fake checkout session."""
        # Generate deterministic session ID based on reservation
        session_id = f"mp_session_{secrets.token_hex(16)}"
        
        # Generate fake checkout URL (will be handled by frontend demo page)
        checkout_url = f"/payments/magicpay/demo/{session_id}"
        
        # Session expires in 30 minutes
        expires_at = datetime.utcnow().timestamp() + (30 * 60)
        
        logger.info(
            f"FakeMagicPay: Created checkout session {session_id} "
            f"for reservation {reservation_id}, amount: {amount_minor} {currency}"
        )
        
        return {
            "session_id": session_id,
            "checkout_url": checkout_url,
            "expires_at": expires_at,
            "amount_minor": amount_minor,
            "currency": currency,
            "metadata": metadata or {},
        }
    
    async def verify_payment(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Verify payment status (always returns pending in fake mode)."""
        logger.info(f"FakeMagicPay: Verifying payment for session {session_id}")
        return {
            "status": "pending",
            "transaction_id": None,
            "amount": 0,
        }
    
    async def simulate_success(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Simulate successful payment."""
        transaction_id = f"mp_txn_{secrets.token_hex(16)}"
        
        logger.info(
            f"FakeMagicPay: Simulating successful payment for session {session_id}, "
            f"transaction_id: {transaction_id}"
        )
        
        return {
            "status": "success",
            "transaction_id": transaction_id,
            "captured_at": datetime.utcnow().isoformat(),
        }
    
    async def simulate_failure(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Simulate failed payment."""
        logger.info(f"FakeMagicPay: Simulating failed payment for session {session_id}")
        
        return {
            "status": "failed",
            "transaction_id": None,
            "error_code": "DEMO_FAILURE",
            "error_message": "Demo payment failure simulation",
        }


class RealMagicPayClient(MagicPayClient):
    """Real MagicPay client for production integration.
    
    This implementation will connect to actual MagicPay API.
    TODO: Implement when MagicPay API documentation is available.
    """
    
    def __init__(self, api_key: str, api_secret: str, base_url: str):
        """Initialize real MagicPay client.
        
        Args:
            api_key: MagicPay API key
            api_secret: MagicPay API secret
            base_url: MagicPay API base URL
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        logger.info("RealMagicPayClient initialized (production mode)")
    
    async def create_checkout_session(
        self,
        amount_minor: int,
        currency: str,
        reservation_id: str,
        customer_name: str,
        customer_email: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create checkout session via MagicPay API."""
        # TODO: Implement actual MagicPay API call
        raise NotImplementedError("RealMagicPayClient not yet implemented")
    
    async def verify_payment(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Verify payment via MagicPay API."""
        # TODO: Implement actual MagicPay API call
        raise NotImplementedError("RealMagicPayClient not yet implemented")
    
    async def simulate_success(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Not available in production mode."""
        raise ValueError("simulate_success is only available in demo/local mode")
    
    async def simulate_failure(
        self,
        session_id: str,
    ) -> dict[str, Any]:
        """Not available in production mode."""
        raise ValueError("simulate_failure is only available in demo/local mode")


def get_magicpay_client(
    payment_mode: str,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    base_url: Optional[str] = None,
) -> MagicPayClient:
    """Get MagicPay client instance based on payment mode.
    
    Args:
        payment_mode: "demo_local" | "live"
        api_key: API key (required for live mode)
        api_secret: API secret (required for live mode)
        base_url: Base URL (optional, defaults provided)
    
    Returns:
        MagicPayClient instance
    """
    if payment_mode == "demo_local":
        return FakeMagicPayClient(base_url=base_url)
    elif payment_mode == "live":
        if not api_key or not api_secret:
            raise ValueError("api_key and api_secret required for live mode")
        return RealMagicPayClient(
            api_key=api_key,
            api_secret=api_secret,
            base_url=base_url or "https://api.magicpay.com",
        )
    else:
        raise ValueError(f"Unknown payment_mode: {payment_mode}")

