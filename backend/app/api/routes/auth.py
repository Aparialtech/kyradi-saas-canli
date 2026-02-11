"""Authentication endpoints."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
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
from ...schemas.auth import (
    ResendLoginSMSRequest,
    ResendLoginSMSResponse,
    SignupRequest,
    SignupResponse,
    TenantOnboardingRequest,
    TenantOnboardingResponse,
    PartnerLoginResponse,
)
from ...services.audit import record_audit
from ...services.messaging import email_service, sms_service
from ...core.config import settings
from ...utils.safe_redirect import sanitize_redirect_url
from ...utils.domain_validation import (
    DomainValidationError,
    RESERVED_SLUGS,
    normalize_and_validate_custom_domain,
    normalize_and_validate_slug,
)

router = APIRouter(tags=["auth"])


def normalize_email(email: str) -> str:
    """Normalize email for stable lookups."""
    return email.strip().lower()


def _auth_trace(request: Request | None, *, path: str, status_code: int, note: str = "") -> None:
    if request is None:
        return
    host = request.headers.get("host")
    origin = request.headers.get("origin")
    has_cookie = bool(request.cookies.get("access_token"))
    logger.info(
        "auth_trace path=%s status=%s host=%s origin=%s cookie_present=%s note=%s",
        path,
        status_code,
        host,
        origin,
        has_cookie,
        note,
    )


def _extract_effective_host(request: Request | None = None) -> str:
    if request is None:
        return ""
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("x-vercel-forwarded-host")
        or request.headers.get("host")
        or ""
    ).split(",")[0].strip().lower()
    if ":" in host:
        host = host.split(":", 1)[0]
    return host


def _cookie_domain(request: Request | None = None) -> str | None:
    host = _extract_effective_host(request)
    if host:
        if host == "kyradi.com" or host.endswith(".kyradi.com"):
            return ".kyradi.com"
        if host == "kyradi.app" or host.endswith(".kyradi.app"):
            return ".kyradi.app"
        # Custom domain: keep host-only cookie to avoid invalid domain scoping.
        return None

    if request is not None:
        return None

    env = (settings.environment or "").lower()
    if env in {"local", "dev", "development"}:
        return None
    return ".kyradi.com"


def _set_access_token_cookie(response: Response, token: str, request: Request | None = None) -> None:
    env = (settings.environment or "").lower()
    domain = _cookie_domain(request)
    secure_cookie = env not in {"local", "dev", "development"} or domain == ".kyradi.com"
    same_site = "none" if (secure_cookie and settings.auth_cookie_samesite_none) else "lax"
    max_age = int(settings.access_token_expire_minutes) * 60

    # Clear stale cookies first to avoid duplicate-name cookie ambiguity.
    response.delete_cookie("access_token", path="/", domain=".kyradi.com")
    response.delete_cookie("access_token", path="/")

    # Domain cookie for cross-subdomain auth.
    # Keep a single cookie variant to avoid duplicate-name ambiguity across browsers.
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite=same_site,
        domain=domain,
        path="/",
        max_age=max_age,
    )


def _clear_access_token_cookie(response: Response) -> None:
    # Clear both domain-scoped and host-only variations safely.
    response.delete_cookie("access_token", path="/", domain=".kyradi.com")
    response.delete_cookie("access_token", path="/")


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Authenticate user with email/password. Tenant is auto-detected from user's tenant_id."""
    # Find user by email
    stmt = select(User).where(User.email == credentials.email)
    user = (await session.execute(stmt)).scalar_one_or_none()

    # Check if email exists first
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı."
        )
    
    # Then check password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz şifre")

    # Check if user is active
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu hesap aktif değil. Lütfen yöneticinizle iletişime geçin.")

    # Determine token tenant_id based on user type
    token_tenant_id = user.tenant_id
    
    # For partner/tenant users, validate their tenant is active
    if user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        if not user.tenant_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Kullanıcı bir otele atanmamış")
        
        # Check tenant is active
        stmt = select(Tenant).where(Tenant.id == user.tenant_id)
        tenant = (await session.execute(stmt)).scalar_one_or_none()
        if tenant is None:
            logger.warning(f"User {user.email} has invalid tenant_id: {user.tenant_id}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geçersiz otel ataması")
        if not tenant.is_active:
            logger.warning(f"Login attempt for inactive tenant: {tenant.id} ({tenant.slug})")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu otel hesabı aktif değil. Lütfen yöneticinizle iletişime geçin.")

    # Clear any phone verification flag (feature disabled)
    if user.require_phone_verification_on_next_login:
        user.require_phone_verification_on_next_login = False
    
    # Normal login flow
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()

    token = create_access_token(
        subject=user.id,
        tenant_id=token_tenant_id,
        role=user.role,
    )
    _set_access_token_cookie(response, token, request)
    _auth_trace(request, path="/auth/login", status_code=200, note="login_ok")
    return TokenResponse(access_token=token)


@router.post("/partner/login", response_model=PartnerLoginResponse)
async def partner_login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> PartnerLoginResponse:
    """
    Partner login endpoint - returns tenant_slug for redirect to tenant subdomain.
    Only allows non-admin users (partner/tenant users).
    """
    # Find user by email
    stmt = select(User).where(User.email == credentials.email)
    user = (await session.execute(stmt)).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı."
        )
    
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz şifre")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu hesap aktif değil.")

    # Block admin users from partner login
    if user.role in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Yönetici hesapları partner girişi yapamaz. Lütfen yönetici giriş sayfasını kullanın."
        )

    # Partner must have a tenant
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Hesabınız henüz bir otele atanmamış. Lütfen önce otel oluşturun."
        )

    # Get tenant info
    stmt = select(Tenant).where(Tenant.id == user.tenant_id)
    tenant = (await session.execute(stmt)).scalar_one_or_none()
    
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geçersiz otel ataması")
    
    if not tenant.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu otel hesabı aktif değil.")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()

    token = create_access_token(
        subject=user.id,
        tenant_id=tenant.id,
        role=user.role,
    )
    _set_access_token_cookie(response, token, request)
    _auth_trace(request, path="/auth/partner/login", status_code=200, note=f"tenant_slug={tenant.slug}")
    logger.info(f"Partner login successful: {user.email} -> tenant {tenant.slug}")
    
    raw_redirect = request.query_params.get("redirect")
    safe_redirect = sanitize_redirect_url(raw_redirect, default_path="/app")

    return PartnerLoginResponse(
        access_token=token,
        token_type="bearer",
        tenant_slug=tenant.slug,
        tenant_id=tenant.id,
        redirect_url=safe_redirect if raw_redirect else None,
    )


@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """
    Admin login endpoint - only allows admin users (super_admin, support).
    Returns 403 for non-admin users.
    """
    # Find user by email
    stmt = select(User).where(User.email == credentials.email)
    user = (await session.execute(stmt)).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı."
        )
    
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz şifre")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu hesap aktif değil.")

    # Only allow admin users
    if user.role not in {UserRole.SUPER_ADMIN.value, UserRole.SUPPORT.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Bu giriş sayfası sadece yöneticiler içindir. Partner girişi için /partner/login kullanın."
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()

    token = create_access_token(
        subject=user.id,
        tenant_id=None,  # Admin users don't have tenant
        role=user.role,
    )
    _set_access_token_cookie(response, token, request)
    _auth_trace(request, path="/auth/admin/login", status_code=200, note=f"role={user.role}")
    
    logger.info(f"Admin login successful: {user.email} (role: {user.role})")
    
    return TokenResponse(access_token=token)


@router.post("/verify-login-sms", response_model=VerifyLoginSMSResponse)
async def verify_login_sms(
    payload: VerifyLoginSMSRequest,
    response: Response,
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
    _set_access_token_cookie(response, token, request)
    
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
async def read_me(request: Request, current_user: User = Depends(get_current_active_user)) -> UserRead:
    """Return information about the authenticated user."""
    _auth_trace(request, path="/auth/me", status_code=200, note=f"user_id={current_user.id}")
    return UserRead.model_validate(current_user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ForgotPasswordResponse:
    """Request password reset via email with 6-digit verification code."""
    normalized_email = normalize_email(payload.email)
    stmt = select(User).where(func.lower(User.email) == normalized_email)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        email_hash = hashlib.sha256(normalized_email.encode("utf-8")).hexdigest()[:12]
        logger.info(
            "forgot_password_request user_found=%s otp_created=%s mail_sent=%s reason=%s email_hash=%s",
            False,
            False,
            False,
            "NOT_FOUND",
            email_hash,
        )
        if settings.forgot_password_reveal_user_not_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bu e-posta adresi kayıtlı değil.",
            )
        # Don't reveal if user exists for security
        return ForgotPasswordResponse(
            message="Eğer bu e-posta adresi kayıtlıysa, doğrulama kodu gönderilmiştir.",
        )

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.forgot_password_rate_limit_window_minutes)
    cooldown_start = now - timedelta(seconds=settings.forgot_password_cooldown_seconds)

    recent_count_stmt = select(func.count()).select_from(PasswordResetToken).where(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.created_at >= window_start,
    )
    recent_count = int((await session.execute(recent_count_stmt)).scalar_one() or 0)
    if recent_count >= settings.forgot_password_rate_limit_count:
        logger.warning(
            "forgot_password_request user_found=%s otp_created=%s mail_sent=%s reason=%s user_id=%s",
            True,
            False,
            False,
            "RATE_LIMIT_WINDOW",
            user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.",
        )

    latest_token_stmt = (
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1)
    )
    latest_token = (await session.execute(latest_token_stmt)).scalar_one_or_none()
    if latest_token and latest_token.created_at and latest_token.created_at >= cooldown_start:
        logger.warning(
            "forgot_password_request user_found=%s otp_created=%s mail_sent=%s reason=%s user_id=%s",
            True,
            False,
            False,
            "RATE_LIMIT_COOLDOWN",
            user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Kod zaten gonderildi. Lutfen 60 saniye sonra tekrar deneyin.",
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
    mail_sent = False
    try:
        await email_service.send_password_reset_code(
            to_email=user.email,
            code=verification_code,
            locale="tr-TR",
        )
        mail_sent = True
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

    logger.info(
        "forgot_password_request user_found=%s otp_created=%s mail_sent=%s reason=%s user_id=%s",
        True,
        True,
        mail_sent,
        "OK",
        user.id,
    )
    
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
    stmt = select(User).where(func.lower(User.email) == normalize_email(payload.email))
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
    
    # Clear any existing phone verification requirement
    user.require_phone_verification_on_next_login = False
    
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
        message="Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.",
        success=True,
    )


# =====================
# Signup Endpoint
# =====================

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> SignupResponse:
    """
    Register a new user without tenant assignment.
    User will need to create/join a tenant after signup.
    """
    # Check if email already exists
    stmt = select(User).where(User.email == payload.email)
    existing_user = (await session.execute(stmt)).scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kayıtlı."
        )
    
    # Create user without tenant (will be assigned during onboarding)
    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.TENANT_ADMIN.value,  # Default role, will manage their own tenant
        is_active=True,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        tenant_id=None,  # No tenant yet
    )
    session.add(user)
    await session.flush()
    
    logger.info(f"New user registered: {user.email} (ID: {user.id})")
    
    await record_audit(
        session,
        tenant_id=None,
        actor_user_id=user.id,
        action="auth.signup",
        entity="users",
        entity_id=user.id,
        meta={"email": user.email},
    )
    
    await session.commit()
    await session.refresh(user)
    
    # Auto-login: Create access token
    access_token = create_access_token(
        subject=user.id,
        tenant_id=None,
        role=user.role,
    )
    _set_access_token_cookie(response, access_token, request)
    
    return SignupResponse(
        message="Kayıt başarılı! Şimdi otelinizi oluşturabilirsiniz.",
        user_id=user.id,
        access_token=access_token,
    )


@router.post("/logout")
async def logout(response: Response) -> dict[str, bool]:
    _clear_access_token_cookie(response)
    return {"ok": True}


# =====================
# Self-Service Tenant Creation (Onboarding)
# =====================

@router.post("/onboarding/create-tenant", response_model=TenantOnboardingResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant_onboarding(
    payload: TenantOnboardingRequest,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
) -> TenantOnboardingResponse:
    """
    Create a new tenant and assign the current user as OWNER/ADMIN.
    This is for self-service onboarding flow.
    """
    # User must not already have a tenant
    if current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaten bir otele atanmışsınız. Yeni otel oluşturamazsınız."
        )
    
    try:
        normalized_slug = normalize_and_validate_slug(payload.slug)
    except DomainValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    
    # Check slug uniqueness
    stmt = select(Tenant).where(Tenant.slug == normalized_slug)
    existing_slug = (await session.execute(stmt)).scalar_one_or_none()
    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu subdomain kullanımda, başka bir subdomain seçin."
        )
    
    # Check custom_domain uniqueness if provided
    if payload.custom_domain:
        try:
            custom_domain = normalize_and_validate_custom_domain(payload.custom_domain)
        except DomainValidationError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc

        stmt = select(Tenant).where(Tenant.custom_domain == custom_domain)
        existing_domain = (await session.execute(stmt)).scalar_one_or_none()
        if existing_domain:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu domain kullanımda, başka bir domain girin veya sadece subdomain ile devam edin."
            )
    else:
        custom_domain = None
    
    # Create tenant
    tenant = Tenant(
        slug=normalized_slug,
        name=payload.name,
        plan="standard",  # Default plan
        is_active=True,
        legal_name=payload.legal_name,
        brand_color=payload.brand_color,
        custom_domain=custom_domain,
    )
    session.add(tenant)
    await session.flush()
    
    # Assign user to tenant as OWNER
    current_user.tenant_id = tenant.id
    current_user.role = UserRole.TENANT_ADMIN.value  # Owner role
    
    logger.info(f"Tenant created via onboarding: {tenant.slug} (ID: {tenant.id}) by user {current_user.email}")
    
    await record_audit(
        session,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="auth.onboarding.tenant_created",
        entity="tenants",
        entity_id=tenant.id,
        meta={"slug": tenant.slug, "name": tenant.name},
    )
    
    await session.commit()
    await session.refresh(tenant)
    
    # Generate redirect URL
    base_domain = settings.frontend_url or "https://kyradi.com"
    # Extract domain without protocol
    if "://" in base_domain:
        protocol, domain = base_domain.split("://", 1)
    else:
        protocol = "https"
        domain = base_domain
    
    # Build subdomain URL
    redirect_url = f"{protocol}://{tenant.slug}.{domain}/app"
    
    return TenantOnboardingResponse(
        message="Otel başarıyla oluşturuldu!",
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        redirect_url=redirect_url,
    )
