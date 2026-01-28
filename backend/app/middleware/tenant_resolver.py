"""Tenant resolver middleware for subdomain and custom domain support."""

import logging
from typing import Optional

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import AsyncSessionMaker
from ..models import Tenant, TenantDomain, TenantDomainStatus, DomainStatus



logger = logging.getLogger(__name__)


def get_effective_host(request: Request) -> str:
    """Get the effective host for proxied requests."""
    for header in ("x-forwarded-host", "x-vercel-forwarded-host", "host"):
        value = request.headers.get(header)
        if value:
            return value
    return ""


# Base domains for Kyradi (subdomains will be *.kyradi.com or *.kyradi.app)
BASE_DOMAINS = {"kyradi.com", "kyradi.app", "localhost", "127.0.0.1"}

# Special hosts that skip tenant resolution entirely
# Admin host: admin.kyradi.com - Admin panel, no tenant context needed
# App host: app.kyradi.com - Signup, onboarding, no tenant context needed
SKIP_TENANT_HOSTS = {"admin.kyradi.com", "app.kyradi.com", "admin.kyradi.app", "app.kyradi.app"}

# Subdomains that are NOT tenant subdomains
RESERVED_SUBDOMAINS = {"admin", "app", "www", "api", "mail", "cdn", "status"}

# Paths that don't require tenant resolution
PUBLIC_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/auth/login",
    "/auth/admin/login",
    "/auth/partner/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/verify-reset-code",
    "/auth/reset-password",
    "/auth/onboarding/create-tenant",
    "/auth/me",
    "/admin",
    "/public",
}


def is_public_path(path: str) -> bool:
    """Check if path is public (doesn't require tenant)."""
    if not path:
        return True
    
    if path.startswith("/auth/") or path.startswith("/admin/"):
        return True

    # Exact match or prefix match
    for public_path in PUBLIC_PATHS:
        if path == public_path or path.startswith(f"{public_path}/"):
            return True
    
    return False


def normalize_host(host: str) -> str:
    if not host:
        return ""
    return host.split(":")[0].strip().lower()


def should_skip_tenant_resolution(host: str) -> bool:
    """
    Check if this host should skip tenant resolution entirely.
    Admin and App hosts don't need tenant context.
    """
    if not host:
        return True
    
    host_without_port = normalize_host(host)
    
    # Skip for known hosts
    if host_without_port in SKIP_TENANT_HOSTS:
        return True
    
    # Skip for development
    if host_without_port in {"localhost", "127.0.0.1"}:
        return True
    
    # Skip for base domains without subdomain
    if host_without_port in BASE_DOMAINS:
        return True
    
    return False


def extract_tenant_from_host(host: str) -> Optional[str]:
    """
    Extract tenant slug from host header.
    
    Examples:
    - demo-hotel.kyradi.com -> demo-hotel
    - rezervasyon.otelim.com -> None (custom domain, lookup separately)
    - kyradi.com -> None (main domain)
    - localhost:5173 -> None (development)
    - admin.kyradi.com -> None (reserved subdomain)
    - app.kyradi.com -> None (reserved subdomain)
    """
    if not host:
        return None
    
    host_without_port = normalize_host(host)
    
    # Check if it's a subdomain of our base domains
    for base_domain in BASE_DOMAINS:
        if host_without_port.endswith(f".{base_domain}"):
            # Extract subdomain
            subdomain = host_without_port.replace(f".{base_domain}", "")
            # Ignore reserved subdomains
            if subdomain and subdomain not in RESERVED_SUBDOMAINS:
                return subdomain
    
    # Check if it's exactly a base domain
    if host_without_port in BASE_DOMAINS:
        return None
    
    # Otherwise, it might be a custom domain - return None to trigger custom domain lookup
    return None


async def resolve_tenant_by_slug(slug: str) -> Optional[Tenant]:
    """Resolve tenant by slug (subdomain)."""
    async with AsyncSessionMaker() as session:
        stmt = select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def resolve_tenant_by_custom_domain(domain: str) -> Optional[Tenant]:
    """Resolve tenant by custom domain."""
    async with AsyncSessionMaker() as session:
        stmt = select(Tenant).where(
            Tenant.custom_domain == domain.lower(),
            Tenant.domain_status == DomainStatus.VERIFIED.value,
            Tenant.is_active == True,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def resolve_tenant_by_domain_record(domain: str) -> Optional[Tenant]:
    """Resolve tenant by verified tenant_domains record."""
    async with AsyncSessionMaker() as session:
        stmt = (
            select(Tenant)
            .join(TenantDomain, TenantDomain.tenant_id == Tenant.id)
            .where(
                TenantDomain.domain == domain.lower(),
                TenantDomain.status == TenantDomainStatus.VERIFIED.value,
                Tenant.is_active == True,
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


class TenantResolverMiddleware(BaseHTTPMiddleware):
    """
    Middleware to resolve tenant from request host.
    
    Resolution order:
    1. Check if host should skip tenant resolution (admin.kyradi.com, app.kyradi.com, localhost)
    2. Check if path is public (skip resolution)
    3. Check X-Tenant-ID header (for API clients)
    4. Extract subdomain from host (e.g., demo-hotel.kyradi.com)
    5. Check custom domain (e.g., rezervasyon.otelim.com)
    6. If no tenant found and required, return 404
    """
    
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        host = get_effective_host(request)
        host_without_port = normalize_host(host)
        
        # Skip tenant resolution for admin/app hosts and development
        if should_skip_tenant_resolution(host):
            request.state.tenant = None
            request.state.tenant_id = None
            logger.debug(f"Skipping tenant resolution for host: {host}")
            return await call_next(request)
        
        # Skip tenant resolution for auth/admin paths
        if request.url.path.startswith("/auth") or request.url.path.startswith("/admin"):
            request.state.tenant = None
            request.state.tenant_id = None
            return await call_next(request)

        # Skip tenant resolution for public paths
        if is_public_path(request.url.path):
            request.state.tenant = None
            request.state.tenant_id = None
            return await call_next(request)
        
        tenant: Optional[Tenant] = None
        is_auth_path = request.url.path.startswith("/auth/")
        
        # 1. Check X-Tenant-ID header first (API clients)
        tenant_id_header = request.headers.get("x-tenant-id")
        if tenant_id_header:
            async with AsyncSessionMaker() as session:
                stmt = select(Tenant).where(Tenant.id == tenant_id_header, Tenant.is_active == True)
                result = await session.execute(stmt)
                tenant = result.scalar_one_or_none()
        
        # 2. Try subdomain resolution
        if not tenant:
            slug = extract_tenant_from_host(host)
            if slug:
                tenant = await resolve_tenant_by_slug(slug)
                if not tenant and not is_auth_path:
                    logger.warning(f"Tenant not found for subdomain: {slug}")
                    return JSONResponse(
                        status_code=404,
                        content={
                            "detail": "Tenant bulunamadı",
                            "message": f"'{slug}' subdomain'i için kayıtlı otel bulunamadı.",
                            "code": "TENANT_NOT_FOUND"
                        }
                    )

        # 3. Try verified tenant_domains record
        if not tenant and host_without_port:
            tenant = await resolve_tenant_by_domain_record(host_without_port)

        # 4. Legacy custom domain resolution
        if not tenant and host_without_port:
            if host_without_port not in BASE_DOMAINS and not any(
                host_without_port.endswith(f".{bd}") for bd in BASE_DOMAINS
            ):
                tenant = await resolve_tenant_by_custom_domain(host_without_port)
                if not tenant and not is_auth_path:
                    logger.warning(f"Tenant not found for custom domain: {host_without_port}")
                    return JSONResponse(
                        status_code=404,
                        content={
                            "detail": "Tenant bulunamadı",
                            "message": f"'{host_without_port}' domain'i için kayıtlı otel bulunamadı.",
                            "code": "TENANT_NOT_FOUND"
                        }
                    )
        
        # Store tenant info in request state
        request.state.tenant = tenant
        request.state.tenant_id = tenant.id if tenant else None
        
        if tenant:
            logger.debug(f"Resolved tenant: {tenant.slug} (ID: {tenant.id}) from host: {host}")
        
        return await call_next(request)
