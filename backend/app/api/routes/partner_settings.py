"""Partner settings endpoints."""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_admin
from ...models import Tenant, User
from ...models.enums import DomainStatus
from ...services.audit import record_audit
from ...services.domain_verification import verify_custom_domain
from common.rate_limit import RateLimitError, RateLimiter
from ...utils.domain_validation import DomainValidationError, normalize_and_validate_custom_domain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/partners/settings", tags=["partner-settings"])
verify_rate_limiter = RateLimiter(10)


class PartnerSettingsResponse(BaseModel):
    """Partner settings response."""

    tenant_id: str
    tenant_name: str
    tenant_slug: str
    custom_domain: Optional[str] = None
    domain_status: str = DomainStatus.UNVERIFIED.value
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    notification_email: Optional[str] = None
    notification_sms: bool = False
    widget_enabled: bool = False
    widget_public_key: Optional[str] = None
    payment_mode: str = "GATEWAY_DEMO"
    commission_rate: float = 5.0


class PartnerSettingsUpdatePayload(BaseModel):
    """Partner settings update payload."""

    tenant_name: Optional[str] = None
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    notification_email: Optional[str] = None
    notification_sms: Optional[bool] = None
    custom_domain: Optional[str] = None


def _tenant_to_settings_response(tenant: Tenant) -> PartnerSettingsResponse:
    """Convert Tenant model to PartnerSettingsResponse."""
    metadata = tenant.metadata_ or {}

    # Try to get widget info from metadata or related widget config
    widget_enabled = metadata.get("widget_enabled", False)
    widget_public_key = metadata.get("widget_public_key")
    payment_mode = metadata.get("payment_mode", "GATEWAY_DEMO")
    commission_rate = metadata.get("commission_rate", 5.0)

    return PartnerSettingsResponse(
        tenant_id=str(tenant.id),
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
        custom_domain=tenant.custom_domain,
        domain_status=tenant.domain_status,
        legal_name=metadata.get("legal_name"),
        tax_id=metadata.get("tax_id"),
        tax_office=metadata.get("tax_office"),
        contact_email=metadata.get("contact_email"),
        contact_phone=metadata.get("contact_phone"),
        brand_color=tenant.brand_color,
        logo_url=tenant.logo_url,
        notification_email=metadata.get("notification_email"),
        notification_sms=metadata.get("notification_sms", False),
        widget_enabled=widget_enabled,
        widget_public_key=widget_public_key,
        payment_mode=payment_mode,
        commission_rate=commission_rate,
    )


@router.get("", response_model=PartnerSettingsResponse)
async def get_partner_settings(
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PartnerSettingsResponse:
    """Get current partner (tenant) settings."""
    tenant = await session.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Also try to get widget config if exists
    try:
        from app.reservations.models import WidgetConfig

        widget_config = await session.execute(
            select(WidgetConfig).where(WidgetConfig.tenant_id == str(tenant.id))
        )
        widget_config_row = widget_config.scalar_one_or_none()

        response = _tenant_to_settings_response(tenant)

        if widget_config_row:
            response.widget_enabled = True
            response.widget_public_key = widget_config_row.widget_public_key

        return response
    except Exception as e:
        logger.warning(f"Could not fetch widget config: {e}")
        return _tenant_to_settings_response(tenant)


@router.patch("", response_model=PartnerSettingsResponse)
async def update_partner_settings(
    payload: PartnerSettingsUpdatePayload,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PartnerSettingsResponse:
    """Update partner (tenant) settings."""
    tenant = await session.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Update tenant fields
    update_data = payload.model_dump(exclude_unset=True)
    changed_fields = {}

    # Direct tenant fields
    if "tenant_name" in update_data and update_data["tenant_name"]:
        tenant.name = update_data["tenant_name"]
        changed_fields["name"] = update_data["tenant_name"]

    if "brand_color" in update_data:
        tenant.brand_color = update_data["brand_color"] or None
        changed_fields["brand_color"] = update_data["brand_color"]

    if "logo_url" in update_data:
        tenant.logo_url = update_data["logo_url"] or None
        changed_fields["logo_url"] = update_data["logo_url"]

    # Metadata fields
    metadata = dict(tenant.metadata_ or {})
    metadata_changed = False

    if "legal_name" in update_data:
        metadata["legal_name"] = update_data["legal_name"] or None
        changed_fields["legal_name"] = update_data["legal_name"]
        metadata_changed = True

    if "tax_id" in update_data:
        metadata["tax_id"] = update_data["tax_id"] or None
        changed_fields["tax_id"] = update_data["tax_id"]
        metadata_changed = True

    if "tax_office" in update_data:
        metadata["tax_office"] = update_data["tax_office"] or None
        changed_fields["tax_office"] = update_data["tax_office"]
        metadata_changed = True

    if "contact_email" in update_data:
        metadata["contact_email"] = update_data["contact_email"] or None
        changed_fields["contact_email"] = update_data["contact_email"]
        metadata_changed = True

    if "contact_phone" in update_data:
        metadata["contact_phone"] = update_data["contact_phone"] or None
        changed_fields["contact_phone"] = update_data["contact_phone"]
        metadata_changed = True

    if "notification_email" in update_data:
        metadata["notification_email"] = update_data["notification_email"] or None
        changed_fields["notification_email"] = update_data["notification_email"]
        metadata_changed = True

    if "notification_sms" in update_data:
        metadata["notification_sms"] = update_data["notification_sms"]
        changed_fields["notification_sms"] = update_data["notification_sms"]
        metadata_changed = True

    if "custom_domain" in update_data:
        incoming_domain = update_data["custom_domain"]
        normalized_domain = None

        if incoming_domain:
            try:
                normalized_domain = normalize_and_validate_custom_domain(incoming_domain)
            except DomainValidationError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc

        if normalized_domain != tenant.custom_domain:
            tenant.custom_domain = normalized_domain
            tenant.domain_status = DomainStatus.UNVERIFIED.value
            if hasattr(tenant, "updated_at"):
                tenant.updated_at = datetime.utcnow()
            changed_fields["custom_domain"] = normalized_domain
            changed_fields["domain_status"] = tenant.domain_status

    if metadata_changed:
        tenant.metadata_ = metadata

    # Record audit log
    await record_audit(
        session,
        tenant_id=str(current_user.tenant_id),
        actor_user_id=str(current_user.id),
        action="tenant.settings.update",
        entity="tenants",
        entity_id=str(tenant.id),
        meta=changed_fields,
    )

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu domain kullanımda, başka bir domain girin.",
        ) from exc
    await session.refresh(tenant)

    logger.info(f"Partner settings updated for tenant {tenant.id}: {list(changed_fields.keys())}")

    # Return updated settings
    return await get_partner_settings(current_user, session)


@router.post("/verify-domain", response_model=PartnerSettingsResponse)
async def verify_partner_domain(
    request: Request,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PartnerSettingsResponse:
    tenant = await session.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    if not tenant.custom_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom domain tanımlı değil.",
        )

    client_host = request.client.host if request.client else "unknown"
    try:
        await verify_rate_limiter.check(f"tenant:{tenant.id}:ip:{client_host}")
    except RateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    tenant.domain_status = DomainStatus.PENDING.value
    if hasattr(tenant, "updated_at"):
        tenant.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(tenant)

    is_verified, error_message = await verify_custom_domain(tenant)

    tenant.domain_status = DomainStatus.VERIFIED.value if is_verified else DomainStatus.FAILED.value
    if hasattr(tenant, "updated_at"):
        tenant.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(tenant)

    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message or "Domain doğrulanamadı. DNS yayılımı tamamlanmamış olabilir. 10 dk sonra tekrar deneyin.",
        )

    return await get_partner_settings(current_user, session)
