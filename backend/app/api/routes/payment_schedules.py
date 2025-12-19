"""Payment schedule and transfer endpoints."""

from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ...db.session import get_session
from ...dependencies import require_tenant_operator, require_admin_user
from ...models.tenant import User, Tenant
from ...models.payment_schedule import PaymentSchedule, PaymentTransfer, PaymentPeriod, TransferStatus
from ...services.audit import record_audit

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
    
    # Calculate total transferred
    stmt = select(func.coalesce(func.sum(PaymentTransfer.net_amount), 0)).where(
        PaymentTransfer.tenant_id == current_user.tenant_id,
        PaymentTransfer.status == TransferStatus.COMPLETED.value,
    )
    total_transferred = (await session.execute(stmt)).scalar() or Decimal("0.00")
    
    # TODO: Calculate available balance from settlements/payments
    # For now, return 0 - this should be integrated with the actual revenue system
    available_balance = Decimal("0.00")
    
    return PartnerBalanceInfo(
        available_balance=available_balance,
        pending_transfers=pending,
        total_transferred=total_transferred,
        next_scheduled_date=schedule.next_payment_date if schedule else None,
        can_request_transfer=schedule.partner_can_request if schedule else False,
        min_transfer_amount=schedule.min_transfer_amount if schedule else Decimal("100.00"),
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
    """Request a manual transfer (partner)."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant bilgisi bulunamadı.")
    
    # Get schedule
    stmt = select(PaymentSchedule).where(PaymentSchedule.tenant_id == current_user.tenant_id)
    schedule = (await session.execute(stmt)).scalar_one_or_none()
    
    if not schedule:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ödeme planı bulunamadı. Lütfen yöneticiyle iletişime geçin.")
    
    if not schedule.partner_can_request:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manuel transfer talep etme yetkiniz bulunmuyor.")
    
    if payload.gross_amount < schedule.min_transfer_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum transfer tutarı {schedule.min_transfer_amount} TL'dir.",
        )
    
    # Calculate commission and net amount
    commission = payload.gross_amount * schedule.commission_rate
    net_amount = payload.gross_amount - commission
    
    transfer = PaymentTransfer(
        tenant_id=current_user.tenant_id,
        schedule_id=schedule.id,
        gross_amount=payload.gross_amount,
        commission_amount=commission,
        net_amount=net_amount,
        status=TransferStatus.PENDING.value,
        bank_name=schedule.bank_name,
        bank_account_holder=schedule.bank_account_holder,
        bank_iban=schedule.bank_iban,
        is_manual_request=True,
        requested_by_id=current_user.id,
        requested_at=datetime.now(timezone.utc),
        notes=payload.notes,
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
