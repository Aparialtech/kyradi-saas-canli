"""Tests for settlement functionality."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Payment, PaymentStatus, Reservation, ReservationStatus, Settlement, Storage, Tenant, User
from app.services.revenue import calculate_settlement


@pytest.mark.asyncio
async def test_calculate_settlement(session: AsyncSession):
    """Test settlement calculation."""
    # Create tenant
    tenant = Tenant(
        id="test-tenant-123",
        slug="test-tenant",
        name="Test Tenant",
        plan="standard",
    )
    session.add(tenant)
    
    # Create storage
    storage = Storage(
        id="test-storage-123",
        tenant_id=tenant.id,
        location_id="test-location-123",
        code="STORAGE-001",
        status="idle",
    )
    session.add(storage)
    
    # Create reservation
    reservation = Reservation(
        id="test-reservation-123",
        tenant_id=tenant.id,
        storage_id=storage.id,
        status=ReservationStatus.ACTIVE.value,
        amount_minor=10000,  # 100.00 TRY
    )
    session.add(reservation)
    
    # Create payment
    payment = Payment(
        id="test-payment-123",
        tenant_id=tenant.id,
        reservation_id=reservation.id,
        provider="stripe",
        provider_intent_id="stripe_intent_123",
        status=PaymentStatus.CAPTURED.value,
        amount_minor=10000,
        currency="TRY",
    )
    session.add(payment)
    await session.commit()
    
    # Calculate settlement
    settlement = await calculate_settlement(session, payment, commission_rate=5.0)
    
    assert settlement.tenant_id == tenant.id
    assert settlement.payment_id == payment.id
    assert settlement.reservation_id == reservation.id
    assert settlement.total_amount_minor == 10000
    assert settlement.kyradi_commission_minor == 500  # 5% of 10000
    assert settlement.tenant_settlement_minor == 9500  # 10000 - 500
    assert settlement.commission_rate == 5.0
    assert settlement.status == "pending"


@pytest.mark.asyncio
async def test_settlement_properties(session: AsyncSession):
    """Test settlement property methods."""
    settlement = Settlement(
        id="test-settlement-123",
        tenant_id="test-tenant-123",
        payment_id="test-payment-123",
        reservation_id="test-reservation-123",
        total_amount_minor=10000,
        tenant_settlement_minor=9500,
        kyradi_commission_minor=500,
        currency="TRY",
        commission_rate=5.0,
    )
    
    assert settlement.total_amount == 100.0
    assert settlement.tenant_settlement == 95.0
    assert settlement.kyradi_commission == 5.0

