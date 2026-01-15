"""Tenant resolver middleware for subdomain and custom domain support."""

import logging
from typing import Optional

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import AsyncSessionMaker
from ..models.tenant import Tenant

logger = logging.getLogger(__name__)

# Base domain for Kyradi (subdomains will be *.kyradi.com)
BASE_DOMAINS = {"kyradi.com", "localhost", "127.0.0.1"}

# Paths that don't require tenant resolution
PUBLIC_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/verify-reset-code",
    "/auth/reset-password",
    "/auth/onboarding/create-tenant",
    "/admin",
    "/public",
}


def is_public_path(path: str) -> bool:
    """Check if path is public (doesn't require tenant)."""
    if not path:
        return True
    
    # Exact match or prefix match
    for public_path in PUBLIC_PATHS:
        if path == public_path or path.startswith(f"{public_path}/"):
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
    """
    if not host:
        return None
    
    # Remove port if present
    host_without_port = host.split(":")[0].lower()
    
    # Check if it's a subdomain of our base domains
    for base_domain in BASE_DOMAINS:
        if host_without_port.endswith(f".{base_domain}"):
            # Extract subdomain
            subdomain = host_without_port.replace(f".{base_domain}", "")
            # Ignore www or app subdomains
            if subdomain and subdomain not in {"www", "app", "api"}:
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
        stmt = select(Tenant).where(Tenant.custom_domain == domain.lower(), Tenant.is_active == True)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


class TenantResolverMiddleware(BaseHTTPMiddleware):
    """
    Middleware to resolve tenant from request host.
    
    Resolution order:
    1. Check if path is public (skip resolution)
    2. Check X-Tenant-ID header (for API clients)
    3. Extract subdomain from host (e.g., demo-hotel.kyradi.com)
    4. Check custom domain (e.g., rezervasyon.otelim.com)
    5. If no tenant found and required, return 404
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip tenant resolution for public paths
        if is_public_path(request.url.path):
            request.state.tenant = None
            request.state.tenant_id = None
            return await call_next(request)
        
        tenant: Optional[Tenant] = None
        host = request.headers.get("host", "")
        
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
                if not tenant:
                    logger.warning(f"Tenant not found for subdomain: {slug}")
                    return JSONResponse(
                        status_code=404,
                        content={
                            "detail": "Tenant bulunamadı",
                            "message": f"'{slug}' subdomain'i için kayıtlı otel bulunamadı.",
                            "code": "TENANT_NOT_FOUND"
                        }
                    )
        
        # 3. Try custom domain resolution
        if not tenant and host:
            host_without_port = host.split(":")[0].lower()
            # Only check custom domain if it's not a base domain
            if host_without_port not in BASE_DOMAINS and not any(
                host_without_port.endswith(f".{bd}") for bd in BASE_DOMAINS
            ):
                tenant = await resolve_tenant_by_custom_domain(host_without_port)
                if not tenant:
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
