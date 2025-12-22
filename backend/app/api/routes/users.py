"""Tenant user management endpoints."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.security import get_password_hash
from ...db.session import get_session
from ...dependencies import require_tenant_admin
from ...models import User, UserRole
from ...schemas import UserCreate, UserRead, UserUpdate
from ...services.audit import record_audit
from ...services.limits import ensure_user_limit
from ...services.quota_checks import check_user_quota

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_TENANT_ROLES = {
    UserRole.TENANT_ADMIN,
    UserRole.HOTEL_MANAGER,
    UserRole.STAFF,
    UserRole.STORAGE_OPERATOR,
    UserRole.ACCOUNTING,
    UserRole.VIEWER,  # legacy/deprecated ama kabul edilsin
}


def _validate_role(role: UserRole) -> None:
    if role not in ALLOWED_TENANT_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role for tenant user")


@router.get("", response_model=List[UserRead])
async def list_users(
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[UserRead]:
    """List users for the current tenant."""
    stmt = (
        select(User)
        .where(User.tenant_id == current_user.tenant_id)
        .order_by(User.created_at.desc())
    )
    result = await session.execute(stmt)
    users = result.scalars().all()
    return [UserRead.model_validate(user) for user in users]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Create a new user under the tenant."""
    _validate_role(payload.role)
    if payload.is_active:
        # Check quota from metadata (new system) first
        can_create, quota_limit, current_count = await check_user_quota(session, current_user.tenant_id)
        if not can_create and quota_limit is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Max kullanıcı kotasına ulaşıldı. Mevcut: {current_count}, Limit: {quota_limit}",
            )
        # Fallback to plan limits (backward compatibility)
        try:
            await ensure_user_limit(session, current_user.tenant_id)
        except ValueError as exc:
            if quota_limit is None:  # Only raise if quota_limit wasn't checked
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    existing = await session.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        tenant_id=current_user.tenant_id,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role.value,
        is_active=payload.is_active,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        birth_date=payload.birth_date,
        tc_identity_number=payload.tc_identity_number,
        city=payload.city,
        district=payload.district,
        address=payload.address,
        gender=payload.gender,
    )
    session.add(user)
    await session.flush()

    # Log password in development mode
    is_development = settings.environment.lower() in {"local", "dev", "development"}
    if is_development:
        logger.info(f"[USER CREATE] Email: {payload.email}")
        logger.info(f"[USER CREATE] Password: {payload.password}")
        logger.info(f"[USER CREATE] Role: {payload.role.value}")

    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="tenant.user.create",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email, "role": user.role},
    )

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Update tenant user attributes."""
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "role" in update_data and update_data["role"] is not None:
        _validate_role(update_data["role"])
        update_data["role"] = update_data["role"].value

    reactivating = bool(update_data.get("is_active")) and not user.is_active
    if reactivating:
        # Check quota from metadata (new system) first
        can_create, quota_limit, current_count = await check_user_quota(session, current_user.tenant_id)
        if not can_create and quota_limit is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Max kullanıcı kotasına ulaşıldı. Mevcut: {current_count}, Limit: {quota_limit}",
            )
        # Fallback to plan limits (backward compatibility)
        try:
            await ensure_user_limit(session, current_user.tenant_id)
        except ValueError as exc:
            if quota_limit is None:  # Only raise if quota_limit wasn't checked
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if "password" in update_data and update_data["password"]:
        new_password = update_data.pop("password")
        update_data["password_hash"] = get_password_hash(new_password)
        # Log password in development mode
        is_development = settings.environment.lower() in {"local", "dev", "development"}
        if is_development:
            logger.info(f"[USER PASSWORD UPDATE] Email: {user.email}")
            logger.info(f"[USER PASSWORD UPDATE] New Password: {new_password}")
    elif "password" in update_data:
        update_data.pop("password")

    for field, value in update_data.items():
        setattr(user, field, value)

    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="tenant.user.update",
        entity="users",
        entity_id=user.id,
        meta=payload.model_dump(exclude_unset=True, exclude={"password"}),
    )

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.get("/assignable", response_model=List[UserRead])
async def list_assignable_users(
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[UserRead]:
    """List users that can be assigned as staff.
    
    Returns active users with roles that can be assigned to staff positions:
    - STAFF
    - STORAGE_OPERATOR
    - HOTEL_MANAGER
    
    Excludes users who already have a staff assignment.
    """
    from ...models import Staff
    
    # Get users with assignable roles (STAFF, STORAGE_OPERATOR, HOTEL_MANAGER)
    assignable_roles = [UserRole.STAFF.value, UserRole.STORAGE_OPERATOR.value, UserRole.HOTEL_MANAGER.value]
    
    # Get all active users with assignable roles
    stmt = (
        select(User)
        .where(
            User.tenant_id == current_user.tenant_id,
            User.is_active == True,
            User.role.in_(assignable_roles),
        )
        .order_by(User.created_at.desc())
    )
    result = await session.execute(stmt)
    all_users = result.scalars().all()
    
    # Get users who already have staff assignments
    staff_stmt = select(Staff.user_id).where(Staff.tenant_id == current_user.tenant_id)
    staff_result = await session.execute(staff_stmt)
    assigned_user_ids = set(row[0] for row in staff_result.fetchall())
    
    # Filter out already assigned users
    assignable_users = [u for u in all_users if u.id not in assigned_user_ids]
    
    logger.info(
        f"Listing assignable staff for tenant {current_user.tenant_id}, "
        f"found {len(assignable_users)} assignable users out of {len(all_users)} total"
    )
    
    return [UserRead.model_validate(user) for user in assignable_users]


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Get a single user by ID."""
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Deactivate a user instead of hard delete."""
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False

    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="tenant.user.deactivate",
        entity="users",
        entity_id=user.id,
    )

    await session.commit()


@router.post("/{user_id}/reset-password", response_model=UserRead)
async def reset_user_password(
    user_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Reset user password to a random secure password.
    
    Returns the user with the new password in a special field for one-time display.
    """
    import secrets
    import string
    
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Generate a secure random password
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    new_password = ''.join(secrets.choice(alphabet) for _ in range(16))
    
    user.password_hash = get_password_hash(new_password)
    
    # Log password in development mode
    is_development = settings.environment.lower() in {"local", "dev", "development"}
    if is_development:
        logger.info(f"[USER PASSWORD RESET] Email: {user.email}")
        logger.info(f"[USER PASSWORD RESET] New Password: {new_password}")
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="tenant.user.reset_password",
        entity="users",
        entity_id=user.id,
    )
    
    await session.commit()
    await session.refresh(user)
    
    # Return user with temporary password field
    user_data = UserRead.model_validate(user).model_dump()
    user_data["temp_password"] = new_password
    
    return user_data


@router.post("/{user_id}/toggle-active", response_model=UserRead)
async def toggle_user_active(
    user_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Toggle user active status."""
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # If activating, check user limit
    if not user.is_active:
        try:
            await ensure_user_limit(session, current_user.tenant_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    
    user.is_active = not user.is_active
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action=f"tenant.user.{'activate' if user.is_active else 'deactivate'}",
        entity="users",
        entity_id=user.id,
    )
    
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)
