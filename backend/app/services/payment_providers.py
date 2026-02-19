"""Payment provider integrations (PAYTR, iyzico, Stripe, Fake)."""

from typing import Any, Optional
from datetime import datetime
import secrets

from ..core.config import settings


class PaymentProvider:
    """Base payment provider interface."""
    
    async def create_payment_intent(
        self,
        amount_minor: int,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a payment intent."""
        raise NotImplementedError
    
    async def verify_payment(
        self,
        payment_intent_id: str,
    ) -> dict[str, Any]:
        """Verify payment status."""
        raise NotImplementedError


class FakePaymentProvider(PaymentProvider):
    """Fake payment provider for development and demo purposes.
    
    This provider simulates payment processing without actual payment gateway integration.
    Use this for testing and demonstration purposes.
    """
    
    async def create_payment_intent(
        self,
        amount_minor: int,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a fake payment intent - always succeeds immediately."""
        intent_id = f"fake_{secrets.token_hex(16)}"
        return {
            "provider": "fake",
            "intent_id": intent_id,
            "status": "pending",
            "payment_url": f"/demo/payment/{intent_id}",  # Demo URL
            "amount_minor": amount_minor,
            "currency": currency,
            "metadata": metadata,
        }
    
    async def verify_payment(
        self,
        payment_intent_id: str,
    ) -> dict[str, Any]:
        """Verify fake payment - always returns authorized for demo."""
        return {
            "status": "authorized",
            "amount": 0,
            "intent_id": payment_intent_id,
        }
    
    async def simulate_payment_success(
        self,
        payment_intent_id: str,
    ) -> dict[str, Any]:
        """Simulate successful payment - for demo flow."""
        return {
            "status": "captured",
            "intent_id": payment_intent_id,
            "captured_at": datetime.now().isoformat(),
        }


class PAYTRProvider(PaymentProvider):
    """PAYTR payment provider."""
    
    async def create_payment_intent(
        self,
        amount_minor: int,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Create PAYTR payment intent."""
        # TODO: Implement PAYTR API integration
        # For now, return mock data
        return {
            "provider": "paytr",
            "intent_id": f"paytr_{datetime.now().timestamp()}",
            "status": "pending",
            "payment_url": "https://paytr.com/payment/mock",
        }
    
    async def verify_payment(
        self,
        payment_intent_id: str,
    ) -> dict[str, Any]:
        """Verify PAYTR payment."""
        # TODO: Implement PAYTR verification
        return {
            "status": "authorized",
            "amount": 0,
        }


class IyzicoProvider(PaymentProvider):
    """iyzico payment provider."""
    
    async def create_payment_intent(
        self,
        amount_minor: int,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Create iyzico payment intent."""
        # TODO: Implement iyzico API integration
        return {
            "provider": "iyzico",
            "intent_id": f"iyzico_{datetime.now().timestamp()}",
            "status": "pending",
            "payment_url": "https://iyzico.com/payment/mock",
        }
    
    async def verify_payment(
        self,
        payment_intent_id: str,
    ) -> dict[str, Any]:
        """Verify iyzico payment."""
        # TODO: Implement iyzico verification
        return {
            "status": "authorized",
            "amount": 0,
        }


class StripeProvider(PaymentProvider):
    """Stripe payment provider."""
    
    async def create_payment_intent(
        self,
        amount_minor: int,
        currency: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Create Stripe payment intent."""
        # TODO: Implement Stripe API integration
        if not settings.stripe_api_key:
            raise ValueError("Stripe API key not configured")
        
        return {
            "provider": "stripe",
            "intent_id": f"stripe_{datetime.now().timestamp()}",
            "status": "pending",
            "payment_url": "https://stripe.com/payment/mock",
        }
    
    async def verify_payment(
        self,
        payment_intent_id: str,
    ) -> dict[str, Any]:
        """Verify Stripe payment."""
        # TODO: Implement Stripe verification
        return {
            "status": "authorized",
            "amount": 0,
        }


def get_payment_provider(provider_name: str) -> PaymentProvider:
    """Get payment provider instance."""
    providers = {
        "fake": FakePaymentProvider(),
        "paytr": PAYTRProvider(),
        "iyzico": IyzicoProvider(),
        "stripe": StripeProvider(),
    }
    provider = providers.get(provider_name.lower())
    if not provider:
        raise ValueError(f"Unknown payment provider: {provider_name}")
    return provider

