"""Gateway adapter for partner->admin transfer processing.

Keeps existing API contracts stable while allowing live provider switch via env.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import logging
import secrets
from typing import Optional

import httpx

from ..core.config import settings
from ..models.payment_schedule import PaymentTransfer

logger = logging.getLogger(__name__)


@dataclass
class TransferGatewayResult:
    success: bool
    transaction_id: str
    reference_id: str
    status: str
    message: str
    processed_at: datetime
    amount: Decimal
    currency: str
    fee: Decimal = Decimal("0.00")


class TransferGatewayClient(ABC):
    @property
    @abstractmethod
    def provider(self) -> str:  # pragma: no cover - interface
        raise NotImplementedError

    @property
    @abstractmethod
    def mode(self) -> str:  # pragma: no cover - interface
        raise NotImplementedError

    @abstractmethod
    async def process_transfer(self, transfer: PaymentTransfer) -> TransferGatewayResult:
        raise NotImplementedError


class DemoMagicPayTransferGateway(TransferGatewayClient):
    provider = "magicpay"
    mode = "demo"

    async def process_transfer(self, transfer: PaymentTransfer) -> TransferGatewayResult:
        transaction_id = f"MPAY-{secrets.token_hex(6).upper()}"
        reference_id = f"REF-{secrets.token_hex(4).upper()}"
        processed_at = datetime.now(timezone.utc)

        logger.info(
            "Transfer gateway demo success: transfer_id=%s tenant_id=%s amount=%s currency=TRY",
            transfer.id,
            transfer.tenant_id,
            transfer.net_amount,
        )

        return TransferGatewayResult(
            success=True,
            transaction_id=transaction_id,
            reference_id=reference_id,
            status="completed",
            message="Transfer başarıyla işlendi (Demo Mod)",
            processed_at=processed_at,
            amount=transfer.net_amount,
            currency="TRY",
            fee=Decimal("0.00"),
        )


class LiveHttpTransferGateway(TransferGatewayClient):
    provider = "magicpay"
    mode = "live"

    def __init__(self) -> None:
        self.base_url = (settings.transfer_gateway_api_url or "").rstrip("/")
        self.api_key = settings.transfer_gateway_api_key
        self.api_secret = settings.transfer_gateway_api_secret
        self.timeout_seconds = max(settings.transfer_gateway_timeout_ms / 1000.0, 1.0)

    def _is_configured(self) -> bool:
        return not self.get_missing_config_fields()

    def get_missing_config_fields(self) -> list[str]:
        missing: list[str] = []
        if not self.base_url:
            missing.append("TRANSFER_GATEWAY_API_URL")
        if not self.api_key:
            missing.append("TRANSFER_GATEWAY_API_KEY")
        return missing

    async def process_transfer(self, transfer: PaymentTransfer) -> TransferGatewayResult:
        if not self._is_configured():
            missing = ",".join(self.get_missing_config_fields())
            raise RuntimeError(f"TRANSFER_GATEWAY_NOT_CONFIGURED:{missing}")

        payload = {
            "transferId": transfer.id,
            "tenantId": transfer.tenant_id,
            "amount": str(transfer.net_amount),
            "currency": "TRY",
            "recipientIban": transfer.bank_iban,
            "recipientName": transfer.bank_account_holder,
            "description": transfer.notes or "Kyradi commission transfer",
            "requestedAt": (transfer.requested_at or transfer.created_at).isoformat() if (transfer.requested_at or transfer.created_at) else None,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        if self.api_secret:
            headers["X-Api-Secret"] = self.api_secret

        url = f"{self.base_url}/transfers"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code >= 400:
                raise RuntimeError(f"GATEWAY_HTTP_{response.status_code}")
            data = response.json() if response.content else {}

        if not data.get("success", True):
            raise RuntimeError(data.get("error_code") or "GATEWAY_REJECTED")

        return TransferGatewayResult(
            success=True,
            transaction_id=str(data.get("transaction_id") or data.get("transactionId") or ""),
            reference_id=str(data.get("reference_id") or data.get("referenceId") or transfer.id),
            status=str(data.get("status") or "completed"),
            message=str(data.get("message") or "Transfer başarıyla işlendi"),
            processed_at=datetime.now(timezone.utc),
            amount=Decimal(str(data.get("amount") or transfer.net_amount)),
            currency=str(data.get("currency") or "TRY"),
            fee=Decimal(str(data.get("fee") or "0.00")),
        )


def get_transfer_gateway_client() -> TransferGatewayClient:
    mode = (settings.transfer_gateway_mode or "demo").strip().lower()
    provider = (settings.transfer_gateway_provider or "magicpay").strip().lower()

    # Only one provider for now, but this keeps extension point stable.
    if provider != "magicpay":
        logger.warning("Unknown transfer gateway provider=%s, falling back to magicpay demo", provider)
        return DemoMagicPayTransferGateway()

    if mode == "live":
        return LiveHttpTransferGateway()
    return DemoMagicPayTransferGateway()
