"""Tests for staff management functionality."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Location, Staff, Storage, Tenant, User
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_create_staff_assignment(session: AsyncSession):
    """Test creating a staff assignment."""
    # Create tenant
    tenant = Tenant(
        id="test-tenant-123",
        slug="test-tenant",
        name="Test Tenant",
        plan="standard",
    )
    session.add(tenant)
    
    # Create user
    user = User(
        id="test-user-123",
        email="staff@example.com",
        password_hash=get_password_hash("password"),
        role="storage_operator",
        tenant_id=tenant.id,
    )
    session.add(user)
    
    # Create location
    location = Location(
        id="test-location-123",
        tenant_id=tenant.id,
        name="Test Location",
    )
    session.add(location)
    
    # Create storage
    storage = Storage(
        id="test-storage-123",
        tenant_id=tenant.id,
        location_id=location.id,
        code="STORAGE-001",
        status="idle",
    )
    session.add(storage)
    await session.commit()
    
    # Create staff assignment
    staff = Staff(
        id="test-staff-123",
        tenant_id=tenant.id,
        user_id=user.id,
        assigned_location_ids="test-location-123",
    )
    staff.assigned_storages.append(storage)
    session.add(staff)
    await session.commit()
    
    assert staff.tenant_id == tenant.id
    assert staff.user_id == user.id
    assert len(staff.assigned_storages) == 1
    assert staff.assigned_storages[0].id == storage.id
    assert staff.assigned_location_ids == "test-location-123"


@pytest.mark.asyncio
async def test_staff_storage_assignment(session: AsyncSession):
    """Test staff-storage many-to-many relationship."""
    tenant = Tenant(
        id="test-tenant-456",
        slug="test-tenant-2",
        name="Test Tenant 2",
        plan="standard",
    )
    session.add(tenant)
    
    user = User(
        id="test-user-456",
        email="staff2@example.com",
        password_hash=get_password_hash("password"),
        role="storage_operator",
        tenant_id=tenant.id,
    )
    session.add(user)
    
    location = Location(
        id="test-location-456",
        tenant_id=tenant.id,
        name="Test Location 2",
    )
    session.add(location)
    
    storage1 = Storage(
        id="test-storage-456",
        tenant_id=tenant.id,
        location_id=location.id,
        code="STORAGE-002",
        status="idle",
    )
    storage2 = Storage(
        id="test-storage-789",
        tenant_id=tenant.id,
        location_id=location.id,
        code="STORAGE-003",
        status="idle",
    )
    session.add(storage1)
    session.add(storage2)
    
    staff = Staff(
        id="test-staff-456",
        tenant_id=tenant.id,
        user_id=user.id,
    )
    staff.assigned_storages.extend([storage1, storage2])
    session.add(staff)
    await session.commit()
    
    assert len(staff.assigned_storages) == 2
    assert storage1 in staff.assigned_storages
    assert storage2 in staff.assigned_storages

