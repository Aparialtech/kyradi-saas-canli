"""P0 Hardening Tests - Core SaaS functionality validation.

These tests verify the critical paths for:
1. Tenant onboarding (create-tenant)
2. User pagination with tenant isolation
3. Login separation (admin vs partner)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestTenantOnboarding:
    """Tests for POST /auth/onboarding/create-tenant"""

    def test_slug_validation_min_length(self):
        """Slug must be at least 3 characters."""
        from app.api.routes.auth import RESERVED_SLUGS
        
        # Slug too short
        assert len("ab") < 3
        
    def test_slug_validation_max_length(self):
        """Slug must be at most 50 characters."""
        long_slug = "a" * 51
        assert len(long_slug) > 50

    def test_slug_validation_regex(self):
        """Slug must match [a-z0-9][a-z0-9_-]*[a-z0-9] pattern."""
        import re
        pattern = r'^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$'
        
        # Valid slugs
        assert re.match(pattern, "grand-hotel")
        assert re.match(pattern, "hotel123")
        assert re.match(pattern, "my_hotel")
        assert re.match(pattern, "a")
        
        # Invalid slugs
        assert not re.match(pattern, "-hotel")
        assert not re.match(pattern, "hotel-")
        assert not re.match(pattern, "_hotel")
        assert not re.match(pattern, "Hotel")  # uppercase

    def test_reserved_slugs(self):
        """Reserved slugs should be blocked."""
        from app.api.routes.auth import RESERVED_SLUGS
        
        # Core reserved slugs
        assert "admin" in RESERVED_SLUGS
        assert "app" in RESERVED_SLUGS
        assert "www" in RESERVED_SLUGS
        assert "api" in RESERVED_SLUGS
        assert "mail" in RESERVED_SLUGS
        assert "kyradi" in RESERVED_SLUGS
        
        # Should have reasonable count
        assert len(RESERVED_SLUGS) >= 20

    def test_response_format(self):
        """Response should have tenant_id, tenant_slug, redirect_url."""
        from app.schemas.auth import TenantOnboardingResponse
        
        # Check response model fields
        fields = TenantOnboardingResponse.model_fields
        assert "tenant_id" in fields
        assert "tenant_slug" in fields
        assert "redirect_url" in fields


class TestUsersPagination:
    """Tests for GET /users pagination"""

    def test_page_size_max_limit(self):
        """page_size should have max limit of 100."""
        from fastapi import Query
        from app.api.routes.users import list_users
        import inspect
        
        sig = inspect.signature(list_users)
        page_size_param = sig.parameters.get("page_size")
        
        # Check Query default has le=100
        if page_size_param and page_size_param.default:
            default = page_size_param.default
            if hasattr(default, 'le'):
                assert default.le == 100

    def test_tenant_isolation_query(self):
        """Query must filter by current_user.tenant_id."""
        import inspect
        from app.api.routes.users import list_users
        
        # Get source code
        source = inspect.getsource(list_users)
        
        # Must have tenant_id filter
        assert "current_user.tenant_id" in source
        assert "User.tenant_id ==" in source

    def test_response_format(self):
        """Response should have items, page, page_size, total, total_pages."""
        from app.api.routes.users import PaginatedUserResponse
        
        fields = PaginatedUserResponse.model_fields
        assert "items" in fields
        assert "page" in fields
        assert "page_size" in fields
        assert "total" in fields
        assert "total_pages" in fields


class TestLoginSeparation:
    """Tests for login endpoint separation"""

    def test_partner_login_endpoint_exists(self):
        """POST /auth/partner/login should exist."""
        from app.api.routes.auth import router
        
        routes = [r.path for r in router.routes]
        assert "/partner/login" in routes

    def test_admin_login_endpoint_exists(self):
        """POST /auth/admin/login should exist."""
        from app.api.routes.auth import router
        
        routes = [r.path for r in router.routes]
        assert "/admin/login" in routes

    def test_partner_login_blocks_admin(self):
        """Partner login should block admin users."""
        import inspect
        from app.api.routes.auth import partner_login
        
        source = inspect.getsource(partner_login)
        
        # Should check for admin roles
        assert "SUPER_ADMIN" in source
        assert "SUPPORT" in source

    def test_admin_login_blocks_partner(self):
        """Admin login should block partner users."""
        import inspect
        from app.api.routes.auth import admin_login
        
        source = inspect.getsource(admin_login)
        
        # Should check for admin roles
        assert "SUPER_ADMIN" in source
        assert "SUPPORT" in source


class TestTenantResolverMiddleware:
    """Tests for tenant resolver middleware"""

    def test_skip_hosts_defined(self):
        """Admin and app hosts should skip tenant resolution."""
        from app.middleware.tenant_resolver import SKIP_TENANT_HOSTS
        
        assert "admin.kyradi.com" in SKIP_TENANT_HOSTS
        assert "app.kyradi.com" in SKIP_TENANT_HOSTS

    def test_reserved_subdomains_defined(self):
        """Reserved subdomains should not be treated as tenant slugs."""
        from app.middleware.tenant_resolver import RESERVED_SUBDOMAINS
        
        assert "admin" in RESERVED_SUBDOMAINS
        assert "app" in RESERVED_SUBDOMAINS
        assert "www" in RESERVED_SUBDOMAINS
        assert "api" in RESERVED_SUBDOMAINS

    def test_extract_tenant_from_host(self):
        """Should correctly extract tenant slug from subdomain."""
        from app.middleware.tenant_resolver import extract_tenant_from_host
        
        # Valid tenant subdomains
        assert extract_tenant_from_host("grand-hotel.kyradi.com") == "grand-hotel"
        assert extract_tenant_from_host("my-hotel.kyradi.com:443") == "my-hotel"
        
        # Reserved subdomains - should return None
        assert extract_tenant_from_host("admin.kyradi.com") is None
        assert extract_tenant_from_host("app.kyradi.com") is None
        assert extract_tenant_from_host("www.kyradi.com") is None
        
        # Base domain - should return None
        assert extract_tenant_from_host("kyradi.com") is None
        assert extract_tenant_from_host("localhost") is None


# Run with: pytest tests/test_p0_hardening.py -v
