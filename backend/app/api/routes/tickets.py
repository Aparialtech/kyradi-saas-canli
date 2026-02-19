"""Ticket API routes for internal messaging system."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func

from ...db.session import get_session
from ...dependencies import require_tenant_operator, require_admin_user
from ...models.tenant import User
from ...models.ticket import Ticket, TicketStatus, TicketPriority, TicketTarget


router = APIRouter(prefix="/tickets", tags=["tickets"])


# ==================== SCHEMAS ====================

class TicketCreate(BaseModel):
    """Schema for creating a ticket."""
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    priority: TicketPriority = TicketPriority.MEDIUM
    target: TicketTarget = TicketTarget.ADMIN


class TicketUpdate(BaseModel):
    """Schema for updating a ticket."""
    title: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    resolution_note: Optional[str] = None


class TicketRead(BaseModel):
    """Schema for reading a ticket."""
    id: str
    title: str
    message: str
    status: TicketStatus
    priority: TicketPriority
    target: TicketTarget
    creator_id: str
    creator_email: Optional[str] = None
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[str] = None
    resolution_note: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    """Response schema for ticket list."""
    items: List[TicketRead]
    total: int
    page: int
    page_size: int
    total_pages: int
    unread_count: int


# ==================== PARTNER ENDPOINTS ====================

@router.get("", response_model=TicketListResponse)
async def list_tickets(
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    priority_filter: Optional[TicketPriority] = Query(None, alias="priority"),
    direction: Optional[str] = Query(None),  # "incoming" or "outgoing"
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> TicketListResponse:
    """List tickets for the current tenant (partner view)."""
    
    # Build query based on direction
    if direction == "incoming":
        # Incoming: Messages FROM admin TO this partner (target=partner, creator is not self)
        query = select(Ticket).where(
            and_(
                Ticket.tenant_id == current_user.tenant_id,
                Ticket.target.in_([TicketTarget.PARTNER, TicketTarget.ALL]),
                Ticket.creator_id != current_user.id
            )
        )
    elif direction == "outgoing":
        # Outgoing: Messages created BY this partner (to admin)
        query = select(Ticket).where(
            Ticket.creator_id == current_user.id
        )
    else:
        # No direction filter - show all related tickets
        query = select(Ticket).where(
            or_(
                Ticket.tenant_id == current_user.tenant_id,
                Ticket.creator_id == current_user.id
            )
        )
    
    # Apply filters
    if status_filter:
        query = query.where(Ticket.status == status_filter)
    if priority_filter:
        query = query.where(Ticket.priority == priority_filter)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Ticket.title.ilike(search_term),
                Ticket.message.ilike(search_term)
            )
        )
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.where(Ticket.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.where(Ticket.created_at <= end_dt)
        except ValueError:
            pass
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0
    
    # Count unread (only for incoming messages)
    unread_query = select(func.count()).select_from(
        select(Ticket).where(
            and_(
                Ticket.tenant_id == current_user.tenant_id,
                Ticket.target.in_([TicketTarget.PARTNER, TicketTarget.ALL]),
                Ticket.creator_id != current_user.id,
                Ticket.read_at.is_(None)
            )
        ).subquery()
    )
    unread_count = (await session.execute(unread_query)).scalar() or 0
    
    # Pagination
    query = query.order_by(Ticket.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await session.execute(query)
    tickets = result.scalars().all()
    
    # Convert to response
    items = []
    for ticket in tickets:
        items.append(TicketRead(
            id=ticket.id,
            title=ticket.title,
            message=ticket.message,
            status=ticket.status,
            priority=ticket.priority,
            target=ticket.target,
            creator_id=ticket.creator_id,
            creator_email=ticket.creator.email if ticket.creator else None,
            tenant_id=ticket.tenant_id,
            tenant_name=ticket.tenant.name if ticket.tenant else None,
            resolved_at=ticket.resolved_at,
            resolved_by_id=ticket.resolved_by_id,
            resolution_note=ticket.resolution_note,
            read_at=ticket.read_at,
            created_at=ticket.created_at,
            updated_at=None,
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return TicketListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        unread_count=unread_count,
    )


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreate,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """Create a new ticket."""
    
    ticket = Ticket(
        title=payload.title.strip(),
        message=payload.message.strip(),
        priority=payload.priority,
        target=payload.target,
        creator_id=current_user.id,
        tenant_id=current_user.tenant_id,
        status=TicketStatus.OPEN,
    )
    
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    
    return TicketRead(
        id=ticket.id,
        title=ticket.title,
        message=ticket.message,
        status=ticket.status,
        priority=ticket.priority,
        target=ticket.target,
        creator_id=ticket.creator_id,
        creator_email=current_user.email,
        tenant_id=ticket.tenant_id,
        resolved_at=ticket.resolved_at,
        resolved_by_id=ticket.resolved_by_id,
        resolution_note=ticket.resolution_note,
        read_at=ticket.read_at,
        created_at=ticket.created_at,
        updated_at=None,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get unread ticket count for current user."""
    
    unread_query = select(func.count()).select_from(
        select(Ticket).where(
            and_(
                or_(
                    Ticket.tenant_id == current_user.tenant_id,
                    Ticket.creator_id == current_user.id
                ),
                Ticket.read_at.is_(None),
                Ticket.creator_id != current_user.id  # Only count tickets not created by self
            )
        ).subquery()
    )
    unread_count = (await session.execute(unread_query)).scalar() or 0
    
    return {"unread_count": unread_count}


@router.get("/{ticket_id}", response_model=TicketRead)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """Get a single ticket by ID."""
    
    query = select(Ticket).where(
        Ticket.id == ticket_id,
        or_(
            Ticket.tenant_id == current_user.tenant_id,
            Ticket.creator_id == current_user.id
        )
    )
    
    ticket = (await session.execute(query)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    
    # Mark as read if not created by self
    if ticket.creator_id != current_user.id and ticket.read_at is None:
        ticket.read_at = datetime.utcnow()
        ticket.read_by_id = current_user.id
        await session.commit()
        await session.refresh(ticket)
    
    return TicketRead(
        id=ticket.id,
        title=ticket.title,
        message=ticket.message,
        status=ticket.status,
        priority=ticket.priority,
        target=ticket.target,
        creator_id=ticket.creator_id,
        creator_email=ticket.creator.email if ticket.creator else None,
        tenant_id=ticket.tenant_id,
        tenant_name=ticket.tenant.name if ticket.tenant else None,
        resolved_at=ticket.resolved_at,
        resolved_by_id=ticket.resolved_by_id,
        resolution_note=ticket.resolution_note,
        read_at=ticket.read_at,
        created_at=ticket.created_at,
        updated_at=None,
    )


# ==================== PARTNER MARK AS READ ====================

@router.patch("/{ticket_id}/read", response_model=TicketRead)
async def mark_ticket_as_read(
    ticket_id: str,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """Mark a ticket as read."""
    
    query = select(Ticket).where(
        Ticket.id == ticket_id,
        or_(
            Ticket.tenant_id == current_user.tenant_id,
            Ticket.creator_id == current_user.id
        )
    )
    
    ticket = (await session.execute(query)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    
    # Mark as read
    if ticket.read_at is None:
        ticket.read_at = datetime.utcnow()
        await session.commit()
        await session.refresh(ticket)
    
    return TicketRead(
        id=ticket.id,
        title=ticket.title,
        message=ticket.message,
        status=ticket.status,
        priority=ticket.priority,
        target=ticket.target,
        creator_id=ticket.creator_id,
        creator_email=ticket.creator.email if ticket.creator else None,
        tenant_id=ticket.tenant_id,
        tenant_name=ticket.tenant.name if ticket.tenant else None,
        resolved_at=ticket.resolved_at,
        resolved_by_id=ticket.resolved_by_id,
        resolution_note=ticket.resolution_note,
        read_at=ticket.read_at,
        created_at=ticket.created_at,
        updated_at=None,
    )


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/all", response_model=TicketListResponse)
async def list_all_tickets(
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    priority_filter: Optional[TicketPriority] = Query(None, alias="priority"),
    target_filter: Optional[TicketTarget] = Query(None, alias="target"),
    direction: Optional[str] = Query(None),  # "incoming" or "outgoing"
    tenant_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> TicketListResponse:
    """List all tickets (admin view)."""
    
    # Build query based on direction
    if direction == "incoming":
        # Incoming: Messages FROM partners TO admin (target=admin)
        query = select(Ticket).where(
            Ticket.target.in_([TicketTarget.ADMIN, TicketTarget.ALL])
        )
    elif direction == "outgoing":
        # Outgoing: Messages FROM admin TO partners (target=partner, created by admin)
        query = select(Ticket).where(
            and_(
                Ticket.target.in_([TicketTarget.PARTNER, TicketTarget.ALL]),
                Ticket.creator_id == current_user.id
            )
        )
    else:
        # No direction filter - show all tickets
        query = select(Ticket)
    
    # Apply filters
    if status_filter:
        query = query.where(Ticket.status == status_filter)
    if priority_filter:
        query = query.where(Ticket.priority == priority_filter)
    if target_filter:
        query = query.where(Ticket.target == target_filter)
    if tenant_id:
        query = query.where(Ticket.tenant_id == tenant_id)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Ticket.title.ilike(search_term),
                Ticket.message.ilike(search_term)
            )
        )
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0
    
    # Count unread (for admin, tickets targeted to admin that are unread)
    unread_query = select(func.count()).select_from(
        select(Ticket).where(
            and_(
                Ticket.target.in_([TicketTarget.ADMIN, TicketTarget.ALL]),
                Ticket.read_at.is_(None)
            )
        ).subquery()
    )
    unread_count = (await session.execute(unread_query)).scalar() or 0
    
    # Pagination
    query = query.order_by(Ticket.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await session.execute(query)
    tickets = result.scalars().all()
    
    # Convert to response
    items = []
    for ticket in tickets:
        items.append(TicketRead(
            id=ticket.id,
            title=ticket.title,
            message=ticket.message,
            status=ticket.status,
            priority=ticket.priority,
            target=ticket.target,
            creator_id=ticket.creator_id,
            creator_email=ticket.creator.email if ticket.creator else None,
            tenant_id=ticket.tenant_id,
            tenant_name=ticket.tenant.name if ticket.tenant else None,
            resolved_at=ticket.resolved_at,
            resolved_by_id=ticket.resolved_by_id,
            resolution_note=ticket.resolution_note,
            read_at=ticket.read_at,
            created_at=ticket.created_at,
            updated_at=None,
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return TicketListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        unread_count=unread_count,
    )


@router.patch("/{ticket_id}", response_model=TicketRead)
async def update_ticket(
    ticket_id: str,
    payload: TicketUpdate,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """Update a ticket (admin only)."""
    
    query = select(Ticket).where(Ticket.id == ticket_id)
    ticket = (await session.execute(query)).scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    
    # Update fields
    if payload.title is not None:
        ticket.title = payload.title.strip()
    if payload.message is not None:
        ticket.message = payload.message.strip()
    if payload.status is not None:
        ticket.status = payload.status
        # If resolving, set resolved info
        if payload.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
            ticket.resolved_at = datetime.utcnow()
            ticket.resolved_by_id = current_user.id
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.resolution_note is not None:
        ticket.resolution_note = payload.resolution_note.strip()
    
    await session.commit()
    await session.refresh(ticket)
    
    return TicketRead(
        id=ticket.id,
        title=ticket.title,
        message=ticket.message,
        status=ticket.status,
        priority=ticket.priority,
        target=ticket.target,
        creator_id=ticket.creator_id,
        creator_email=ticket.creator.email if ticket.creator else None,
        tenant_id=ticket.tenant_id,
        tenant_name=ticket.tenant.name if ticket.tenant else None,
        resolved_at=ticket.resolved_at,
        resolved_by_id=ticket.resolved_by_id,
        resolution_note=ticket.resolution_note,
        read_at=ticket.read_at,
        created_at=ticket.created_at,
        updated_at=None,
    )


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(
    ticket_id: str,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a ticket (admin only)."""
    
    query = select(Ticket).where(Ticket.id == ticket_id)
    ticket = (await session.execute(query)).scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    
    await session.delete(ticket)
    await session.commit()
