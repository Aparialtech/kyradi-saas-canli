"""Convert widget reservations to normal reservations with storage assignment.

Bu modül widget rezervasyonlarını normal rezervasyonlara çevirir ve ödeme kaydı oluşturur.

PAYMENT FLOW:
1. Widget reservation oluşturulur
2. Normal reservation'a convert edilir
3. get_or_create_payment ile SADECE 1 payment oluşturulur
4. Duplicate payment INSERT denemesi YAPILMAZ
"""

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
    
    Bu fonksiyon:
    1. Storage bulur veya atar
    2. WidgetReservation verisini Reservation formatına çevirir
    3. Reservation kaydı oluşturur
    4. Storage durumunu OCCUPIED yapar
    5. get_or_create_payment ile SADECE 1 payment oluşturur (duplicate yok!)
    
    PAYMENT DUPLICATE KORUMASI:
    - Payment oluşturma için get_or_create_payment kullanılır
    - Bu fonksiyon önce mevcut payment kontrol eder
    - Mevcut varsa tekrar INSERT yapmaz
    - "Existing payment detected, skipping creation…" logu görürseniz duplicate engellendi demektir
    
    Args:
        session: Database session
        widget_reservation_id: WidgetReservation ID (integer)
        tenant_id: Tenant ID
        storage_id: Optional specific storage ID to assign
        preferred_location_id: Optional preferred location ID
        
    Returns:
        Created Reservation
    """
    from app.reservations.models import WidgetReservation
    
    # Get widget reservation
    widget_reservation = await session.get(WidgetReservation, widget_reservation_id)
    if widget_reservation is None:
        raise ValueError(f"WidgetReservation {widget_reservation_id} not found")
    
    if widget_reservation.tenant_id != tenant_id:
        raise ValueError("Tenant mismatch")
    
    # Check if already converted - if so, find and return the existing reservation
    if widget_reservation.status == "converted":
        logger.info(
            f"Widget reservation {widget_reservation_id} is already converted. "
            f"Looking for existing reservation..."
        )
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
            logger.info(
                f"Found existing reservation {existing_reservation.id} for "
                f"already-converted widget reservation {widget_reservation_id}"
            )
            # Return the existing reservation instead of raising an error
            # This allows the user to see the already-converted reservation
            return existing_reservation
        else:
            # Status says converted but no reservation found - reset status and continue
            # This handles edge cases where conversion failed but status was set
            logger.warning(
                f"Widget reservation {widget_reservation_id} marked as converted but "
                f"no matching reservation found. Resetting status to pending."
            )
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
    
    # Base baggage count used by pricing and reservation records.
    baggage_count = widget_reservation.luggage_count or widget_reservation.baggage_count or 1
    
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
    
    # Calculate amount using centralized pricing rules with the ACTUAL selected storage/location.
    amount_minor: int
    try:
        from .pricing_calculator import calculate_reservation_price as calc_price

        price_result = await calc_price(
            session=session,
            tenant_id=tenant_id,
            start_datetime=start_at,
            end_datetime=end_at,
            baggage_count=baggage_count,
            location_id=storage.location_id,
            storage_id=storage.id,
        )
        amount_minor = price_result.total_minor

        # Keep widget record in sync with the final backend-calculated amount.
        widget_reservation.amount_minor = amount_minor
        widget_reservation.currency = price_result.currency
        widget_reservation.pricing_type = price_result.pricing_type
        widget_reservation.pricing_rule_id = price_result.rule_id
        await session.flush()

        logger.info(
            "Widget conversion pricing (final): %s %s for %.1fh, %s items, type=%s, storage=%s",
            amount_minor,
            price_result.currency,
            price_result.duration_hours,
            baggage_count,
            price_result.pricing_type,
            storage.id,
        )
    except Exception as pricing_exc:
        # Fallback to widget amount (if present), then hardcoded default.
        widget_amount_minor = getattr(widget_reservation, "amount_minor", None)
        if widget_amount_minor is not None and widget_amount_minor > 0:
            amount_minor = widget_amount_minor
            logger.warning(
                "Pricing calculation failed, falling back to widget amount: %s (reservation=%s, error=%s)",
                amount_minor,
                widget_reservation_id,
                pricing_exc,
            )
        else:
            duration_hours_fallback = max(int((end_at - start_at).total_seconds() // 3600) or 1, 1)
            amount_minor = duration_hours_fallback * 1500 * baggage_count  # 15 TL per hour per item in kuruş
            logger.warning(
                "Pricing calculation failed, using default fallback amount: %s (reservation=%s, error=%s)",
                amount_minor,
                widget_reservation_id,
                pricing_exc,
            )

    # Calculate duration and pricing presentation fields
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
        
        logger.info(
            f"Created reservation {reservation.id} from widget reservation {widget_reservation_id}"
        )
    except Exception as create_exc:
        # Rollback storage status change
        storage.status = StorageStatus.IDLE.value
        await session.flush()
        raise ValueError(f"Failed to create reservation: {str(create_exc)}") from create_exc
    
    # Update widget reservation status
    widget_reservation.status = "converted"
    await session.flush()
    
    # ============================================================
    # PAYMENT CREATION - SINGLE SOURCE OF TRUTH
    # get_or_create_payment kullanarak SADECE 1 payment oluştur
    # ============================================================
    try:
        from .payment_service import get_or_create_payment
        from .magicpay.client import DEMO_MODES
        import json as json_module
        
        # Determine payment mode from tenant config or default to GATEWAY_DEMO
        # tenant already fetched above, reuse it
        if tenant is None:
            tenant = await session.get(Tenant, tenant_id)
        
        # Safely access tenant metadata with multiple fallbacks
        tenant_metadata = _get_tenant_metadata_safe(tenant)
        payment_mode = tenant_metadata.get("payment_mode", "GATEWAY_DEMO")
        
        logger.info(
            f"Creating payment for reservation {reservation.id} with mode={payment_mode}"
        )
        
        # get_or_create_payment handles duplicate protection internally
        # If payment already exists (shouldn't happen for new reservation), it will be returned
        # If not, a new payment will be created
        payment, was_created = await get_or_create_payment(
            session,
            reservation_id=reservation.id,
            tenant_id=tenant_id,
            amount_minor=amount_minor,
            currency="TRY",
            mode=payment_mode,
            storage_id=storage.id,
            metadata={
                "widget_reservation_id": widget_reservation_id,
                "created_via": "widget_conversion",
            },
            reservation=reservation,
        )
        await session.flush()
        
        if was_created:
            logger.info(
                f"Created new payment {payment.id} for reservation {reservation.id}"
            )
        else:
            logger.info(
                f"Using existing payment {payment.id} for reservation {reservation.id} "
                f"(was already created, skipping duplicate)"
            )
        
        # Create checkout session for demo mode
        is_demo_mode = payment_mode in DEMO_MODES or payment_mode.upper() == "GATEWAY_DEMO"
        if is_demo_mode and not payment.provider_intent_id:
            try:
                from .magicpay.client import get_magicpay_client
                from .magicpay.service import MagicPayService
                
                magicpay_client = get_magicpay_client(payment_mode=payment_mode)
                magicpay_service = MagicPayService(magicpay_client)
                
                checkout_data = await magicpay_service.create_checkout_session(
                    session=session,
                    reservation=reservation,
                    payment_mode=payment_mode,
                )
                
                payment.provider_intent_id = checkout_data.get("session_id")
                payment.meta = {
                    **(payment.meta or {}),
                    "checkout_url": checkout_data.get("checkout_url"),
                    "expires_at": checkout_data.get("expires_at"),
                    "session_id": checkout_data.get("session_id"),
                }
                await session.flush()
                
                logger.info(
                    f"Created checkout session for payment {payment.id}: "
                    f"checkout_url={checkout_data.get('checkout_url')}"
                )
            except Exception as checkout_exc:
                logger.error(
                    f"Failed to create checkout session for payment {payment.id}: {checkout_exc}",
                    exc_info=True
                )
                # Payment still created, checkout session can be created later
        
    except Exception as exc:
        logger.error(
            f"Failed to create payment for converted reservation {reservation.id}: {exc}",
            exc_info=True
        )
        # Don't fail conversion if payment creation fails
        # Payment can be created manually later
    
    return reservation


def _get_tenant_metadata_safe(tenant: Optional[Tenant]) -> dict:
    """Safely get tenant metadata as dict."""
    if tenant is None:
        return {}
    
    # Try different attribute names (metadata_ is the SQLAlchemy column name, metadata might be aliased)
    tenant_metadata = getattr(tenant, "metadata_", None) or getattr(tenant, "metadata", None)
    
    if tenant_metadata is None:
        return {}
    
    if isinstance(tenant_metadata, str):
        import json
        try:
            return json.loads(tenant_metadata)
        except Exception:
            return {}
    
    if isinstance(tenant_metadata, dict):
        return tenant_metadata
    
    return {}
