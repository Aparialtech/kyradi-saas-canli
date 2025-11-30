"""Convert widget reservations to normal reservations with storage assignment."""

from datetime import datetime, timezone, date, timedelta
from typing import Optional
import logging

from sqlalchemy import select, and_, or_, func
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Reservation, ReservationStatus, Storage, StorageStatus, Tenant
from ..schemas import ReservationCreate
from .reservations import create_reservation as create_reservation_service

logger = logging.getLogger(__name__)


async def find_available_storage(
    session: AsyncSession,
    tenant_id: str,
    start_at: datetime,
    end_at: datetime,
    preferred_location_id: Optional[str] = None,
) -> Optional[Storage]:
    """Find an available storage for the given time window.
    
    Args:
        session: Database session
        tenant_id: Tenant ID
        start_at: Reservation start time
        end_at: Reservation end time
        preferred_location_id: Optional preferred location ID
        
    Returns:
        Available Storage or None if none found
    """
    # First, try to find idle storages and check for overlaps
    stmt = select(Storage).where(
        Storage.tenant_id == tenant_id,
        Storage.status == StorageStatus.IDLE.value,
    )
    
    if preferred_location_id:
        stmt = stmt.where(Storage.location_id == preferred_location_id)
    
    # Order by creation date to pick the oldest available
    stmt = stmt.order_by(Storage.created_at.asc())
    
    result = await session.execute(stmt)
    storages = result.scalars().all()
    
    # Check each storage for overlaps with blocking statuses (RESERVED, ACTIVE)
    for storage in storages:
        overlap_stmt = select(func.count()).where(
            Reservation.storage_id == storage.id,
            Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
            or_(
                and_(
                    sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) <= start_at,
                    sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) > start_at
                ),
                and_(
                    sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) < end_at,
                    sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) >= end_at
                ),
                and_(
                    sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) >= start_at,
                    sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) <= end_at
                ),
            ),
        )
        overlap_count = (await session.execute(overlap_stmt)).scalar_one()
        if overlap_count == 0:
            # No overlap, this storage is available
            return storage
    
    # If no idle storage without overlap, try any storage (even if occupied)
    stmt = select(Storage).where(
        Storage.tenant_id == tenant_id,
    )
    
    if preferred_location_id:
        stmt = stmt.where(Storage.location_id == preferred_location_id)
    
    stmt = stmt.order_by(Storage.created_at.asc())
    result = await session.execute(stmt)
    storages = result.scalars().all()
    
    # Check each storage for overlaps with blocking statuses (RESERVED, ACTIVE)
    for storage in storages:
        overlap_stmt = select(func.count()).where(
            Reservation.storage_id == storage.id,
            Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
            or_(
                and_(
                    sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) <= start_at,
                    sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) > start_at
                ),
                and_(
                    sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) < end_at,
                    sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) >= end_at
                ),
                and_(
                    sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) >= start_at,
                    sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) <= end_at
                ),
            ),
        )
        overlap_count = (await session.execute(overlap_stmt)).scalar_one()
        if overlap_count == 0:
            # No overlap, this storage is available
            return storage
    
    # No available storage found
    return None


async def convert_widget_reservation_to_reservation(
    session: AsyncSession,
    widget_reservation_id: int,
    tenant_id: str,
    storage_id: Optional[str] = None,
    preferred_location_id: Optional[str] = None,
) -> Reservation:
    """Convert a WidgetReservation to a normal Reservation with storage assignment.
    
    This function:
    1. Finds or assigns a storage
    2. Converts WidgetReservation data to Reservation format
    3. Creates the Reservation record
    4. Updates storage status to OCCUPIED
    
    Args:
        session: Database session
        widget_reservation_id: WidgetReservation ID (integer)
        tenant_id: Tenant ID
        storage_id: Optional specific storage ID to assign
        preferred_location_id: Optional preferred location ID
        
    Returns:
        Created Reservation
    """
    from reservations.models import WidgetReservation
    
    # Get widget reservation
    widget_reservation = await session.get(WidgetReservation, widget_reservation_id)
    if widget_reservation is None:
        raise ValueError(f"WidgetReservation {widget_reservation_id} not found")
    
    if widget_reservation.tenant_id != tenant_id:
        raise ValueError("Tenant mismatch")
    
    # Check if already converted - if so, find and return the existing reservation
    if widget_reservation.status == "converted":
        # Try to find the existing reservation by matching customer info and dates
        # Use first() instead of scalar_one_or_none() to avoid MultipleResultsFound error
        existing_reservation_stmt = select(Reservation).where(
            Reservation.tenant_id == tenant_id,
            Reservation.customer_name == widget_reservation.guest_name,
            Reservation.customer_phone == widget_reservation.guest_phone,
        )
        
        # If we have dates, also match them
        if widget_reservation.checkin_date and widget_reservation.checkout_date:
            start_at = datetime.combine(
                widget_reservation.checkin_date,
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
            end_at = datetime.combine(
                widget_reservation.checkout_date,
                datetime.max.time().replace(microsecond=0),
                tzinfo=timezone.utc,
            )
            existing_reservation_stmt = existing_reservation_stmt.where(
                Reservation.start_at >= start_at,
                Reservation.end_at <= end_at,
            )
        
        existing_reservation_stmt = existing_reservation_stmt.order_by(Reservation.created_at.desc())
        existing_result = await session.execute(existing_reservation_stmt)
        existing_reservation = existing_result.scalars().first()
        
        if existing_reservation:
            # Return the existing reservation instead of raising an error
            # This allows the user to see the already-converted reservation
            return existing_reservation
        else:
            # Status says converted but no reservation found - reset status and continue
            # This handles edge cases where conversion failed but status was set
            widget_reservation.status = "pending"
            await session.flush()
    
    # Convert dates
    if widget_reservation.checkin_date and widget_reservation.checkout_date:
        # Convert date to datetime (start of day for checkin, end of day for checkout)
        start_at = datetime.combine(
            widget_reservation.checkin_date,
            datetime.min.time(),
            tzinfo=timezone.utc,
        )
        end_at = datetime.combine(
            widget_reservation.checkout_date,
            datetime.max.time().replace(microsecond=0),
            tzinfo=timezone.utc,
        )
    else:
        # Default to current time + 1 hour window for hourly reservations
        now = datetime.now(timezone.utc)
        start_at = now.replace(second=0, microsecond=0)
        end_at = start_at + timedelta(hours=1)
    
    # Calculate amount using pricing service BEFORE any storage operations
    # This prevents transaction abort issues if pricing_rules table doesn't exist
    try:
        from .pricing import calculate_reservation_price
        amount_minor = await calculate_reservation_price(
            session,
            tenant_id=tenant_id,
            start_at=start_at,
            end_at=end_at,
        )
    except Exception as pricing_exc:
        # If pricing calculation fails, use default pricing
        # Note: We don't rollback here because pricing check happens before any writes
        # Default: 15 TL per hour, minimum 1 hour
        duration_hours = max(int((end_at - start_at).total_seconds() // 3600) or 1, 1)
        amount_minor = duration_hours * 1500  # 15 TL per hour in kuruş
    
    # Find or assign storage
    if storage_id:
        storage = await session.get(Storage, storage_id)
        if storage is None or storage.tenant_id != tenant_id:
            raise ValueError(f"Storage {storage_id} not found or tenant mismatch")
    else:
        # First check if tenant has any storages at all
        storage_count_stmt = select(func.count()).where(Storage.tenant_id == tenant_id)
        storage_count = (await session.execute(storage_count_stmt)).scalar_one()
        
        if storage_count == 0:
            raise ValueError(
                "Tenant'ın hiç depo birimi yok. Lütfen önce depo birimleri ekleyin. "
                "Depo Yönetimi sayfasından yeni depo birimleri oluşturabilirsiniz."
            )
        
        storage = await find_available_storage(
            session,
            tenant_id=tenant_id,
            start_at=start_at,
            end_at=end_at,
            preferred_location_id=preferred_location_id,
        )
        if storage is None:
            # Get existing reservations to provide helpful error message
            existing_stmt = select(Reservation).where(
                Reservation.tenant_id == tenant_id,
                Reservation.status == ReservationStatus.ACTIVE.value,
            )
            existing_result = await session.execute(existing_stmt)
            existing_reservations = existing_result.scalars().all()
            
            # Get all storages to show how many are available
            all_storages_stmt = select(Storage).where(Storage.tenant_id == tenant_id)
            all_storages_result = await session.execute(all_storages_stmt)
            all_storages = all_storages_result.scalars().all()
            idle_storages = [s for s in all_storages if s.status == StorageStatus.IDLE.value]
            
            if existing_reservations:
                dates_info = ", ".join([
                    f"{r.start_at.date()} to {r.end_at.date()}" 
                    for r in existing_reservations[:3]
                ])
                raise ValueError(
                    f"Seçilen tarihler için uygun depo bulunamadı ({start_at.date()} - {end_at.date()}). "
                    f"Mevcut rezervasyonlar: {dates_info}. "
                    f"Toplam {len(all_storages)} depo birimi var, {len(idle_storages)} tanesi boş. "
                    f"Lütfen farklı tarihler deneyin veya yeni depo birimleri ekleyin."
                )
            else:
                raise ValueError(
                    f"Seçilen tarihler için uygun depo bulunamadı ({start_at.date()} - {end_at.date()}). "
                    f"Toplam {len(all_storages)} depo birimi var, {len(idle_storages)} tanesi boş. "
                    f"Lütfen yeni depo birimleri ekleyin veya farklı tarihler deneyin."
                )
    
    # Check for overlap before locking the storage
    
    overlap_stmt = select(func.count()).where(
        Reservation.storage_id == storage.id,
        Reservation.status == ReservationStatus.ACTIVE.value,
        or_(
            and_(Reservation.start_at <= start_at, Reservation.end_at > start_at),
            and_(Reservation.start_at < end_at, Reservation.end_at >= end_at),
            and_(Reservation.start_at >= start_at, Reservation.end_at <= end_at),
        ),
    )
    overlap_count = (await session.execute(overlap_stmt)).scalar_one()
    
    # If there's an overlap or storage is already occupied, find another storage
    if overlap_count > 0 or storage.status == StorageStatus.OCCUPIED.value:
        # Try to find another available storage
        storage = await find_available_storage(
            session,
            tenant_id=tenant_id,
            start_at=start_at,
            end_at=end_at,
            preferred_location_id=preferred_location_id,
        )
        if storage is None:
            raise ValueError("No available storage found. All storages are currently reserved.")
        
        # Double-check the new storage
        overlap_stmt = select(func.count()).where(
            Reservation.storage_id == storage.id,
            Reservation.status == ReservationStatus.ACTIVE.value,
            or_(
                and_(Reservation.start_at <= start_at, Reservation.end_at > start_at),
                and_(Reservation.start_at < end_at, Reservation.end_at >= end_at),
                and_(Reservation.start_at >= start_at, Reservation.end_at <= end_at),
            ),
        )
        overlap_count = (await session.execute(overlap_stmt)).scalar_one()
        if overlap_count > 0:
            raise ValueError("Storage conflict detected. Please try again.")
    
    # Lock the storage immediately by updating its status to OCCUPIED
    # This prevents race conditions where multiple conversions try to use the same storage
    storage.status = StorageStatus.OCCUPIED.value
    await session.flush()
    
    # Calculate duration and pricing (pricing kuralı sonucu amount_minor ile uyumlu)
    duration_seconds = (end_at - start_at).total_seconds()
    duration_hours = max(duration_seconds / 3600.0, 0.01)
    
    tenant = await session.get(Tenant, tenant_id)
    hourly_rate = tenant.default_hourly_rate if tenant and tenant.default_hourly_rate else 1500
    estimated_total_price = amount_minor
    if duration_hours > 0:
        # Fiyatlandırma kuralı saatlik değilse bile görsel tutarlılık için efektif saatlik ücret türet
        hourly_rate = int(amount_minor / duration_hours)
    
    # Create reservation payload
    # Map widget reservation fields to ReservationCreate
    reservation_payload = ReservationCreate(
        storage_id=storage.id,
        customer_name=widget_reservation.full_name or widget_reservation.guest_name,
        full_name=widget_reservation.full_name or widget_reservation.guest_name,
        customer_phone=widget_reservation.phone_number or widget_reservation.guest_phone,
        phone_number=widget_reservation.phone_number or widget_reservation.guest_phone,
        customer_email=widget_reservation.guest_email,
        tc_identity_number=widget_reservation.tc_identity_number,
        passport_number=widget_reservation.passport_number,
        hotel_room_number=widget_reservation.hotel_room_number,
        start_at=start_at,  # Backward compatibility
        end_at=end_at,  # Backward compatibility
        start_datetime=start_at,
        end_datetime=end_at,
        duration_hours=float(duration_hours),
        hourly_rate=hourly_rate,
        estimated_total_price=estimated_total_price,
        baggage_count=widget_reservation.luggage_count or widget_reservation.baggage_count or 1,
        baggage_type=widget_reservation.locker_size,  # Map locker_size to baggage_type
        notes=widget_reservation.notes,
        kvkk_consent=widget_reservation.kvkk_consent or widget_reservation.kvkk_approved,
        terms_consent=widget_reservation.terms_consent,
    )
    
    # amount_minor is already calculated above, before storage operations
    qr_code = f"QR-{storage.id[:6]}-{datetime.now(timezone.utc).timestamp():.0f}"
    
    try:
        reservation = Reservation(
            tenant_id=tenant_id,
            storage_id=storage.id,
            customer_name=reservation_payload.customer_name,
            full_name=reservation_payload.full_name,
            customer_phone=reservation_payload.customer_phone,
            phone_number=reservation_payload.phone_number,
            customer_email=reservation_payload.customer_email,
            tc_identity_number=reservation_payload.tc_identity_number,
            passport_number=reservation_payload.passport_number,
            hotel_room_number=reservation_payload.hotel_room_number,
            start_at=start_at,  # Backward compatibility
            end_at=end_at,  # Backward compatibility
            start_datetime=reservation_payload.start_datetime,
            end_datetime=reservation_payload.end_datetime,
            duration_hours=reservation_payload.duration_hours,
            hourly_rate=reservation_payload.hourly_rate,
            estimated_total_price=reservation_payload.estimated_total_price,
            status=ReservationStatus.RESERVED.value,  # Widget reservations start as RESERVED
            amount_minor=amount_minor,
            currency="TRY",
            qr_code=qr_code,
            created_by_user_id=None,
            baggage_count=reservation_payload.baggage_count or 1,
            baggage_type=reservation_payload.baggage_type,
            notes=reservation_payload.notes,
            kvkk_consent=reservation_payload.kvkk_consent,
            terms_consent=reservation_payload.terms_consent,
        )
        
        session.add(reservation)
        await session.flush()
    except Exception as create_exc:
        # Rollback storage status change
        storage.status = StorageStatus.IDLE.value
        await session.flush()
        raise ValueError(f"Failed to create reservation: {str(create_exc)}") from create_exc
    
    # Update widget reservation status
    widget_reservation.status = "converted"
    await session.flush()
    
    # Create payment record automatically
    # Payment will be created in PENDING status
    # For gateway mode, checkout session will be created
    try:
        from .payment_service import create_payment_for_reservation
        
        # Determine payment mode from tenant config or default to GATEWAY_DEMO
        # tenant already fetched above, reuse it
        if tenant is None:
            tenant = await session.get(Tenant, tenant_id)
        tenant_metadata = getattr(tenant, "metadata_", None)
        if tenant_metadata is None:
            tenant_metadata = {}
        if isinstance(tenant_metadata, str):
            try:
                import json

                tenant_metadata = json.loads(tenant_metadata)
            except Exception:
                tenant_metadata = {}
        payment_mode = tenant_metadata.get("payment_mode", "GATEWAY_DEMO")
        
        payment = await create_payment_for_reservation(
            session,
            reservation=reservation,
            storage=storage,
            mode=payment_mode,
            create_checkout_session=(payment_mode == "GATEWAY_DEMO"),
        )
        await session.flush()
        
        logger.info(
            f"Auto-created payment for converted reservation: reservation_id={reservation.id}, "
            f"payment_id={payment.id}, mode={payment_mode}"
        )
    except Exception as exc:
        logger.error(f"Failed to create payment for converted reservation: {exc}", exc_info=True)
        # Don't fail conversion if payment creation fails
        # Payment can be created manually later
    
    return reservation
