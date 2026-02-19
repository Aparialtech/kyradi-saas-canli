"""Ticket model for internal messaging system."""

from typing import Optional
import enum

from sqlalchemy import String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdentifiedMixin, TimestampMixin


class TicketStatus(str, enum.Enum):
    """Ticket status enum."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, enum.Enum):
    """Ticket priority enum."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketTarget(str, enum.Enum):
    """Target audience for the ticket."""
    ADMIN = "admin"
    PARTNER = "partner"
    ALL = "all"


class Ticket(IdentifiedMixin, TimestampMixin, Base):
    """Ticket model for internal messaging."""
    
    __tablename__ = "tickets"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, native_enum=False),
        default=TicketStatus.OPEN,
        nullable=False
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, native_enum=False),
        default=TicketPriority.MEDIUM,
        nullable=False
    )
    target: Mapped[TicketTarget] = mapped_column(
        Enum(TicketTarget, native_enum=False),
        default=TicketTarget.ADMIN,
        nullable=False
    )
    
    # Creator info
    creator_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("users.id"), 
        nullable=False
    )
    creator: Mapped["User"] = relationship(
        "User", 
        foreign_keys=[creator_id], 
        lazy="selectin"
    )
    
    # Tenant info (for partner tickets)
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36), 
        ForeignKey("tenants.id"), 
        nullable=True
    )
    tenant: Mapped[Optional["Tenant"]] = relationship(
        "Tenant", 
        foreign_keys=[tenant_id], 
        lazy="selectin"
    )
    
    # Response/Resolution
    resolved_at: Mapped[Optional[str]] = mapped_column(DateTime, nullable=True)
    resolved_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), 
        ForeignKey("users.id"), 
        nullable=True
    )
    resolved_by: Mapped[Optional["User"]] = relationship(
        "User", 
        foreign_keys=[resolved_by_id], 
        lazy="selectin"
    )
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Read tracking
    read_at: Mapped[Optional[str]] = mapped_column(DateTime, nullable=True)
    read_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), 
        ForeignKey("users.id"), 
        nullable=True
    )

    def __repr__(self) -> str:
        return f"<Ticket(id={self.id}, title={self.title}, status={self.status})>"
