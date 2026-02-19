"""Admin endpoints for tenant domain management."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_admin_user
from ...models import Tenant, TenantDomain, TenantDomainStatus, TenantDomainType
from ...schemas import (
    TenantDomainCreate,
    TenantDomainRead,
    TenantDomainUpdate,
    TenantDomainVerificationCheck,
    TenantDomainVerificationStart,
)
from ...services.tenant_domain_verification import (
    build_txt_record,
    generate_verification_token,
    lookup_txt_record,
    now_utc,
)
from ...utils.domain_validation import (
    normalize_and_validate_custom_domain,
    normalize_and_validate_slug,
    validate_domain_input,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/tenants/{tenant_id}/domains", tags=["admin-tenant-domains"])

INTERNAL_SUFFIXES = ("kyradi.app", "kyradi.com")


async def _get_tenant(session: AsyncSession, tenant_id: str) -> Tenant:
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


def _normalize_domain(domain_type: str, domain: str) -> str:
    normalized = validate_domain_input(domain)
    if domain_type == TenantDomainType.CUSTOM_DOMAIN.value:
        return normalize_and_validate_custom_domain(normalized)

    if domain_type == TenantDomainType.SUBDOMAIN.value:
        if not any(normalized.endswith(f".{suffix}") for suffix in INTERNAL_SUFFIXES):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Subdomain must end with kyradi.app or kyradi.com",
            )
        for suffix in INTERNAL_SUFFIXES:
            if normalized.endswith(f".{suffix}"):
                slug = normalized.replace(f".{suffix}", "")
                normalize_and_validate_slug(slug)
                return normalized

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid domain type")


@router.get("", response_model=List[TenantDomainRead])
async def list_tenant_domains(
    tenant_id: str,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> List[TenantDomainRead]:
    await _get_tenant(session, tenant_id)
    result = await session.execute(
        select(TenantDomain).where(TenantDomain.tenant_id == tenant_id).order_by(TenantDomain.created_at.desc())
    )
    return [TenantDomainRead.model_validate(row) for row in result.scalars().all()]


@router.post("", response_model=TenantDomainRead, status_code=status.HTTP_201_CREATED)
async def create_tenant_domain(
    tenant_id: str,
    payload: TenantDomainCreate,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> TenantDomainRead:
    await _get_tenant(session, tenant_id)
    normalized = _normalize_domain(payload.domain_type, payload.domain)

    if payload.is_primary:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primary domain must be verified first.")

    domain = TenantDomain(
        tenant_id=tenant_id,
        domain=normalized,
        domain_type=payload.domain_type,
        status=TenantDomainStatus.PENDING.value,
        verification_method="DNS_TXT",
        is_primary=payload.is_primary,
    )
    session.add(domain)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu domain kullanımda, başka bir domain girin.")
    await session.refresh(domain)
    return TenantDomainRead.model_validate(domain)


@router.patch("/{domain_id}", response_model=TenantDomainRead)
async def update_tenant_domain(
    tenant_id: str,
    domain_id: str,
    payload: TenantDomainUpdate,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> TenantDomainRead:
    await _get_tenant(session, tenant_id)
    result = await session.execute(
        select(TenantDomain).where(TenantDomain.id == domain_id, TenantDomain.tenant_id == tenant_id)
    )
    domain = result.scalar_one_or_none()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    if payload.domain:
        normalized = _normalize_domain(domain.domain_type, payload.domain)
        domain.domain = normalized
        domain.status = TenantDomainStatus.PENDING.value
        domain.verification_token = None
        domain.verification_record_name = None
        domain.verification_record_value = None
        domain.failure_reason = None
        domain.last_checked_at = None
        if domain.is_primary:
            domain.is_primary = False

    if payload.status:
        if payload.status not in {TenantDomainStatus.DISABLED.value, TenantDomainStatus.PENDING.value}:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status update")
        domain.status = payload.status
        if payload.status == TenantDomainStatus.DISABLED.value:
            domain.is_primary = False

    if payload.is_primary is not None:
        if payload.is_primary and domain.status != TenantDomainStatus.VERIFIED.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primary domain must be verified first.")
        domain.is_primary = payload.is_primary

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu domain kullanımda, başka bir domain girin.")

    if payload.is_primary:
        await session.execute(
            update(TenantDomain)
            .where(TenantDomain.tenant_id == tenant_id, TenantDomain.id != domain.id, TenantDomain.is_primary.is_(True))
            .values(is_primary=False)
        )
        await session.commit()
        await session.refresh(domain)
    return TenantDomainRead.model_validate(domain)


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_domain(
    tenant_id: str,
    domain_id: str,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> None:
    await _get_tenant(session, tenant_id)
    result = await session.execute(
        select(TenantDomain).where(TenantDomain.id == domain_id, TenantDomain.tenant_id == tenant_id)
    )
    domain = result.scalar_one_or_none()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    await session.delete(domain)
    await session.commit()


@router.post("/{domain_id}/verify/start", response_model=TenantDomainVerificationStart)
async def start_domain_verification(
    tenant_id: str,
    domain_id: str,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> TenantDomainVerificationStart:
    await _get_tenant(session, tenant_id)
    result = await session.execute(
        select(TenantDomain).where(TenantDomain.id == domain_id, TenantDomain.tenant_id == tenant_id)
    )
    domain = result.scalar_one_or_none()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    if domain.status == TenantDomainStatus.DISABLED.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domain is disabled")

    token = generate_verification_token()
    record_name, record_value = build_txt_record(domain.domain, token)
    domain.verification_token = token
    domain.verification_record_name = record_name
    domain.verification_record_value = record_value
    domain.status = TenantDomainStatus.VERIFYING.value
    domain.failure_reason = None
    domain.last_checked_at = None
    await session.commit()
    await session.refresh(domain)
    return TenantDomainVerificationStart(
        status=domain.status,
        verification_token=domain.verification_token or "",
        verification_record_name=domain.verification_record_name or "",
        verification_record_value=domain.verification_record_value or "",
    )


@router.post("/{domain_id}/verify/check", response_model=TenantDomainVerificationCheck)
async def check_domain_verification(
    tenant_id: str,
    domain_id: str,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> TenantDomainVerificationCheck:
    await _get_tenant(session, tenant_id)
    result = await session.execute(
        select(TenantDomain).where(TenantDomain.id == domain_id, TenantDomain.tenant_id == tenant_id)
    )
    domain = result.scalar_one_or_none()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    if not domain.verification_token or not domain.verification_record_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification not started")

    if domain.status == TenantDomainStatus.DISABLED.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domain is disabled")

    found = lookup_txt_record(domain.verification_record_name, domain.verification_token)
    domain.last_checked_at = now_utc()
    if found:
        domain.status = TenantDomainStatus.VERIFIED.value
        domain.failure_reason = None
        if domain.is_primary:
            await session.execute(
                update(TenantDomain)
                .where(
                    TenantDomain.tenant_id == tenant_id,
                    TenantDomain.id != domain.id,
                    TenantDomain.is_primary.is_(True),
                )
                .values(is_primary=False)
            )
    else:
        domain.status = TenantDomainStatus.VERIFYING.value
        domain.failure_reason = "TXT kaydı bulunamadı veya eşleşmedi."

    await session.commit()
    await session.refresh(domain)
    return TenantDomainVerificationCheck(
        status=domain.status,
        verified=domain.status == TenantDomainStatus.VERIFIED.value,
        failure_reason=domain.failure_reason,
        last_checked_at=domain.last_checked_at,
    )
