"""Partner storage helper endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...dependencies import require_tenant_operator
from ...db.session import get_session
from ...models import Reservation, User
from ...services.storage_assignment import suggest_storage_for_reservation

router = APIRouter(prefix="/partner/storages", tags=["partner-storages"])


@router.get("/auto-assign")
async def auto_assign_storage(
    reservation_id: str = Query(..., description="Reservation ID to optimize storage for"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_operator),
) -> dict[str, str]:
    """Suggest the best storage unit for the requested reservation."""
    stmt = select(Reservation).where(
        Reservation.id == reservation_id,
        Reservation.tenant_id == current_user.tenant_id,
    )
    reservation = (await session.execute(stmt)).scalar_one_or_none()
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    storage, reason = await suggest_storage_for_reservation(session, reservation)
    if storage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No suitable storage available for this reservation",
        )

    return {
        "storage_id": storage.id,
        "storage_code": storage.code,
        "reason": reason,
    }

