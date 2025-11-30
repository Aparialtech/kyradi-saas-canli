"""Super-admin user management endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.security import get_password_hash
from ...db.session import get_session
from ...dependencies import require_super_admin
from ...models import Tenant, User
from ...models.enums import UserRole
from ...schemas import AdminUserCreate, AdminUserRead, AdminUserUpdate
from ...services.audit import record_audit

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


async def _load_user_or_404(session: AsyncSession, user_id: str) -> User:
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("", response_model=List[AdminUserRead])
async def list_admin_users(
    tenant_id: Optional[str] = Query(default=None),
    role: Optional[UserRole] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_super_admin),
) -> List[AdminUserRead]:
    """List users visible to super-admins."""
    stmt = select(User)
    if tenant_id:
        stmt = stmt.where(User.tenant_id == tenant_id)
    if role:
        stmt = stmt.where(User.role == role.value)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    result = await session.execute(stmt.order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [AdminUserRead.model_validate(user) for user in users]


@router.post("", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    payload: AdminUserCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_super_admin),
) -> AdminUserRead:
    """Create a user that can be used in tenant or admin panels."""
    existing = await session.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    if payload.role != UserRole.SUPER_ADMIN and not payload.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for tenant-scoped roles",
        )

    if payload.tenant_id:
        tenant = await session.get(Tenant, payload.tenant_id)
        if tenant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    else:
        tenant = None

    user = User(
        tenant_id=tenant.id if tenant else None,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role.value,
        is_active=payload.is_active,
        phone_number=payload.phone_number,
        require_phone_verification_on_next_login=payload.require_phone_verification_on_next_login,
    )
    session.add(user)
    await session.flush()

    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=current_user.id,
        action="admin.user.create",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email, "role": user.role},
    )

    await session.commit()
    await session.refresh(user)
    return AdminUserRead.model_validate(user)


@router.put("/{user_id}", response_model=AdminUserRead)
async def update_admin_user(
    user_id: str,
    payload: AdminUserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_super_admin),
) -> AdminUserRead:
    """Update user attributes and activation state."""
    user = await _load_user_or_404(session, user_id)
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] != user.email:
        existing = await session.execute(select(User).where(User.email == data["email"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    if "password" in data:
        user.password_hash = get_password_hash(data.pop("password"))
    if "role" in data:
        user.role = data["role"].value if isinstance(data["role"], UserRole) else data["role"]
    if "tenant_id" in data:
        if data["tenant_id"]:
            tenant = await session.get(Tenant, data["tenant_id"])
            if tenant is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
            user.tenant_id = tenant.id
        else:
            user.tenant_id = None
    if "phone_number" in data:
        user.phone_number = data["phone_number"]
    if "require_phone_verification_on_next_login" in data:
        user.require_phone_verification_on_next_login = data["require_phone_verification_on_next_login"]
    if "is_active" in data:
        user.is_active = data["is_active"]

    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=current_user.id,
        action="admin.user.update",
        entity="users",
        entity_id=user.id,
        meta={"updated_fields": list(data.keys())},
    )

    await session.commit()
    await session.refresh(user)
    return AdminUserRead.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_super_admin),
) -> None:
    """Soft delete / deactivate a user."""
    user = await _load_user_or_404(session, user_id)
    if not user.is_active:
        return
    user.is_active = False
    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=current_user.id,
        action="admin.user.deactivate",
        entity="users",
        entity_id=user.id,
    )
    await session.commit()

