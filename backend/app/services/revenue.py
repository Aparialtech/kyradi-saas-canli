"""Revenue and settlement calculation services."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Payment, PaymentStatus, Reservation, Settlement


async def calculate_settlement(
    session: AsyncSession,
    payment: Payment,
    commission_rate: float = 5.0,
) -> Settlement:
    """Calculate and create settlement record for a payment.
    
    This function can work with or without reservation_id.
    If reservation_id is None, it uses payment amount directly.
    """
    # Check if settlement already exists
    existing_stmt = select(Settlement).where(Settlement.payment_id == payment.id)
    existing_result = await session.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing
    
    # Get reservation if available (optional)
    reservation = None
    if payment.reservation_id:
        reservation = await session.get(Reservation, payment.reservation_id)
    
    # Use payment amount (reservation amount should match)
    total_amount_minor = payment.amount_minor
    commission_minor = int(total_amount_minor * commission_rate / 100.0)
    tenant_settlement_minor = total_amount_minor - commission_minor

    # Use reservation_id if available, otherwise use a placeholder
    # Note: Settlement model requires reservation_id, but payment might not have one
    # In this case, we'll use payment.id as a fallback (not ideal, but works)
    reservation_id_for_settlement = payment.reservation_id or payment.id

    settlement = Settlement(
        tenant_id=payment.tenant_id,
        payment_id=payment.id,
        reservation_id=reservation_id_for_settlement,
        total_amount_minor=total_amount_minor,
        tenant_settlement_minor=tenant_settlement_minor,
        kyradi_commission_minor=commission_minor,
        currency=payment.currency,
        status="pending",
        commission_rate=commission_rate,
    )

    session.add(settlement)
    await session.flush()
    return settlement


async def mark_settlement_completed(
    session: AsyncSession,
    settlement_id: str,
) -> Settlement:
    """Mark settlement as completed."""
    settlement = await session.get(Settlement, settlement_id)
    if settlement is None:
        raise ValueError("Settlement not found")

    settlement.status = "settled"
    settlement.settled_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(settlement)
    return settlement


async def get_tenant_revenue_summary(
    session: AsyncSession,
    tenant_id: str,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Get revenue summary for a tenant."""
    # Base query for completed payments
    stmt = select(
        func.sum(Settlement.total_amount_minor).label("total_revenue"),
        func.sum(Settlement.tenant_settlement_minor).label("tenant_settlement"),
        func.sum(Settlement.kyradi_commission_minor).label("kyradi_commission"),
        func.count(Settlement.id).label("transaction_count"),
    ).where(
        Settlement.tenant_id == tenant_id,
        Settlement.status == "settled",
    )

    if date_from:
        stmt = stmt.where(Settlement.settled_at >= date_from)
    if date_to:
        stmt = stmt.where(Settlement.settled_at <= date_to)

    result = await session.execute(stmt)
    row = result.first()

    return {
        "total_revenue_minor": row.total_revenue or 0,
        "tenant_settlement_minor": row.tenant_settlement or 0,
        "kyradi_commission_minor": row.kyradi_commission or 0,
        "transaction_count": row.transaction_count or 0,
    }


async def get_daily_revenue(
    session: AsyncSession,
    tenant_id: Optional[str] = None,
    date: Optional[datetime] = None,
) -> dict:
    """Get daily revenue for today or specified date."""
    if date is None:
        date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    date_end = date.replace(hour=23, minute=59, second=59, microsecond=999999)

    stmt = select(
        func.sum(Settlement.total_amount_minor).label("total_revenue"),
        func.sum(Settlement.tenant_settlement_minor).label("tenant_settlement"),
        func.sum(Settlement.kyradi_commission_minor).label("kyradi_commission"),
        func.count(Settlement.id).label("transaction_count"),
    ).where(
        Settlement.status == "settled",
        Settlement.settled_at >= date,
        Settlement.settled_at <= date_end,
    )

    if tenant_id:
        stmt = stmt.where(Settlement.tenant_id == tenant_id)

    result = await session.execute(stmt)
    row = result.first()

    return {
        "date": date.isoformat(),
        "total_revenue_minor": row.total_revenue or 0,
        "tenant_settlement_minor": row.tenant_settlement or 0,
        "kyradi_commission_minor": row.kyradi_commission or 0,
        "transaction_count": row.transaction_count or 0,
    }


async def get_revenue_by_payment_mode(
    session: AsyncSession,
    tenant_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> list[dict]:
    """Get revenue breakdown by payment mode (POS, CASH, GATEWAY)."""
    # Join Settlement with Payment to get payment mode
    stmt = select(
        Payment.mode.label("payment_mode"),
        func.sum(Settlement.total_amount_minor).label("total_revenue"),
        func.sum(Settlement.tenant_settlement_minor).label("tenant_settlement"),
        func.sum(Settlement.kyradi_commission_minor).label("kyradi_commission"),
        func.count(Settlement.id).label("transaction_count"),
    ).select_from(
        Settlement
    ).join(
        Payment, Settlement.payment_id == Payment.id
    ).where(
        Settlement.status == "settled",
    ).group_by(
        Payment.mode
    )

    if tenant_id:
        stmt = stmt.where(Settlement.tenant_id == tenant_id)
    if date_from:
        stmt = stmt.where(Settlement.settled_at >= date_from)
    if date_to:
        stmt = stmt.where(Settlement.settled_at <= date_to)

    result = await session.execute(stmt)
    rows = result.all()

    # Map payment modes to Turkish labels
    mode_labels = {
        "POS": "POS / Kart",
        "CASH": "Nakit",
        "GATEWAY_DEMO": "Online (Demo)",
        "GATEWAY_LIVE": "Online Ödeme",
    }

    return [
        {
            "mode": row.payment_mode,
            "label": mode_labels.get(row.payment_mode, row.payment_mode),
            "total_revenue_minor": row.total_revenue or 0,
            "tenant_settlement_minor": row.tenant_settlement or 0,
            "kyradi_commission_minor": row.kyradi_commission or 0,
            "transaction_count": row.transaction_count or 0,
        }
        for row in rows
    ]

