"""Admin panel endpoints."""

from datetime import datetime, time, timedelta, timezone
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, case, func, select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.security import get_password_hash
from ...db.session import get_session
from ...dependencies import require_admin_user
from ...models import AuditLog, Location, Locker, Payment, PaymentStatus, Reservation, ReservationStatus, Settlement, Storage, Tenant, User, UserRole
from ...schemas import (
    AdminSummary,
    AdminTenantSummary,
    AdminDailyRevenue,
    AdminTopTenant,
    SystemHealth,
    AuditLogRead,
    AuditLogList,
    TenantCreate,
    TenantRead,
    TenantUpdate,
    TenantDetail,
    TenantPlanLimits,
    TenantMetrics,
    TenantPlanLimitsUpdate,
    UserCreate,
    UserRead,
    UserUpdate,
    UserPasswordReset,
)
from ...schemas.revenue import RevenueSummary, SettlementRead
from ...services.audit import record_audit
from ...services.limits import (
    get_plan_limits_for_tenant,
    update_tenant_plan,
    PlanLimits,
    active_user_count,
    ensure_user_limit,
    self_service_reservations_last24h,
    report_exports_last24h,
    get_storage_usage_mb,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

TENANT_USER_ALLOWED_ROLES = {
    UserRole.TENANT_ADMIN,
    UserRole.STAFF,
    UserRole.VIEWER,
}


def _validate_tenant_user_role(role: UserRole) -> None:
    if role not in TENANT_USER_ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role for tenant user")


async def _get_tenant_or_404(session: AsyncSession, tenant_id: str) -> Tenant:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant

async def _build_tenant_detail(
    session: AsyncSession,
    tenant: Tenant,
) -> TenantDetail:
    limits = await get_plan_limits_for_tenant(session, tenant.id)
    location_count = await session.scalar(
        select(func.count()).select_from(Location).where(Location.tenant_id == tenant.id)
    )
    locker_count = await session.scalar(
        select(func.count()).select_from(Locker).where(Locker.tenant_id == tenant.id)
    )
    active_reservation_count = await session.scalar(
        select(func.count()).select_from(Reservation).where(
            Reservation.tenant_id == tenant.id,
            Reservation.status == ReservationStatus.ACTIVE.value,
        )
    )
    total_reservations = await session.scalar(
        select(func.count()).select_from(Reservation).where(Reservation.tenant_id == tenant.id)
    )
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    revenue_30d = await session.scalar(
        select(func.coalesce(func.sum(Reservation.amount_minor), 0)).where(
            Reservation.tenant_id == tenant.id,
            Reservation.start_at >= thirty_days_ago,
        )
    )
    user_count = await active_user_count(session, tenant.id)
    self_service_24h = await self_service_reservations_last24h(session, tenant.id)
    export_24h = await report_exports_last24h(session, tenant.id)
    storage_used = await get_storage_usage_mb(session, tenant.id)

    return TenantDetail(
        tenant=TenantRead.model_validate(tenant),
        plan_limits=TenantPlanLimits(
            max_locations=limits.max_locations,
            max_lockers=limits.max_lockers,
            max_active_reservations=limits.max_active_reservations,
            max_users=limits.max_users,
            max_self_service_daily=limits.max_self_service_daily,
            max_reservations_total=limits.max_reservations_total,
            max_report_exports_daily=limits.max_report_exports_daily,
            max_storage_mb=limits.max_storage_mb,
        ),
        metrics=TenantMetrics(
            locations=int(location_count or 0),
            lockers=int(locker_count or 0),
            active_reservations=int(active_reservation_count or 0),
            total_reservations=int(total_reservations or 0),
            revenue_30d_minor=int(revenue_30d or 0),
            users=user_count,
            self_service_last24h=self_service_24h,
            report_exports_last24h=export_24h,
            storage_used_mb=storage_used,
        ),
    )


@router.get("/tenants", response_model=List[TenantRead])
async def list_tenants(
    plan: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> List[TenantRead]:
    """List tenants with optional filtering."""
    stmt: Select[tuple[Tenant]] = select(Tenant)
    if plan:
        stmt = stmt.where(Tenant.plan == plan)
    if is_active is not None:
        stmt = stmt.where(Tenant.is_active == is_active)
    if search:
        search_term = f"%{search.lower()}%"
        stmt = stmt.where(
            Tenant.name.ilike(search_term) |
            Tenant.slug.ilike(search_term)
        )
    stmt = stmt.order_by(Tenant.created_at.desc())

    result = await session.execute(stmt)
    tenants = result.scalars().all()
    return [TenantRead.model_validate(t) for t in tenants]


@router.post("/tenants", response_model=TenantRead, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    payload: TenantCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> TenantRead:
    """Create a new tenant."""
    exists = await session.execute(select(Tenant).where(Tenant.slug == payload.slug))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant slug already in use")

    tenant = Tenant(
        slug=payload.slug,
        name=payload.name,
        plan=payload.plan,
        is_active=payload.is_active,
        brand_color=payload.brand_color,
        logo_url=payload.logo_url,
    )
    session.add(tenant)
    await session.flush()

    await record_audit(
        session,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="admin.tenant.create",
        entity="tenants",
        entity_id=tenant.id,
        meta=payload.model_dump(),
    )

    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


@router.patch("/tenants/{tenant_id}", response_model=TenantRead)
async def update_tenant(
    tenant_id: str,
    payload: TenantUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> TenantRead:
    """Update tenant attributes."""
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)

    await record_audit(
        session,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="admin.tenant.update",
        entity="tenants",
        entity_id=tenant.id,
        meta=payload.model_dump(exclude_unset=True),
    )

    await session.commit()
    await session.refresh(tenant)
    return TenantRead.model_validate(tenant)


@router.get("/reports/summary")
async def admin_summary(
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> AdminSummary:
    """Return comprehensive global metrics for admin dashboard."""
    try:
        now = datetime.now(timezone.utc)
        day_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        # Global tenant counts
        total_tenants = await session.scalar(select(func.count()).select_from(Tenant))
        active_tenants = await session.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.is_active == True)
        )
        
        # Total users
        total_users = await session.scalar(select(func.count()).select_from(User))
        
        # Total storages across all tenants
        total_storages = await session.scalar(select(func.count()).select_from(Storage))
        
        # Reservations 24h and 7d
        reservations_24h = await session.scalar(
            select(func.count()).select_from(Reservation).where(
                Reservation.created_at >= day_start,
                Reservation.created_at < day_end,
            )
        )
        reservations_7d = await session.scalar(
            select(func.count()).select_from(Reservation).where(
                Reservation.created_at >= week_start,
            )
        )
        
        # Total revenue and commission from settled payments (last 30 days)
        revenue_stmt = (
            select(
                func.coalesce(func.sum(Settlement.total_amount_minor), 0),
                func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0),
            )
            .where(
                Settlement.status == "settled",
                Settlement.created_at >= month_start,
            )
        )
        revenue_result = await session.execute(revenue_stmt)
        revenue_row = revenue_result.first()
        total_revenue_minor = int(revenue_row[0] or 0)
        total_commission_minor = int(revenue_row[1] or 0)
        
        # Tenant summaries with extended data
        tenant_revenue_stmt = (
            select(
                Reservation.tenant_id,
                func.coalesce(
                    func.sum(
                        case(
                            (
                                (Reservation.start_at >= day_start)
                                & (Reservation.start_at < day_end),
                                Reservation.amount_minor,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("today_revenue"),
                func.coalesce(
                    func.sum(
                        case(
                            (Reservation.status == ReservationStatus.ACTIVE.value, 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("active_reservations"),
            )
            .group_by(Reservation.tenant_id)
            .where(Reservation.tenant_id.isnot(None))
        )
        tenant_revenue_result = await session.execute(tenant_revenue_stmt)
        
        # Get 30-day revenue and commission per tenant
        tenant_30d_stmt = (
            select(
                Settlement.tenant_id,
                func.coalesce(func.sum(Settlement.total_amount_minor), 0).label("revenue_30d"),
                func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0).label("commission_30d"),
            )
            .where(
                Settlement.status == "settled",
                Settlement.created_at >= month_start,
            )
            .group_by(Settlement.tenant_id)
        )
        tenant_30d_result = await session.execute(tenant_30d_stmt)
        tenant_30d_map = {row[0]: {"revenue": int(row[1] or 0), "commission": int(row[2] or 0)} for row in tenant_30d_result.all()}
        
        # Get tenant names
        tenants_stmt = select(Tenant.id, Tenant.name, Tenant.slug)
        tenants_result = await session.execute(tenants_stmt)
        tenant_map = {row[0]: {"name": row[1], "slug": row[2]} for row in tenants_result.all()}
        
        summaries = []
        for row in tenant_revenue_result.all():
            tenant_id = row[0]
            tenant_info = tenant_map.get(tenant_id, {"name": None, "slug": None})
            tenant_30d = tenant_30d_map.get(tenant_id, {"revenue": 0, "commission": 0})
            summaries.append(
                AdminTenantSummary(
                    tenant_id=tenant_id,
                    tenant_name=tenant_info["name"],
                    tenant_slug=tenant_info["slug"],
                    today_revenue_minor=int(row[1] or 0),
                    active_reservations=int(row[2] or 0),
                    total_revenue_30d_minor=tenant_30d["revenue"],
                    total_commission_30d_minor=tenant_30d["commission"],
                )
            )
        
        # Daily revenue for last 30 days
        daily_revenue_stmt = (
            select(
                func.date(Settlement.created_at).label("date"),
                func.coalesce(func.sum(Settlement.total_amount_minor), 0).label("revenue"),
                func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0).label("commission"),
                func.count(Settlement.id).label("count"),
            )
            .where(
                Settlement.status == "settled",
                Settlement.created_at >= month_start,
            )
            .group_by(func.date(Settlement.created_at))
            .order_by(func.date(Settlement.created_at))
        )
        daily_revenue_result = await session.execute(daily_revenue_stmt)
        daily_revenue = [
            AdminDailyRevenue(
                date=row[0].isoformat() if isinstance(row[0], datetime) else str(row[0]),
                revenue_minor=int(row[1] or 0),
                commission_minor=int(row[2] or 0),
                transaction_count=int(row[3] or 0),
            )
            for row in daily_revenue_result.all()
        ]
        
        # Top 5 tenants by revenue
        top_tenants_stmt = (
            select(
                Settlement.tenant_id,
                func.coalesce(func.sum(Settlement.total_amount_minor), 0).label("revenue"),
                func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0).label("commission"),
            )
            .where(
                Settlement.status == "settled",
                Settlement.created_at >= month_start,
            )
            .group_by(Settlement.tenant_id)
            .order_by(func.sum(Settlement.total_amount_minor).desc())
            .limit(5)
        )
        top_tenants_result = await session.execute(top_tenants_stmt)
        top_tenants = [
            AdminTopTenant(
                tenant_id=row[0],
                tenant_name=tenant_map.get(row[0], {}).get("name", "Unknown"),
                revenue_minor=int(row[1] or 0),
                commission_minor=int(row[2] or 0),
            )
            for row in top_tenants_result.all()
        ]
        
        # System health (simplified - can be enhanced with actual service checks)
        system_health = SystemHealth(
            email_service_status="ok",  # TODO: Implement actual health check
            email_service_last_error=None,
            sms_service_status="ok",  # TODO: Implement actual health check
            sms_service_last_error=None,
            payment_provider_status="ok",  # TODO: Implement actual health check
            payment_provider_last_success=now,  # TODO: Get from actual payment logs
        )
        
        return AdminSummary(
            total_tenants=int(total_tenants or 0),
            active_tenants=int(active_tenants or 0),
            total_users=int(total_users or 0),
            total_storages=int(total_storages or 0),
            reservations_24h=int(reservations_24h or 0),
            reservations_7d=int(reservations_7d or 0),
            total_revenue_minor=total_revenue_minor,
            total_commission_minor=total_commission_minor,
            tenants=summaries,
            daily_revenue_30d=daily_revenue,
            top_tenants=top_tenants,
            system_health=system_health,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("reports/summary: error while building summary")
        return {
            "total_revenue": 0,
            "total_reservations": 0,
            "monthly_revenue": [],
        }


@router.get("/audit-logs", response_model=AuditLogList)
async def list_audit_logs(
    tenant_id: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    from_date: Optional[datetime] = Query(default=None, description="Başlangıç tarihi (ISO 8601)"),
    to_date: Optional[datetime] = Query(default=None, description="Bitiş tarihi (ISO 8601)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    source: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> AuditLogList:
    """Return audit logs (optionally filtered)."""
    filters = []
    if tenant_id:
        filters.append(AuditLog.tenant_id == tenant_id)
    if action:
        filters.append(AuditLog.action == action)
    if from_date:
        filters.append(AuditLog.created_at >= from_date)
    if to_date:
        filters.append(AuditLog.created_at <= to_date)
    if source:
        filters.append(cast(AuditLog.meta_json["source"], String) == source)

    count_stmt = select(func.count()).select_from(AuditLog)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = await session.scalar(count_stmt)

    stmt: Select[tuple[AuditLog]] = select(AuditLog)
    if filters:
        stmt = stmt.where(*filters)
    stmt = (
        stmt.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await session.execute(stmt)
    logs = result.scalars().all()
    return AuditLogList(
        items=[AuditLogRead.model_validate(log) for log in logs],
        total=int(total or 0),
        page=page,
        page_size=page_size,
    )
@router.get("/tenants/{tenant_id}/detail", response_model=TenantDetail)
async def tenant_detail(
    tenant_id: str,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> TenantDetail:
    """Return aggregated metrics and limits for a tenant."""
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    return await _build_tenant_detail(session, tenant)


@router.patch("/tenants/{tenant_id}/plan-limits", response_model=TenantDetail)
async def update_tenant_plan_limits(
    tenant_id: str,
    payload: TenantPlanLimitsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> TenantDetail:
    """Update tenant plan and optional limit overrides."""
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    override_values = {
        "max_locations": payload.max_locations,
        "max_lockers": payload.max_lockers,
        "max_active_reservations": payload.max_active_reservations,
        "max_users": payload.max_users,
        "max_self_service_daily": payload.max_self_service_daily,
        "max_reservations_total": payload.max_reservations_total,
        "max_report_exports_daily": payload.max_report_exports_daily,
        "max_storage_mb": payload.max_storage_mb,
    }
    overrides = None
    if any(value is not None for value in override_values.values()):
        overrides = PlanLimits(**override_values)

    await update_tenant_plan(session, tenant_id, plan=payload.plan, overrides=overrides)

    await record_audit(
        session,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="admin.tenant.plan.update",
        entity="tenants",
        entity_id=tenant_id,
        meta=payload.model_dump(exclude_none=True),
    )

    await session.commit()

    updated = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = updated.scalar_one()
    return await _build_tenant_detail(session, tenant)


@router.get("/tenants/{tenant_id}/users", response_model=List[UserRead])
async def admin_list_tenant_users(
    tenant_id: str,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> List[UserRead]:
    """List users belonging to a tenant."""
    await _get_tenant_or_404(session, tenant_id)
    stmt = (
        select(User)
        .where(User.tenant_id == tenant_id)
        .order_by(User.created_at.desc())
    )
    result = await session.execute(stmt)
    users = result.scalars().all()
    return [UserRead.model_validate(user) for user in users]


@router.post("/tenants/{tenant_id}/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def admin_create_tenant_user(
    tenant_id: str,
    payload: UserCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> UserRead:
    """Create a new user for a tenant."""
    await _get_tenant_or_404(session, tenant_id)
    _validate_tenant_user_role(payload.role)
    if payload.is_active:
        try:
            await ensure_user_limit(session, tenant_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    exists = await session.execute(select(User).where(User.email == payload.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        tenant_id=tenant_id,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role.value,
        is_active=payload.is_active,
    )
    session.add(user)
    await session.flush()

    # Log password in development mode
    from ...core.config import settings
    import logging
    logger = logging.getLogger(__name__)
    is_development = settings.environment.lower() in {"local", "dev", "development"}
    if is_development:
        logger.info(f"[ADMIN USER CREATE] Email: {payload.email}")
        logger.info(f"[ADMIN USER CREATE] Password: {payload.password}")
        logger.info(f"[ADMIN USER CREATE] Role: {payload.role.value}")

    await record_audit(
        session,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="admin.tenant.user.create",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email, "role": user.role},
    )

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/tenants/{tenant_id}/users/{user_id}", response_model=UserRead)
async def admin_update_tenant_user(
    tenant_id: str,
    user_id: str,
    payload: UserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> UserRead:
    """Update tenant user fields (role, status, password)."""
    await _get_tenant_or_404(session, tenant_id)
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "role" in update_data and update_data["role"] is not None:
        _validate_tenant_user_role(update_data["role"])
        update_data["role"] = update_data["role"].value

    reactivating = bool(update_data.get("is_active")) and not user.is_active
    if reactivating:
        try:
            await ensure_user_limit(session, tenant_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    for field, value in update_data.items():
        setattr(user, field, value)

    await record_audit(
        session,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="admin.tenant.user.update",
        entity="users",
        entity_id=user.id,
        meta=payload.model_dump(exclude_unset=True, exclude={"password"}),
    )

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.post("/tenants/{tenant_id}/users/{user_id}/reset-password", response_model=UserRead)
async def admin_reset_tenant_user_password(
    tenant_id: str,
    user_id: str,
    payload: UserPasswordReset,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> UserRead:
    """Reset a tenant user's password."""
    await _get_tenant_or_404(session, tenant_id)
    user = (
        await session.execute(
            select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(payload.password)
    
    # Log password in development mode
    from ...core.config import settings
    import logging
    logger = logging.getLogger(__name__)
    is_development = settings.environment.lower() in {"local", "dev", "development"}
    if is_development:
        logger.info(f"[ADMIN PASSWORD RESET] User: {user.email}")
        logger.info(f"[ADMIN PASSWORD RESET] New Password: {payload.password}")

    await record_audit(
        session,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="admin.tenant.user.reset_password",
        entity="users",
        entity_id=user.id,
    )

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.get("/revenue/summary", response_model=RevenueSummary)
async def admin_global_revenue_summary(
    tenant_id: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> RevenueSummary:
    """Get global revenue summary (all tenants or filtered by tenant_id)."""
    from ...services.revenue import get_tenant_revenue_summary
    
    if tenant_id:
        # Single tenant summary
        summary = await get_tenant_revenue_summary(
            session,
            tenant_id=tenant_id,
            date_from=date_from,
            date_to=date_to,
        )
    else:
        # Global summary across all tenants
        stmt = (
            select(
                func.coalesce(func.sum(Settlement.total_amount_minor), 0),
                func.coalesce(func.sum(Settlement.tenant_settlement_minor), 0),
                func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0),
                func.count(Settlement.id),
            )
            .where(Settlement.status == "settled")
        )
        if date_from:
            stmt = stmt.where(Settlement.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Settlement.created_at <= date_to)
        
        result = await session.execute(stmt)
        row = result.first()
        summary = {
            "total_revenue_minor": int(row[0] or 0),
            "tenant_settlement_minor": int(row[1] or 0),
            "kyradi_commission_minor": int(row[2] or 0),
            "transaction_count": int(row[3] or 0),
        }
    
    return RevenueSummary(**summary)


@router.get("/settlements", response_model=List[SettlementRead])
async def admin_global_settlements(
    tenant_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> List[SettlementRead]:
    """List all settlements (global or filtered by tenant)."""
    stmt = select(Settlement)
    
    if tenant_id:
        stmt = stmt.where(Settlement.tenant_id == tenant_id)
    if status:
        stmt = stmt.where(Settlement.status == status)
    if date_from:
        stmt = stmt.where(Settlement.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Settlement.created_at <= date_to)
    
    stmt = stmt.order_by(Settlement.created_at.desc())
    
    result = await session.execute(stmt)
    settlements = result.scalars().all()
    
    return [SettlementRead.model_validate(settlement) for settlement in settlements]


@router.get("/users", response_model=List[UserRead])
async def admin_list_all_users(
    tenant_id: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin_user),
) -> List[UserRead]:
    """List all users in the system (global or filtered)."""
    stmt = select(User)
    
    if tenant_id:
        stmt = stmt.where(User.tenant_id == tenant_id)
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    
    stmt = stmt.order_by(User.created_at.desc())
    
    result = await session.execute(stmt)
    users = result.scalars().all()
    
    return [UserRead.model_validate(user) for user in users]


@router.patch("/users/{user_id}", response_model=UserRead)
async def admin_update_user(
    user_id: str,
    payload: UserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_user),
) -> UserRead:
    """Update any user in the system (global user management)."""
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Prevent self-deactivation
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself"
        )
    
    update_data = payload.model_dump(exclude_unset=True)
    if "role" in update_data and update_data["role"] is not None:
        update_data["role"] = update_data["role"].value
    
    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=current_user.id,
        action="admin.user.update",
        entity="users",
        entity_id=user.id,
        meta=payload.model_dump(exclude_unset=True, exclude={"password"}),
    )
    
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)
