"""Tests for signup, login, and onboarding endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Test data
TEST_USER_EMAIL = "test_onboarding@example.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_TENANT_SLUG = "test-hotel-onboarding"
TEST_TENANT_NAME = "Test Hotel Onboarding"


class TestSignup:
    """Test signup endpoint."""

    async def test_signup_success(self, client: AsyncClient):
        """Given: Valid signup data
        When: POST /auth/signup
        Then: User created and token returned"""
        response = await client.post("/auth/signup", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "full_name": "Test User",
        })
        
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] is not None
        assert data["access_token"] is not None
        assert "Kayıt başarılı" in data["message"]

    async def test_signup_email_already_exists(self, client: AsyncClient):
        """Given: Email already registered
        When: POST /auth/signup with same email
        Then: 409 Conflict returned"""
        # First signup
        await client.post("/auth/signup", json={
            "email": "duplicate@example.com",
            "password": TEST_USER_PASSWORD,
        })
        
        # Second signup with same email
        response = await client.post("/auth/signup", json={
            "email": "duplicate@example.com",
            "password": TEST_USER_PASSWORD,
        })
        
        assert response.status_code == 409
        assert "zaten kayıtlı" in response.json()["detail"]


class TestLogin:
    """Test login endpoint."""

    async def test_login_email_not_found(self, client: AsyncClient):
        """Given: Email not registered
        When: POST /auth/login
        Then: 404 Not Found returned"""
        response = await client.post("/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword",
        })
        
        assert response.status_code == 404
        assert "bulunamadı" in response.json()["detail"]

    async def test_login_wrong_password(self, client: AsyncClient):
        """Given: Valid email but wrong password
        When: POST /auth/login
        Then: 401 Unauthorized returned"""
        # First create user
        await client.post("/auth/signup", json={
            "email": "wrongpass@example.com",
            "password": TEST_USER_PASSWORD,
        })
        
        # Try login with wrong password
        response = await client.post("/auth/login", json={
            "email": "wrongpass@example.com",
            "password": "WrongPassword123!",
        })
        
        assert response.status_code == 401
        assert "Geçersiz şifre" in response.json()["detail"]


class TestTenantOnboarding:
    """Test tenant creation via onboarding."""

    async def test_tenant_slug_unique(self, client: AsyncClient):
        """Given: Slug already in use
        When: POST /auth/onboarding/create-tenant
        Then: 409 Conflict returned"""
        # Create first user and tenant
        signup_resp = await client.post("/auth/signup", json={
            "email": "tenant1@example.com",
            "password": TEST_USER_PASSWORD,
        })
        token1 = signup_resp.json()["access_token"]
        
        await client.post(
            "/auth/onboarding/create-tenant",
            json={"name": "Hotel One", "slug": "unique-slug"},
            headers={"Authorization": f"Bearer {token1}"}
        )
        
        # Create second user
        signup_resp2 = await client.post("/auth/signup", json={
            "email": "tenant2@example.com",
            "password": TEST_USER_PASSWORD,
        })
        token2 = signup_resp2.json()["access_token"]
        
        # Try same slug
        response = await client.post(
            "/auth/onboarding/create-tenant",
            json={"name": "Hotel Two", "slug": "unique-slug"},
            headers={"Authorization": f"Bearer {token2}"}
        )
        
        assert response.status_code == 409
        assert "kullanımda" in response.json()["detail"]

    async def test_custom_domain_unique(self, client: AsyncClient):
        """Given: Custom domain already in use
        When: POST /auth/onboarding/create-tenant with same domain
        Then: 409 Conflict with helpful message"""
        # Create first user and tenant with custom domain
        signup_resp = await client.post("/auth/signup", json={
            "email": "domain1@example.com",
            "password": TEST_USER_PASSWORD,
        })
        token1 = signup_resp.json()["access_token"]
        
        await client.post(
            "/auth/onboarding/create-tenant",
            json={
                "name": "Hotel Domain One",
                "slug": "hotel-domain-one",
                "custom_domain": "rezervasyon.otelim.com"
            },
            headers={"Authorization": f"Bearer {token1}"}
        )
        
        # Create second user
        signup_resp2 = await client.post("/auth/signup", json={
            "email": "domain2@example.com",
            "password": TEST_USER_PASSWORD,
        })
        token2 = signup_resp2.json()["access_token"]
        
        # Try same custom domain
        response = await client.post(
            "/auth/onboarding/create-tenant",
            json={
                "name": "Hotel Domain Two",
                "slug": "hotel-domain-two",
                "custom_domain": "rezervasyon.otelim.com"
            },
            headers={"Authorization": f"Bearer {token2}"}
        )
        
        assert response.status_code == 409
        assert "domain kullanımda" in response.json()["detail"].lower()


class TestTenantResolver:
    """Test tenant resolution from host."""

    async def test_subdomain_resolves_tenant(self, client: AsyncClient):
        """Given: Valid subdomain
        When: Request with Host header
        Then: Tenant resolved correctly"""
        # This test would need tenant resolver middleware enabled
        # Placeholder for when middleware is active
        pass

    async def test_unknown_subdomain_returns_404(self, client: AsyncClient):
        """Given: Unknown subdomain
        When: Request with Host header
        Then: 404 with tenant not found message"""
        # This test would need tenant resolver middleware enabled
        # Placeholder for when middleware is active
        pass


class TestUsersPagination:
    """Test users list pagination."""

    async def test_users_list_returns_pagination(self, client: AsyncClient):
        """Given: Authenticated tenant admin
        When: GET /users with pagination params
        Then: Paginated response returned"""
        # This test needs a tenant admin user
        # Placeholder - implement with proper fixtures
        pass
