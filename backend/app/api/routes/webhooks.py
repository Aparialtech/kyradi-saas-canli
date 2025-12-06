"""External webhook endpoints."""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...models import Payment, PaymentStatus
from ...schemas import PaymentWebhookPayload
from ...services.revenue import calculate_settlement
from ...services.quota_checks import get_tenant_commission_rate

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/payments")
async def handle_payment_webhook(
    payload: PaymentWebhookPayload,
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Stub webhook receiver updating payment status."""
    data = payload.data
    intent_id = data.get("intent_id") or data.get("provider_intent_id")
    status_value = data.get("status", PaymentStatus.AUTHORIZED.value)

    if not intent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing provider intent id")

    payment_result = await session.execute(select(Payment).where(Payment.provider_intent_id == intent_id))
    payment = payment_result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if status_value not in PaymentStatus._value2member_map_:
        status_value = PaymentStatus.AUTHORIZED.value

    payment.status = status_value
    await session.commit()
    
    # Create settlement when payment is captured/authorized
    if status_value in (PaymentStatus.CAPTURED.value, PaymentStatus.AUTHORIZED.value):
        # Check if settlement already exists
        from ...models import Settlement
        from sqlalchemy import select as sql_select
        existing_settlement = await session.execute(
            sql_select(Settlement).where(Settlement.payment_id == payment.id)
        )
        if existing_settlement.scalar_one_or_none() is None:
            # Create settlement with tenant-specific commission rate
            commission_rate = await get_tenant_commission_rate(session, payment.tenant_id)
            await calculate_settlement(session, payment, commission_rate=commission_rate)
            await session.commit()
    
    return {"ok": True, "payment_id": payment.id, "status": payment.status}
