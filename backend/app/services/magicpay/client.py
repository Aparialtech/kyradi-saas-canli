"""MagicPay payment gateway client interface and implementations."""

from abc import ABC, abstractmethod
from typing import Any, Optional
from datetime import datetime
import secrets
import logging

logger = logging.getLogger(__name__)


# Supported payment modes - normalized to these values
DEMO_MODES = {"demo_local", "GATEWAY_DEMO", "demo", "fake"}
LIVE_MODES = {"live", "GATEWAY_LIVE", "GATEWAY", "production"}


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
    
    Supports payment modes: demo_local, GATEWAY_DEMO, demo, fake
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


def normalize_payment_mode(payment_mode: str) -> str:
    """Normalize payment mode to standard values.
    
    Args:
        payment_mode: Raw payment mode string
        
    Returns:
        Normalized mode: "demo" or "live"
    """
    mode_lower = payment_mode.lower() if payment_mode else ""
    
    if payment_mode in DEMO_MODES or mode_lower in {"demo_local", "gateway_demo", "demo", "fake"}:
        return "demo"
    if payment_mode in LIVE_MODES or mode_lower in {"live", "gateway_live", "gateway", "production"}:
        return "live"
    
    # Default to demo for unknown modes (safer than failing)
    logger.warning(f"Unknown payment_mode '{payment_mode}', defaulting to demo mode")
    return "demo"


def get_magicpay_client(
    payment_mode: str,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    base_url: Optional[str] = None,
) -> MagicPayClient:
    """Get MagicPay client instance based on payment mode.
    
    Supported modes:
    - Demo modes: "demo_local", "GATEWAY_DEMO", "demo", "fake" → FakeMagicPayClient
    - Live modes: "live", "GATEWAY_LIVE", "GATEWAY", "production" → RealMagicPayClient
    
    Args:
        payment_mode: Payment mode string (case-insensitive for most modes)
        api_key: API key (required for live mode)
        api_secret: API secret (required for live mode)
        base_url: Base URL (optional, defaults provided)
    
    Returns:
        MagicPayClient instance
    """
    normalized_mode = normalize_payment_mode(payment_mode)
    
    if normalized_mode == "demo":
        logger.debug(f"Creating FakeMagicPayClient for mode: {payment_mode}")
        return FakeMagicPayClient(base_url=base_url)
    elif normalized_mode == "live":
        if not api_key or not api_secret:
            raise ValueError("api_key and api_secret required for live mode")
        logger.debug(f"Creating RealMagicPayClient for mode: {payment_mode}")
        return RealMagicPayClient(
            api_key=api_key,
            api_secret=api_secret,
            base_url=base_url or "https://api.magicpay.com",
        )
    else:
        # This should not happen due to normalize_payment_mode defaulting to demo
        logger.error(f"Unexpected normalized mode: {normalized_mode}, using demo client")
        return FakeMagicPayClient(base_url=base_url)
