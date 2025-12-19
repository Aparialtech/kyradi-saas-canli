"""Authentication endpoints."""

import logging
from datetime import datetime, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.security import create_access_token, verify_password, get_password_hash
from ...db.session import get_session
from ...dependencies import get_current_active_user
from ...models import PasswordResetToken, PasswordResetMethod, PhoneLoginVerification, Tenant, User, UserRole

logger = logging.getLogger(__name__)
from ...schemas import (
    LoginRequest,
    TokenResponse,
    UserRead,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    VerifyLoginSMSRequest,
    VerifyLoginSMSResponse,
)
from ...schemas.auth import ResendLoginSMSRequest, ResendLoginSMSResponse
from ...services.audit import record_audit
from ...services.messaging import email_service, sms_service
from ...core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Authenticate user with email/password + tenant slug. Returns SMS verification requirement if needed."""
    tenant: Tenant | None = None
    # Normalize and validate tenant_slug (handle empty strings, None, etc.)
    tenant_slug = credentials.tenant_slug.strip() if credentials.tenant_slug else None
    if tenant_slug and tenant_slug.lower() not in {"admin", "__admin__", ""}:
        # Normalize tenant slug (lowercase, trim)
        normalized_slug = tenant_slug.strip().lower()
        if normalized_slug:  # Only query if slug is not empty after normalization
            stmt = select(Tenant).where(Tenant.slug == normalized_slug)
            tenant = (await session.execute(stmt)).scalar_one_or_none()
            if tenant is None:
                logger.warning(f"Login attempt with non-existent tenant slug: {normalized_slug}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Geçersiz otel slug: {normalized_slug}"
                )
            if not tenant.is_active:
                logger.warning(f"Login attempt with inactive tenant: {tenant.id} ({tenant.slug})")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Bu otel hesabı aktif değil. Lütfen yöneticinizle iletişime geçin."
                )

    stmt = select(User).where(User.email == credentials.email)
    user = (await session.execute(stmt)).scalar_one_or_none()

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Partner users must belong to the provided tenant.
    if tenant:
        if user.tenant_id != tenant.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
        token_tenant_id = tenant.id
    else:
        if user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant slug required")
        token_tenant_id = user.tenant_id

    # Check if phone verification is required (first login after password reset)
    if user.require_phone_verification_on_next_login:
        # Check if user has phone number
        if not user.phone_number:
            logger.warning(f"User {user.email} requires phone verification but has no phone number")
            # For now, allow login but log warning
            # In production, you might want to require phone number before allowing password reset
            user.require_phone_verification_on_next_login = False
            user.last_login_at = datetime.now(timezone.utc)
            await session.commit()
            token = create_access_token(
                subject=user.id,
                tenant_id=token_tenant_id,
                role=user.role,
            )
            return TokenResponse(access_token=token)
        
        # Create phone verification code
        phone_verification = PhoneLoginVerification.create_verification(
            user_id=user.id,
            tenant_id=user.tenant_id,
            expires_in_minutes=10,
            max_attempts=5,
        )
        session.add(phone_verification)
        await session.flush()
        
        # Send SMS
        try:
            await sms_service.send_login_verification_code(
                to_phone=user.phone_number,
                code=phone_verification.code,
                locale="tr-TR",  # TODO: Get from request
            )
        except Exception as e:
            logger.error(f"Failed to send login verification SMS to {user.phone_number}: {e}", exc_info=True)
            # Don't fail the request, but log the error
        
        await session.commit()
        
        # Return verification required response
        return TokenResponse(
            access_token=None,
            status="phone_verification_required",
            verification_id=phone_verification.id,
        )
    
    # Normal login flow
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()

    token = create_access_token(
        subject=user.id,
        tenant_id=token_tenant_id,
        role=user.role,
    )
    return TokenResponse(access_token=token)


@router.post("/verify-login-sms", response_model=VerifyLoginSMSResponse)
async def verify_login_sms(
    payload: VerifyLoginSMSRequest,
    session: AsyncSession = Depends(get_session),
) -> VerifyLoginSMSResponse:
    """Verify SMS code for first login after password reset."""
    # Look up verification record
    stmt = select(PhoneLoginVerification).where(PhoneLoginVerification.id == payload.verification_id)
    verification = (await session.execute(stmt)).scalar_one_or_none()
    
    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doğrulama kaydı bulunamadı.",
        )
    
    if not verification.is_valid():
        if verification.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu doğrulama kodu zaten kullanılmış.",
            )
        if datetime.now(timezone.utc) > verification.expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doğrulama kodu süresi dolmuş.",
            )
        if verification.attempt_count >= verification.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maksimum deneme sayısı aşıldı.",
            )
    
    # Increment attempt count
    verification.increment_attempt()
    await session.flush()
    
    # Compare code (constant-time comparison)
    import hmac
    code_valid = hmac.compare_digest(verification.code, payload.code)
    
    if not code_valid:
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz doğrulama kodu.",
        )
    
    # Code is valid - mark as used
    verification.is_used = True
    verification.used_at = datetime.now(timezone.utc)
    
    # Get user and clear the flag
    stmt = select(User).where(User.id == verification.user_id)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )
    
    user.require_phone_verification_on_next_login = False
    user.last_login_at = datetime.now(timezone.utc)
    
    # Determine tenant for token
    tenant_id = user.tenant_id
    
    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="auth.login.sms_verified",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email},
    )
    
    await session.commit()
    
    # Create and return auth token
    token = create_access_token(
        subject=user.id,
        tenant_id=tenant_id,
        role=user.role,
    )
    
    return VerifyLoginSMSResponse(
        access_token=token,
        message="Giriş başarıyla doğrulandı.",
    )


@router.post("/resend-login-sms", response_model=ResendLoginSMSResponse)
async def resend_login_sms(
    payload: ResendLoginSMSRequest,
    session: AsyncSession = Depends(get_session),
) -> ResendLoginSMSResponse:
    """Resend SMS verification code for login."""
    # Find existing verification
    stmt = select(PhoneLoginVerification).where(
        PhoneLoginVerification.id == payload.verification_id,
        PhoneLoginVerification.is_used == False,
    )
    existing_verification = (await session.execute(stmt)).scalar_one_or_none()
    
    if existing_verification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doğrulama kaydı bulunamadı veya zaten kullanılmış.",
        )
    
    # Check if verification is still valid (not expired)
    if datetime.now(timezone.utc) > existing_verification.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doğrulama kodu süresi dolmuş. Lütfen tekrar giriş yapın.",
        )
    
    # Get user to send SMS
    stmt = select(User).where(User.id == existing_verification.user_id)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )
    
    if not user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanıcının telefon numarası kayıtlı değil.",
        )
    
    # Create new verification code (invalidate old one by creating new)
    new_verification = PhoneLoginVerification.create_verification(
        user_id=user.id,
        tenant_id=user.tenant_id,
        expires_in_minutes=10,
        max_attempts=5,
    )
    session.add(new_verification)
    
    # Mark old verification as used (to prevent reuse)
    existing_verification.is_used = True
    existing_verification.used_at = datetime.now(timezone.utc)
    
    await session.flush()
    
    # Send SMS with new code
    try:
        await sms_service.send_login_verification_code(
            to_phone=user.phone_number,
            code=new_verification.code,
            locale="tr-TR",
        )
        logger.info(f"SMS verification code resent to {user.phone_number} for user {user.email}")
    except Exception as e:
        logger.error(f"Failed to resend login verification SMS to {user.phone_number}: {e}", exc_info=True)
        # Don't fail the request, but log the error
        # In development mode, we still return success
    
    await session.commit()
    
    return ResendLoginSMSResponse(
        message="Doğrulama kodu yeniden gönderildi.",
        verification_id=new_verification.id,
    )


@router.get("/me", response_model=UserRead)
async def read_me(current_user: User = Depends(get_current_active_user)) -> UserRead:
    """Return information about the authenticated user."""
    return UserRead.model_validate(current_user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ForgotPasswordResponse:
    """Request password reset via email with 6-digit verification code."""
    stmt = select(User).where(User.email == payload.email)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        # Don't reveal if user exists for security
        return ForgotPasswordResponse(
            message="Eğer bu e-posta adresi kayıtlıysa, doğrulama kodu gönderilmiştir.",
        )

    # Get client IP and user agent
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", None)

    # Generate 6-digit verification code
    verification_code = "".join([str(secrets.randbelow(10)) for _ in range(6)])

    # Create password reset token with the code
    reset_token = PasswordResetToken.create_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        expires_in_minutes=10,  # Code expires in 10 minutes
        method=PasswordResetMethod.EMAIL_LINK.value,
        created_ip=client_ip,
        user_agent=user_agent,
    )
    # Store the 6-digit code in the token field temporarily (will be replaced after verification)
    reset_token.verification_code = verification_code
    session.add(reset_token)
    await session.flush()
    
    # Send email with verification code
    try:
        await email_service.send_password_reset_code(
            to_email=user.email,
            code=verification_code,
            locale="tr-TR",
        )
        logger.info(f"Password reset code sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send password reset code to {user.email}: {e}", exc_info=True)
        # Don't fail the request, but log the error
    
    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="auth.password.reset.code_sent",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email, "method": "email_code"},
    )
    await session.commit()
    
    # In development mode, return code in response for testing
    is_development = settings.environment.lower() in {"local", "dev", "development"}
    
    return ForgotPasswordResponse(
        message="Doğrulama kodu e-posta adresinize gönderildi.",
        reset_token=verification_code if is_development else None,  # Only in dev mode (for testing)
    )


@router.post("/verify-reset-code", response_model=VerifyResetCodeResponse)
async def verify_reset_code(
    payload: VerifyResetCodeRequest,
    session: AsyncSession = Depends(get_session),
) -> VerifyResetCodeResponse:
    """Verify the 6-digit code sent to email and return reset token."""
    # Find user by email
    stmt = select(User).where(User.email == payload.email)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kod veya e-posta adresi.",
        )
    
    # Find the most recent unused reset token for this user with matching code
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.is_used == False,
        PasswordResetToken.verification_code == payload.code,
    ).order_by(PasswordResetToken.created_at.desc())
    
    reset_token = (await session.execute(stmt)).scalar_one_or_none()
    
    if reset_token is None or not reset_token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş kod.",
        )
    
    # Code is valid - generate actual reset token
    import hmac
    code_valid = hmac.compare_digest(reset_token.verification_code or "", payload.code)
    
    if not code_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kod.",
        )
    
    # Clear the verification code and keep the token for password reset
    reset_token.verification_code = None
    
    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="auth.password.reset.code_verified",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email},
    )
    await session.commit()
    
    return VerifyResetCodeResponse(
        message="Kod doğrulandı. Yeni şifrenizi belirleyebilirsiniz.",
        reset_token=reset_token.token,
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> ResetPasswordResponse:
    """Reset password using email link token."""
    if not payload.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token gerekli.",
        )

    # Look up token
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.is_used == False,
    )
    reset_token = (await session.execute(stmt)).scalar_one_or_none()
    
    if reset_token is None or not reset_token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş token.",
        )
    
    # Get associated user
    stmt = select(User).where(User.id == reset_token.user_id)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )
    
    # Update password
    user.password_hash = get_password_hash(payload.new_password)
    
    # Mark token as used
    reset_token.is_used = True
    reset_token.used_at = datetime.now(timezone.utc)
    
    # Set flag to require phone verification on next login
    user.require_phone_verification_on_next_login = True
    
    # Log in development mode (without password)
    is_development = settings.environment.lower() in {"local", "dev", "development"}
    if is_development:
        logger.info(f"[PASSWORD RESET] User: {user.email} - Password reset completed")
    
    await record_audit(
        session,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="auth.password.reset.completed",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email, "method": "email_link"},
    )
    
    await session.commit()
    
    return ResetPasswordResponse(
        message="Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yaptığınızda telefonunuza bir doğrulama kodu gönderilecek.",
        success=True,
    )
