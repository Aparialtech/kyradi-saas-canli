"""Payment schedule and transfer endpoints with MagicPay integration."""

from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ...db.session import get_session
from ...dependencies import require_tenant_operator, require_admin_user
from ...models.tenant import User, Tenant
from ...models.payment_schedule import PaymentSchedule, PaymentTransfer, PaymentPeriod, TransferStatus
from ...services.audit import record_audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payment-schedules", tags=["payment-schedules"])


# ==================== Schemas ====================

class PaymentScheduleCreate(BaseModel):
    tenant_id: str
    is_enabled: bool = False
    period_type: str = PaymentPeriod.WEEKLY.value
    custom_days: Optional[int] = None
    min_transfer_amount: Decimal = Decimal("100.00")
    commission_rate: Decimal = Decimal("0.05")
    bank_name: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_swift: Optional[str] = None
    partner_can_request: bool = True
    admin_notes: Optional[str] = None


class PaymentScheduleUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    period_type: Optional[str] = None
    custom_days: Optional[int] = None
    min_transfer_amount: Optional[Decimal] = None
    commission_rate: Optional[Decimal] = None
    bank_name: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_swift: Optional[str] = None
    partner_can_request: Optional[bool] = None
    admin_notes: Optional[str] = None


class PaymentScheduleRead(BaseModel):
    id: str
    tenant_id: str
    is_enabled: bool
    period_type: str
    custom_days: Optional[int]
    min_transfer_amount: Decimal
    commission_rate: Decimal
    bank_name: Optional[str]
    bank_account_holder: Optional[str]
    bank_iban: Optional[str]
    bank_swift: Optional[str]
    next_payment_date: Optional[datetime]
    last_payment_date: Optional[datetime]
    partner_can_request: bool
    admin_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PaymentTransferCreate(BaseModel):
    gross_amount: Decimal
    notes: Optional[str] = None


class PaymentTransferUpdate(BaseModel):
    status: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    error_message: Optional[str] = None


class PaymentTransferRead(BaseModel):
    id: str
    tenant_id: str
    schedule_id: Optional[str]
    gross_amount: Decimal
    commission_amount: Decimal
    net_amount: Decimal
    status: str
    transfer_date: Optional[datetime]
    reference_id: Optional[str]
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    bank_name: Optional[str]
    bank_account_holder: Optional[str]
    bank_iban: Optional[str]
    is_manual_request: bool
    notes: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransferListResponse(BaseModel):
    data: List[PaymentTransferRead]
    meta: dict


class PartnerBalanceInfo(BaseModel):
    available_balance: Decimal
    pending_transfers: Decimal
    total_transferred: Decimal
    next_scheduled_date: Optional[datetime]
    can_request_transfer: bool
    min_transfer_amount: Decimal


# ==================== Admin Endpoints ====================

@router.get("/admin/all", response_model=List[PaymentScheduleRead])
async def list_all_schedules(
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> List[PaymentScheduleRead]:
    """List all payment schedules (admin only)."""
    stmt = select(PaymentSchedule).order_by(PaymentSchedule.created_at.desc())
    result = await session.execute(stmt)
    schedules = result.scalars().all()
    return [PaymentScheduleRead.model_validate(s) for s in schedules]


@router.post("/admin", response_model=PaymentScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: PaymentScheduleCreate,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentScheduleRead:
    """Create payment schedule for a tenant (admin only)."""
    # Check if tenant exists
    stmt = select(Tenant).where(Tenant.id == payload.tenant_id)
    tenant = (await session.execute(stmt)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant bulunamadı.")
    
    # Check if schedule already exists
    stmt = select(PaymentSchedule).where(PaymentSchedule.tenant_id == payload.tenant_id)
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu tenant için zaten bir ödeme planı mevcut.")
    
    schedule = PaymentSchedule(
        tenant_id=payload.tenant_id,
        is_enabled=payload.is_enabled,
        period_type=payload.period_type,
        custom_days=payload.custom_days,
        min_transfer_amount=payload.min_transfer_amount,
        commission_rate=payload.commission_rate,
        bank_name=payload.bank_name,
        bank_account_holder=payload.bank_account_holder,
        bank_iban=payload.bank_iban,
        bank_swift=payload.bank_swift,
        partner_can_request=payload.partner_can_request,
        admin_notes=payload.admin_notes,
    )
    
    if payload.is_enabled:
        schedule.next_payment_date = schedule.calculate_next_payment_date()
    
    session.add(schedule)
    
    await record_audit(
        session,
        tenant_id=payload.tenant_id,
        actor_user_id=current_user.id,
        action="payment_schedule.created",
        entity="payment_schedules",
        entity_id=schedule.id,
        meta={"period_type": payload.period_type},
    )
    
    await session.commit()
    await session.refresh(schedule)
    
    return PaymentScheduleRead.model_validate(schedule)


@router.get("/admin/{tenant_id}", response_model=PaymentScheduleRead)
async def get_schedule_by_tenant(
    tenant_id: str,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentScheduleRead:
    """Get payment schedule for a specific tenant (admin only)."""
    stmt = select(PaymentSchedule).where(PaymentSchedule.tenant_id == tenant_id)
    schedule = (await session.execute(stmt)).scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ödeme planı bulunamadı.")
    
    return PaymentScheduleRead.model_validate(schedule)


@router.patch("/admin/{schedule_id}", response_model=PaymentScheduleRead)
async def update_schedule(
    schedule_id: str,
    payload: PaymentScheduleUpdate,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentScheduleRead:
    """Update payment schedule (admin only)."""
    stmt = select(PaymentSchedule).where(PaymentSchedule.id == schedule_id)
    schedule = (await session.execute(stmt)).scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ödeme planı bulunamadı.")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    # Recalculate next payment date if enabled or period changed
    if payload.is_enabled is True or payload.period_type is not None:
        if schedule.is_enabled:
            schedule.next_payment_date = schedule.calculate_next_payment_date()
        else:
            schedule.next_payment_date = None
    
    await record_audit(
        session,
        tenant_id=schedule.tenant_id,
        actor_user_id=current_user.id,
        action="payment_schedule.updated",
        entity="payment_schedules",
        entity_id=schedule.id,
        meta={"updated_fields": list(update_data.keys())},
    )
    
    await session.commit()
    await session.refresh(schedule)
    
    return PaymentScheduleRead.model_validate(schedule)


@router.get("/admin/transfers/all", response_model=TransferListResponse)
async def list_all_transfers(
    status_filter: Optional[str] = Query(None, alias="status"),
    tenant_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> TransferListResponse:
    """List all transfers (admin only)."""
    stmt = select(PaymentTransfer)
    count_stmt = select(func.count(PaymentTransfer.id))
    
    if status_filter:
        stmt = stmt.where(PaymentTransfer.status == status_filter)
        count_stmt = count_stmt.where(PaymentTransfer.status == status_filter)
    
    if tenant_id:
        stmt = stmt.where(PaymentTransfer.tenant_id == tenant_id)
        count_stmt = count_stmt.where(PaymentTransfer.tenant_id == tenant_id)
    
    total = (await session.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.order_by(PaymentTransfer.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    
    result = await session.execute(stmt)
    transfers = result.scalars().all()
    
    return TransferListResponse(
        data=[PaymentTransferRead.model_validate(t) for t in transfers],
        meta={
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size,
        },
    )


@router.patch("/admin/transfers/{transfer_id}", response_model=PaymentTransferRead)
async def process_transfer(
    transfer_id: str,
    payload: PaymentTransferUpdate,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentTransferRead:
    """Process/update a transfer (admin only)."""
    stmt = select(PaymentTransfer).where(PaymentTransfer.id == transfer_id)
    transfer = (await session.execute(stmt)).scalar_one_or_none()
    
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer bulunamadı.")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == TransferStatus.COMPLETED.value:
            transfer.transfer_date = datetime.now(timezone.utc)
            transfer.processed_by_id = current_user.id
            transfer.processed_at = datetime.now(timezone.utc)
    
    for field, value in update_data.items():
        setattr(transfer, field, value)
    
    await record_audit(
        session,
        tenant_id=transfer.tenant_id,
        actor_user_id=current_user.id,
        action=f"payment_transfer.{payload.status or 'updated'}",
        entity="payment_transfers",
        entity_id=transfer.id,
        meta={"updated_fields": list(update_data.keys())},
    )
    
    await session.commit()
    await session.refresh(transfer)
    
    return PaymentTransferRead.model_validate(transfer)


# ==================== Partner Endpoints ====================

@router.get("", response_model=Optional[PaymentScheduleRead])
async def get_my_schedule(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> Optional[PaymentScheduleRead]:
    """Get payment schedule for current tenant (partner)."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant bilgisi bulunamadı.")
    
    stmt = select(PaymentSchedule).where(PaymentSchedule.tenant_id == current_user.tenant_id)
    schedule = (await session.execute(stmt)).scalar_one_or_none()
    
    if not schedule:
        return None
    
    return PaymentScheduleRead.model_validate(schedule)


@router.get("/balance", response_model=PartnerBalanceInfo)
async def get_balance_info(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PartnerBalanceInfo:
    """Get balance information for current tenant (partner)."""
    from ...models import Settlement
    
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant bilgisi bulunamadı.")
    
    # Get schedule
    stmt = select(PaymentSchedule).where(PaymentSchedule.tenant_id == current_user.tenant_id)
    schedule = (await session.execute(stmt)).scalar_one_or_none()
    
    # Calculate pending transfers
    stmt = select(func.coalesce(func.sum(PaymentTransfer.net_amount), 0)).where(
        PaymentTransfer.tenant_id == current_user.tenant_id,
        PaymentTransfer.status == TransferStatus.PENDING.value,
    )
    pending = (await session.execute(stmt)).scalar() or Decimal("0.00")
    
    # Calculate total transferred (completed)
    stmt = select(func.coalesce(func.sum(PaymentTransfer.net_amount), 0)).where(
        PaymentTransfer.tenant_id == current_user.tenant_id,
        PaymentTransfer.status == TransferStatus.COMPLETED.value,
    )
    total_transferred = (await session.execute(stmt)).scalar() or Decimal("0.00")
    
    # Calculate available balance from Kyradi commission (not yet transferred)
    # Total Kyradi commission from all settlements
    stmt = select(func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0)).where(
        Settlement.tenant_id == current_user.tenant_id
    )
    total_commission_minor = (await session.execute(stmt)).scalar() or 0
    total_commission = Decimal(str(total_commission_minor)) / Decimal("100")
    
    # Available = Total commission - Already transferred - Pending
    available_balance = total_commission - total_transferred - pending
    if available_balance < 0:
        available_balance = Decimal("0.00")
    
    return PartnerBalanceInfo(
        available_balance=available_balance,
        pending_transfers=pending,
        total_transferred=total_transferred,
        next_scheduled_date=schedule.next_payment_date if schedule else None,
        can_request_transfer=True,  # Always allow in demo mode
        min_transfer_amount=schedule.min_transfer_amount if schedule else Decimal("10.00"),
    )


@router.get("/transfers", response_model=TransferListResponse)
async def list_my_transfers(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> TransferListResponse:
    """List transfers for current tenant (partner)."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant bilgisi bulunamadı.")
    
    stmt = select(PaymentTransfer).where(PaymentTransfer.tenant_id == current_user.tenant_id)
    count_stmt = select(func.count(PaymentTransfer.id)).where(PaymentTransfer.tenant_id == current_user.tenant_id)
    
    if status_filter:
        stmt = stmt.where(PaymentTransfer.status == status_filter)
        count_stmt = count_stmt.where(PaymentTransfer.status == status_filter)
    
    total = (await session.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.order_by(PaymentTransfer.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    
    result = await session.execute(stmt)
    transfers = result.scalars().all()
    
    return TransferListResponse(
        data=[PaymentTransferRead.model_validate(t) for t in transfers],
        meta={
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size,
        },
    )


@router.post("/transfers/request", response_model=PaymentTransferRead, status_code=status.HTTP_201_CREATED)
async def request_transfer(
    payload: PaymentTransferCreate,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PaymentTransferRead:
    """Request a manual commission payment to Kyradi (partner)."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant bilgisi bulunamadı.")
    
    # Get or create schedule with default values for demo mode
    stmt = select(PaymentSchedule).where(PaymentSchedule.tenant_id == current_user.tenant_id)
    schedule = (await session.execute(stmt)).scalar_one_or_none()
    
    # Default values for demo mode
    commission_rate = Decimal("0.00")  # No commission on commission payments to Kyradi
    min_transfer = Decimal("10.00")
    
    if schedule:
        min_transfer = schedule.min_transfer_amount
        # commission_rate stays 0 - partner pays gross amount to Kyradi
    else:
        # Auto-create a default schedule for demo mode
        schedule = PaymentSchedule(
            tenant_id=current_user.tenant_id,
            is_enabled=True,
            period_type=PaymentPeriod.MONTHLY.value,
            min_transfer_amount=Decimal("10.00"),
            commission_rate=Decimal("0.05"),  # 5% Kyradi commission rate
            partner_can_request=True,
            admin_notes="Auto-created for demo mode",
        )
        session.add(schedule)
        await session.flush()  # Get the schedule ID
        logger.info(f"[Demo] Auto-created payment schedule for tenant {current_user.tenant_id}")
    
    if payload.gross_amount < min_transfer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum ödeme tutarı {min_transfer} TL'dir.",
        )
    
    # For commission payments TO Kyradi:
    # gross_amount = amount partner is paying
    # commission_amount = 0 (no additional commission)
    # net_amount = gross_amount (full amount goes to Kyradi)
    transfer = PaymentTransfer(
        tenant_id=current_user.tenant_id,
        schedule_id=schedule.id if schedule else None,
        gross_amount=payload.gross_amount,
        commission_amount=Decimal("0.00"),  # No commission on commission payments
        net_amount=payload.gross_amount,  # Full amount goes to Kyradi
        status=TransferStatus.PENDING.value,
        bank_name="Kyradi",
        bank_account_holder="Kyradi Teknoloji A.Ş.",
        bank_iban="TR00 0000 0000 0000 0000 0000 00",  # Demo IBAN
        is_manual_request=True,
        requested_by_id=current_user.id,
        requested_at=datetime.now(timezone.utc),
        notes=payload.notes or "[Komisyon Ödemesi] Partner -> Kyradi",
    )
    
    session.add(transfer)
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="payment_transfer.requested",
        entity="payment_transfers",
        entity_id=transfer.id,
        meta={"amount": str(payload.gross_amount)},
    )
    
    await session.commit()
    await session.refresh(transfer)
    
    return PaymentTransferRead.model_validate(transfer)


# ==================== MagicPay Demo Integration ====================

class MagicPayTransferRequest(BaseModel):
    transfer_id: str
    amount: Decimal
    currency: str = "TRY"
    recipient_iban: str
    recipient_name: str
    description: Optional[str] = None


class MagicPayTransferResponse(BaseModel):
    success: bool
    transaction_id: str
    reference_id: str
    status: str
    message: str
    processed_at: datetime
    amount: Decimal
    currency: str
    fee: Decimal = Decimal("0.00")


class CommissionSummary(BaseModel):
    total_commission: Decimal
    pending_commission: Decimal
    transferred_commission: Decimal
    available_commission: Decimal
    reservation_count: int
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


@router.get("/commission-summary", response_model=CommissionSummary)
async def get_commission_summary(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> CommissionSummary:
    """Get Kyradi commission summary for current tenant."""
    from ...models import Settlement
    
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant bilgisi bulunamadı.")
    
    # Total Kyradi commission from all settlements
    stmt = select(
        func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0).label("total_commission"),
        func.count(Settlement.id).label("count"),
        func.min(Settlement.created_at).label("period_start"),
        func.max(Settlement.created_at).label("period_end"),
    ).where(Settlement.tenant_id == current_user.tenant_id)
    
    result = (await session.execute(stmt)).one()
    total_commission_minor = result.total_commission or 0
    total_commission = Decimal(str(total_commission_minor)) / Decimal("100")
    
    # Pending transfers (gross_amount - commission goes to Kyradi)
    stmt = select(func.coalesce(func.sum(PaymentTransfer.gross_amount), 0)).where(
        PaymentTransfer.tenant_id == current_user.tenant_id,
        PaymentTransfer.status == TransferStatus.PENDING.value,
    )
    pending = (await session.execute(stmt)).scalar() or Decimal("0.00")
    
    # Already transferred (completed)
    stmt = select(func.coalesce(func.sum(PaymentTransfer.gross_amount), 0)).where(
        PaymentTransfer.tenant_id == current_user.tenant_id,
        PaymentTransfer.status == TransferStatus.COMPLETED.value,
    )
    transferred = (await session.execute(stmt)).scalar() or Decimal("0.00")
    
    available = total_commission - pending - transferred
    if available < 0:
        available = Decimal("0.00")
    
    return CommissionSummary(
        total_commission=total_commission,
        pending_commission=pending,
        transferred_commission=transferred,
        available_commission=available,
        reservation_count=result.count,
        period_start=result.period_start,
        period_end=result.period_end,
    )


@router.post("/transfers/{transfer_id}/process-magicpay", response_model=MagicPayTransferResponse)
async def process_transfer_with_magicpay(
    transfer_id: str,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> MagicPayTransferResponse:
    """
    Process a pending transfer via MagicPay gateway (DEMO MODE).
    
    This endpoint simulates MagicPay API integration.
    When real API key is provided, it will use actual MagicPay API.
    """
    stmt = select(PaymentTransfer).where(PaymentTransfer.id == transfer_id)
    transfer = (await session.execute(stmt)).scalar_one_or_none()
    
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer bulunamadı.")
    
    if transfer.status != TransferStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu transfer zaten işlenmiş. Mevcut durum: {transfer.status}"
        )
    
    # DEMO MODE: Simulate MagicPay API call
    # In production, this would call the actual MagicPay API
    demo_transaction_id = f"MPAY-{uuid.uuid4().hex[:12].upper()}"
    demo_reference_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
    
    logger.info(f"[MagicPay DEMO] Processing transfer {transfer_id}")
    logger.info(f"[MagicPay DEMO] Amount: {transfer.net_amount} TRY")
    logger.info(f"[MagicPay DEMO] Recipient IBAN: {transfer.bank_iban}")
    logger.info(f"[MagicPay DEMO] Transaction ID: {demo_transaction_id}")
    
    # Simulate API response (always success in demo mode)
    # In production, handle actual API response and errors
    
    # Update transfer status
    transfer.status = TransferStatus.COMPLETED.value
    transfer.transfer_date = datetime.now(timezone.utc)
    transfer.reference_id = demo_reference_id
    transfer.processed_by_id = current_user.id
    transfer.processed_at = datetime.now(timezone.utc)
    transfer.notes = f"{transfer.notes or ''}\n[MagicPay DEMO] Transaction: {demo_transaction_id}".strip()
    
    await record_audit(
        session,
        tenant_id=transfer.tenant_id,
        actor_user_id=current_user.id,
        action="payment_transfer.magicpay_processed",
        entity="payment_transfers",
        entity_id=transfer.id,
        meta={
            "demo_mode": True,
            "transaction_id": demo_transaction_id,
            "reference_id": demo_reference_id,
            "amount": str(transfer.net_amount),
        },
    )
    
    await session.commit()
    
    return MagicPayTransferResponse(
        success=True,
        transaction_id=demo_transaction_id,
        reference_id=demo_reference_id,
        status="completed",
        message="Transfer başarıyla işlendi (Demo Mod)",
        processed_at=datetime.now(timezone.utc),
        amount=transfer.net_amount,
        currency="TRY",
        fee=Decimal("0.00"),
    )


@router.post("/transfers/{transfer_id}/reject", response_model=PaymentTransferRead)
async def reject_transfer(
    transfer_id: str,
    reason: Optional[str] = Query(None, description="Red gerekçesi"),
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentTransferRead:
    """Reject a pending transfer (admin only)."""
    stmt = select(PaymentTransfer).where(PaymentTransfer.id == transfer_id)
    transfer = (await session.execute(stmt)).scalar_one_or_none()
    
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer bulunamadı.")
    
    if transfer.status != TransferStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bu transfer zaten işlenmiş. Mevcut durum: {transfer.status}"
        )
    
    transfer.status = TransferStatus.CANCELLED.value
    transfer.error_message = reason or "Admin tarafından reddedildi"
    transfer.processed_by_id = current_user.id
    transfer.processed_at = datetime.now(timezone.utc)
    
    await record_audit(
        session,
        tenant_id=transfer.tenant_id,
        actor_user_id=current_user.id,
        action="payment_transfer.rejected",
        entity="payment_transfers",
        entity_id=transfer.id,
        meta={"reason": reason},
    )
    
    await session.commit()
    await session.refresh(transfer)
    
    return PaymentTransferRead.model_validate(transfer)


class MagicPayConfigStatus(BaseModel):
    is_demo_mode: bool = True
    api_key_configured: bool = False
    gateway_name: str = "MagicPay"
    gateway_status: str = "demo"
    supported_currencies: List[str] = ["TRY", "USD", "EUR"]
    min_transfer_amount: Decimal = Decimal("10.00")
    max_transfer_amount: Decimal = Decimal("100000.00")


@router.get("/magicpay/status", response_model=MagicPayConfigStatus)
async def get_magicpay_status(
    current_user: User = Depends(require_admin_user),
) -> MagicPayConfigStatus:
    """
    Get MagicPay gateway configuration status.
    
    Returns demo mode status and configuration info.
    """
    # In production, check actual API key configuration
    from ...core.config import settings
    
    api_key_configured = hasattr(settings, 'magicpay_api_key') and bool(getattr(settings, 'magicpay_api_key', None))
    
    return MagicPayConfigStatus(
        is_demo_mode=not api_key_configured,
        api_key_configured=api_key_configured,
        gateway_name="MagicPay",
        gateway_status="active" if api_key_configured else "demo",
        supported_currencies=["TRY", "USD", "EUR"],
        min_transfer_amount=Decimal("10.00"),
        max_transfer_amount=Decimal("100000.00"),
    )
