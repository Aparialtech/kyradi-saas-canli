"""Partner mail endpoints for sending emails to admin and viewing received emails."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_admin
from ...models import User, Tenant, AuditLog
from ...models.enums import UserRole
from ...services.messaging import EmailService
from ...services.audit import record_audit

router = APIRouter(prefix="/partners/mail", tags=["partner-mail"])
logger = logging.getLogger(__name__)


# =============================================================================
# SCHEMAS
# =============================================================================

class PartnerSendEmailRequest(BaseModel):
    """Request model for partner sending email to admin."""
    subject: str
    body: str
    is_html: bool = False


class PartnerSendEmailResponse(BaseModel):
    """Response model for partner email send."""
    success: bool
    message: str


class ReceivedEmail(BaseModel):
    """Model for received email from admin."""
    id: str
    subject: str
    body: str
    sender_email: str
    sender_name: Optional[str] = None
    sent_at: datetime
    is_html: bool = False


class PartnerEmailListResponse(BaseModel):
    """Response model for listing received emails."""
    emails: List[ReceivedEmail]
    total_count: int


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/send-to-admin", response_model=PartnerSendEmailResponse)
async def partner_send_email_to_admin(
    payload: PartnerSendEmailRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_admin),
) -> PartnerSendEmailResponse:
    """Send email from partner to admin.
    
    Only tenant_admin and hotel_manager can send emails to admin.
    """
    if current_user.role not in {UserRole.TENANT_ADMIN, UserRole.HOTEL_MANAGER}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admin or hotel manager can send emails to admin"
        )
    
    if not payload.subject.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject is required"
        )
    
    if not payload.body.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body is required"
        )
    
    # Get tenant info
    tenant_stmt = select(Tenant).where(Tenant.id == current_user.tenant_id)
    tenant = (await session.execute(tenant_stmt)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Get admin users (super_admin and support roles)
    admin_users_stmt = select(User).where(
        User.role.in_([UserRole.SUPER_ADMIN, UserRole.SUPPORT])
    )
    admin_users_result = await session.execute(admin_users_stmt)
    admin_users = admin_users_result.scalars().all()
    
    if not admin_users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No admin users found to send email to"
        )
    
    # Prepare email content
    admin_emails = [user.email for user in admin_users]
    
    # Format email body with tenant info
    formatted_body = f"""
<p><strong>Gönderen:</strong> {current_user.full_name or current_user.email}</p>
<p><strong>Otel:</strong> {tenant.name}</p>
<p><strong>Tenant ID:</strong> {tenant.id}</p>
<hr>
{payload.body}
"""
    
    if not payload.is_html:
        formatted_body = f"""
Gönderen: {current_user.full_name or current_user.email}
Otel: {tenant.name}
Tenant ID: {tenant.id}
---
{payload.body}
"""
    
    # Send email
    try:
        result = await EmailService.send_bulk_email(
            recipients=admin_emails,
            subject=f"[Partner] {payload.subject}",
            body=formatted_body,
            is_html=payload.is_html,
        )
        
        # Audit log
        await record_audit(
            session,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            action="partner.mail.send_to_admin",
            entity="email",
            entity_id=None,
            meta={
                "subject": payload.subject[:100],
                "recipient_count": len(admin_emails),
                "success_count": result["success_count"],
                "failed_count": result["failed_count"],
            },
        )
        await session.commit()
        
        return PartnerSendEmailResponse(
            success=True,
            message=f"E-posta {len(admin_emails)} admin kullanıcısına başarıyla gönderildi"
        )
    except Exception as exc:
        logger.exception(f"Error sending email from partner {current_user.tenant_id} to admin")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"E-posta gönderilemedi: {str(exc)}"
        )


@router.get("/received", response_model=PartnerEmailListResponse)
async def partner_get_received_emails(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_admin),
) -> PartnerEmailListResponse:
    """Get emails received from admin.
    
    This retrieves emails sent by admin to this tenant's users.
    We use audit logs to track admin emails sent to tenant users.
    """
    # Get all users in this tenant
    tenant_users_stmt = select(User).where(User.tenant_id == current_user.tenant_id)
    tenant_users_result = await session.execute(tenant_users_stmt)
    tenant_users = tenant_users_result.scalars().all()
    tenant_user_ids = [user.id for user in tenant_users]
    tenant_user_emails = {user.id: user.email for user in tenant_users}
    
    # Query audit logs for admin emails sent to this tenant
    # Look for admin.email.bulk_send actions that targeted this tenant's users
    audit_stmt = (
        select(AuditLog)
        .where(
            AuditLog.action == "admin.email.bulk_send",
            AuditLog.tenant_id == current_user.tenant_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    
    audit_result = await session.execute(audit_stmt)
    audit_logs = audit_result.scalars().all()
    
    # Get total count
    count_stmt = (
        select(func.count(AuditLog.id))
        .where(
            AuditLog.action == "admin.email.bulk_send",
            AuditLog.tenant_id == current_user.tenant_id,
        )
    )
    total_count = await session.scalar(count_stmt) or 0
    
    # Get sender info from audit logs
    emails = []
    for log in audit_logs:
        # Get sender user
        sender_stmt = select(User).where(User.id == log.actor_user_id)
        sender = (await session.execute(sender_stmt)).scalar_one_or_none()
        
        # Extract email info from meta
        meta = log.meta_json or {}
        subject = meta.get("subject", "E-posta")
        
        # Create email object
        emails.append(ReceivedEmail(
            id=log.id,
            subject=subject,
            body=f"E-posta içeriği audit log'da saklanmamaktadır. Gönderim tarihi: {log.created_at.isoformat()}",
            sender_email=sender.email if sender else "admin@kyradi.com",
            sender_name=sender.full_name if sender else None,
            sent_at=log.created_at,
            is_html=False,
        ))
    
    return PartnerEmailListResponse(
        emails=emails,
        total_count=total_count,
    )


@router.get("/sent", response_model=PartnerEmailListResponse)
async def partner_get_sent_emails(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_admin),
) -> PartnerEmailListResponse:
    """Get emails sent by this partner to admin.
    
    This retrieves emails sent by this tenant to admin from audit logs.
    """
    # Query audit logs for partner emails sent to admin
    audit_stmt = (
        select(AuditLog)
        .where(
            AuditLog.action == "partner.mail.send_to_admin",
            AuditLog.tenant_id == current_user.tenant_id,
            AuditLog.actor_user_id == current_user.id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    
    audit_result = await session.execute(audit_stmt)
    audit_logs = audit_result.scalars().all()
    
    # Get total count
    count_stmt = (
        select(func.count(AuditLog.id))
        .where(
            AuditLog.action == "partner.mail.send_to_admin",
            AuditLog.tenant_id == current_user.tenant_id,
            AuditLog.actor_user_id == current_user.id,
        )
    )
    total_count = await session.scalar(count_stmt) or 0
    
    # Get admin info
    admin_users_stmt = select(User).where(
        User.role.in_([UserRole.SUPER_ADMIN, UserRole.SUPPORT])
    )
    admin_users_result = await session.execute(admin_users_stmt)
    admin_users = admin_users_result.scalars().all()
    
    # Create email objects
    emails = []
    for log in audit_logs:
        # Extract email info from meta
        meta = log.meta_json or {}
        subject = meta.get("subject", "E-posta")
        
        # Create email object
        emails.append(ReceivedEmail(
            id=log.id,
            subject=subject,
            body=f"E-posta içeriği audit log'da saklanmamaktadır. Gönderim tarihi: {log.created_at.isoformat()}",
            sender_email=current_user.email,
            sender_name=current_user.full_name,
            sent_at=log.created_at,
            is_html=False,
        ))
    
    return PartnerEmailListResponse(
        emails=emails,
        total_count=total_count,
    )

