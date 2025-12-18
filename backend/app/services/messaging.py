"""Email and SMS messaging services."""

import logging
from typing import Optional
from datetime import datetime
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending transactional emails."""

    @staticmethod
    async def send_password_reset(
        to_email: str,
        reset_token: str,
        reset_url: str,
        locale: str = "tr-TR",
    ) -> bool:
        """Send password reset email with token link."""
        provider = settings.email_provider.lower()
        
        if locale.startswith("tr"):
            subject = "Şifre Sıfırlama Talebi"
            body_html = f"""
            <html>
            <body>
                <h2>Şifre Sıfırlama</h2>
                <p>Merhaba,</p>
                <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
                <p><a href="{reset_url}">{reset_url}</a></p>
                <p>Bu link 30 dakika geçerlidir.</p>
                <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                <p>Saygılarımızla,<br>KYRADİ Ekibi</p>
            </body>
            </html>
            """
            body_text = f"Şifre sıfırlama linki: {reset_url}\n\nBu link 30 dakika geçerlidir."
        else:
            subject = "Password Reset Request"
            body_html = f"""
            <html>
            <body>
                <h2>Password Reset</h2>
                <p>Hello,</p>
                <p>Click the link below to reset your password:</p>
                <p><a href="{reset_url}">{reset_url}</a></p>
                <p>This link is valid for 30 minutes.</p>
                <p>If you did not request this, you can ignore this email.</p>
                <p>Best regards,<br>KYRADİ Team</p>
            </body>
            </html>
            """
            body_text = f"Password reset link: {reset_url}\n\nThis link is valid for 30 minutes."
        
        try:
            if provider == "resend":
                result = await EmailService._send_via_resend(to_email, subject, body_html, body_text)
                logger.info(f"✅ Password reset email sent via Resend to {to_email}")
                return result
            elif provider == "sendgrid":
                result = await EmailService._send_via_sendgrid(to_email, subject, body_html, body_text)
                logger.info(f"Password reset email sent via SendGrid to {to_email}")
                return result
            elif provider == "mailgun":
                result = await EmailService._send_via_mailgun(to_email, subject, body_html, body_text)
                logger.info(f"Password reset email sent via Mailgun to {to_email}")
                return result
            elif provider == "smtp":
                # Check if SMTP is configured before attempting to send
                if not settings.smtp_host or not settings.smtp_user:
                    logger.warning("SMTP configuration incomplete, logging email instead")
                    logger.warning(f"⚠️ EMAIL NOT SENT - SMTP not configured")
                    logger.warning(f"   To fix: Set EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env")
                    logger.info(f"[EMAIL LOG] Password reset for {to_email}: {reset_url}")
                    logger.info(f"[EMAIL LOG] Token: {reset_token}")
                    return True
                result = await EmailService._send_via_smtp(to_email, subject, body_html, body_text)
                logger.info(f"✅ Password reset email sent via SMTP to {to_email}")
                return result
            else:
                # Default: log mode for development
                logger.warning(f"⚠️ EMAIL NOT SENT - Email provider '{provider}' not configured")
                logger.warning(f"   To fix: Set EMAIL_PROVIDER=resend and RESEND_API_KEY in Railway")
                logger.info(f"[EMAIL LOG] Password reset for {to_email}: {reset_url}")
                logger.info(f"[EMAIL LOG] Token: {reset_token}")
                return True
        except Exception as e:
            logger.error(f"Failed to send password reset email to {to_email}: {e}", exc_info=True)
            # In development, don't fail the request if email sending fails
            is_development = settings.environment.lower() in {"local", "dev", "development"}
            if is_development:
                logger.warning(f"Email sending failed, but continuing (development mode): {reset_url}")
                return True  # Return True to not block the password reset flow
            else:
                # In production, re-raise the error
                raise

    @staticmethod
    async def _send_via_resend(to_email: str, subject: str, body_html: str, body_text: str) -> bool:
        """Send email via Resend API (Free: 3000 emails/month)."""
        if not settings.resend_api_key:
            raise ValueError("Resend API key not configured. Set RESEND_API_KEY in environment variables.")
        
        from_email = settings.smtp_from_email or "noreply@kyradi.com"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": body_html,
                    "text": body_text,
                },
            )
            if response.status_code not in (200, 201):
                error_detail = response.text
                logger.error(f"Resend API error: {response.status_code} - {error_detail}")
                raise ValueError(f"Resend API error: {response.status_code}")
            
            result = response.json()
            logger.info(f"✅ Email sent via Resend, id: {result.get('id', 'unknown')}")
            return True

    @staticmethod
    async def _send_via_sendgrid(to_email: str, subject: str, body_html: str, body_text: str) -> bool:
        """Send email via SendGrid API."""
        if not settings.sendgrid_api_key:
            raise ValueError("SendGrid API key not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.sendgrid_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": settings.smtp_from_email or "noreply@kyradi.com"},
                    "subject": subject,
                    "content": [
                        {"type": "text/plain", "value": body_text},
                        {"type": "text/html", "value": body_html},
                    ],
                },
            )
            response.raise_for_status()
            return True

    @staticmethod
    async def _send_via_mailgun(to_email: str, subject: str, body_html: str, body_text: str) -> bool:
        """Send email via Mailgun API."""
        if not settings.mailgun_api_key or not settings.mailgun_domain:
            raise ValueError("Mailgun API key or domain not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.mailgun.net/v3/{settings.mailgun_domain}/messages",
                auth=("api", settings.mailgun_api_key),
                data={
                    "from": settings.smtp_from_email or f"noreply@{settings.mailgun_domain}",
                    "to": to_email,
                    "subject": subject,
                    "text": body_text,
                    "html": body_html,
                },
            )
            response.raise_for_status()
            return True

    @staticmethod
    async def _send_via_smtp(to_email: str, subject: str, body_html: str, body_text: str) -> bool:
        """Send email via SMTP."""
        if not settings.smtp_host or not settings.smtp_user:
            raise ValueError("SMTP configuration incomplete")
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email or settings.smtp_user
        msg["To"] = to_email
        
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        
        # Use async-friendly approach (in production, use aiosmtplib)
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: EmailService._send_smtp_sync(msg, to_email),
        )
        logger.info(f"✅ Email sent successfully via SMTP to {to_email}")
        return True

    @staticmethod
    def _send_smtp_sync(msg: MIMEMultipart, to_email: str) -> None:
        """Synchronous SMTP send."""
        try:
            # Gmail için özel ayarlar - SSL (465) veya TLS (587)
            if settings.smtp_port == 465:
                # SSL kullan (465 portu)
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
                server.set_debuglevel(0)
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
                server.quit()
            else:
                # TLS kullan (587 portu - Gmail için önerilen)
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                    server.set_debuglevel(0)  # Set to 1 for debug output
                    server.starttls()
                    if settings.smtp_user and settings.smtp_password:
                        server.login(settings.smtp_user, settings.smtp_password)
                    server.send_message(msg)
            logger.info(f"✅ Email sent successfully via SMTP to {to_email}")
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ SMTP authentication failed: {e}")
            logger.error("   Gmail kullanıyorsanız, normal şifre yerine 'Uygulama Şifresi' kullanmalısınız!")
            logger.error("   https://myaccount.google.com/apppasswords adresinden oluşturabilirsiniz")
            raise ValueError(f"SMTP authentication failed: {e}") from e
        except smtplib.SMTPException as e:
            logger.error(f"❌ SMTP error: {e}")
            raise ValueError(f"SMTP error: {e}") from e
        except Exception as e:
            logger.error(f"❌ Unexpected SMTP error: {e}", exc_info=True)
            raise

    @staticmethod
    async def send_welcome_email(
        to_email: str,
        temporary_password: Optional[str],
        locale: str = "tr-TR",
    ) -> bool:
        """Send welcome email with temporary password if provided."""
        provider = settings.email_provider.lower()
        
        if locale.startswith("tr"):
            subject = "KYRADİ'ye Hoş Geldiniz"
            password_html = f"<p>Geçici şifreniz: <strong>{temporary_password}</strong></p>" if temporary_password else ""
            body_html = f"""
            <html>
            <body>
                <h2>Hoş Geldiniz!</h2>
                <p>KYRADİ platformuna kaydınız tamamlandı.</p>
                {password_html}
                <p>Lütfen ilk girişinizde şifrenizi değiştirin.</p>
                <p>Saygılarımızla,<br>KYRADİ Ekibi</p>
            </body>
            </html>
            """
            if temporary_password:
                body_text = (
                    "KYRADİ platformuna hoş geldiniz!\n\n"
                    f"Geçici şifreniz: {temporary_password}\n\n"
                    "Lütfen ilk girişinizde şifrenizi değiştirin."
                )
            else:
                body_text = (
                    "KYRADİ platformuna hoş geldiniz!\n\n"
                    "Lütfen ilk girişinizde şifrenizi değiştirin."
                )
        else:
            subject = "Welcome to KYRADİ"
            password_html = f"<p>Your temporary password: <strong>{temporary_password}</strong></p>" if temporary_password else ""
            body_html = f"""
            <html>
            <body>
                <h2>Welcome!</h2>
                <p>Your KYRADİ platform registration is complete.</p>
                {password_html}
                <p>Please change your password on first login.</p>
                <p>Best regards,<br>KYRADİ Team</p>
            </body>
            </html>
            """
            if temporary_password:
                body_text = (
                    "Welcome to KYRADİ platform!\n\n"
                    f"Your temporary password: {temporary_password}\n\n"
                    "Please change your password on first login."
                )
            else:
                body_text = (
                    "Welcome to KYRADİ platform!\n\n"
                    "Please change your password on first login."
                )
        
        try:
            if provider == "resend":
                result = await EmailService._send_via_resend(to_email, subject, body_html, body_text)
                logger.info(f"✅ Welcome email sent via Resend to {to_email}")
                return result
            elif provider == "sendgrid":
                return await EmailService._send_via_sendgrid(to_email, subject, body_html, body_text)
            elif provider == "mailgun":
                return await EmailService._send_via_mailgun(to_email, subject, body_html, body_text)
            elif provider == "smtp":
                # Check if SMTP is configured before attempting to send
                if not settings.smtp_host or not settings.smtp_user:
                    logger.warning("SMTP configuration incomplete, falling back to log mode")
                    logger.info(f"[EMAIL] Welcome email to {to_email}")
                    if temporary_password:
                        logger.info(f"[EMAIL] Temporary password: {temporary_password}")
                    return True
                return await EmailService._send_via_smtp(to_email, subject, body_html, body_text)
            else:
                # Default: log mode for development
                logger.info(f"[EMAIL] Welcome email to {to_email}")
                if temporary_password:
                    logger.info(f"[EMAIL] Temporary password: {temporary_password}")
                return True
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}", exc_info=True)
            # In development, don't fail the request if email sending fails
            logger.warning(f"Email sending failed, but continuing (development mode)")
            return True  # Return True to not block the user creation flow


class SMSService:
    """SMS service for sending verification codes."""

    @staticmethod
    async def send_verification_code(
        to_phone: str,
        code: str,
        locale: str = "tr-TR",
    ) -> bool:
        """Send SMS verification code."""
        provider = settings.sms_provider.lower()
        
        if locale.startswith("tr"):
            message = f"KYRADİ doğrulama kodunuz: {code}. Bu kodu kimseyle paylaşmayın."
        else:
            message = f"KYRADİ verification code: {code}. Do not share this code."
        
        try:
            if provider == "iletimerkezi":
                result = await SMSService._send_via_iletimerkezi(to_phone, message)
                logger.info(f"Verification SMS sent via İleti Merkezi to {to_phone}")
                return result
            elif provider == "twilio":
                result = await SMSService._send_via_twilio(to_phone, message)
                logger.info(f"Verification SMS sent via Twilio to {to_phone}")
                return result
            else:
                # Development mode - show code in console
                logger.warning(f"⚠️ SMS NOT SENT - SMS provider '{provider}' not configured")
                logger.info("")
                logger.info("=" * 70)
                logger.info("📱 SMS DOĞRULAMA KODU (TEST MODU - TERMINAL)")
                logger.info("=" * 70)
                logger.info(f"📞 Telefon Numarası: {to_phone}")
                logger.info(f"🔐 Doğrulama Kodu: {code}")
                logger.info(f"⏰ Geçerlilik: 10 dakika")
                logger.info("=" * 70)
                logger.info("")
                return True
        except Exception as e:
            logger.error(f"Failed to send verification SMS to {to_phone}: {e}", exc_info=True)
            # In development, don't fail the request
            is_development = settings.environment.lower() in {"local", "dev", "development"}
            if is_development:
                logger.warning(f"SMS sending failed, but continuing (development mode)")
                return True
            return False

    @staticmethod
    async def _send_via_iletimerkezi(to_phone: str, message: str) -> bool:
        """Send SMS via İleti Merkezi API."""
        if not settings.iletimerkezi_username or not settings.iletimerkezi_password:
            raise ValueError("İleti Merkezi credentials not configured")
        
        # İleti Merkezi API v1 format
        # Telefon numarasını temizle (başında + varsa kaldır, sadece rakamlar)
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        if not clean_phone.startswith("90") and len(clean_phone) == 10:
            clean_phone = "90" + clean_phone
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # İleti Merkezi API format - numbers array olarak gönderilmeli
                payload = {
                    "username": settings.iletimerkezi_username,
                    "password": settings.iletimerkezi_password,
                    "messages": [
                        {
                            "numbers": [clean_phone],  # Array olarak gönder
                            "msg": message,
                        }
                    ],
                }
                logger.debug(f"İleti Merkezi payload (username hidden): {{'username': '***', 'password': '***', 'messages': [{{'numbers': ['{clean_phone}'], 'msg': '...'}}]}}")
                
                response = await client.post(
                    "https://api.iletimerkezi.com/v1/send-sms",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                # İleti Merkezi response kontrolü
                result_text = response.text
                logger.debug(f"İleti Merkezi response: {result_text}")
                
                # XML response parse et
                if result_text.startswith("<?xml"):
                    import xml.etree.ElementTree as ET
                    try:
                        root = ET.fromstring(result_text)
                        status_code = root.find(".//code")
                        status_message = root.find(".//message")
                        
                        if status_code is not None:
                            code = status_code.text
                            message_text = status_message.text if status_message is not None else "Unknown"
                            
                            if code == "200":
                                logger.info(f"✅ SMS sent successfully to {clean_phone}")
                                return True
                            else:
                                logger.error(f"❌ İleti Merkezi error: {code} - {message_text}")
                                raise ValueError(f"İleti Merkezi error: {code} - {message_text}")
                        else:
                            # XML formatı farklı olabilir, başarılı sayalım
                            logger.info(f"✅ SMS sent to {clean_phone} (XML response)")
                            return True
                    except ET.ParseError:
                        logger.warning(f"XML parse error, assuming success: {result_text[:100]}")
                        return True
                else:
                    # JSON response
                    try:
                        result = response.json()
                        if isinstance(result, dict):
                            status = result.get("status", {})
                            if isinstance(status, dict) and status.get("code") == 200:
                                logger.info(f"✅ SMS sent successfully to {clean_phone}")
                                return True
                            elif isinstance(status, int) and status == 200:
                                logger.info(f"✅ SMS sent successfully to {clean_phone}")
                                return True
                            else:
                                error_msg = result.get("status", {}).get("message", "Unknown error")
                                logger.error(f"❌ İleti Merkezi error: {error_msg}")
                                raise ValueError(f"İleti Merkezi error: {error_msg}")
                        else:
                            logger.info(f"✅ SMS sent to {clean_phone}, response: {result}")
                            return True
                    except Exception:
                        # Response formatı beklenmedik, ama 200 ise başarılı sayalım
                        if response.status_code == 200:
                            logger.info(f"✅ SMS sent to {clean_phone} (status 200)")
                            return True
                        response.raise_for_status()
            except httpx.HTTPStatusError as e:
                logger.error(f"İleti Merkezi HTTP error: {e.response.status_code} - {e.response.text}")
                raise ValueError(f"İleti Merkezi HTTP error: {e.response.status_code}") from e
            except Exception as e:
                logger.error(f"İleti Merkezi request failed: {e}", exc_info=True)
                raise

    @staticmethod
    async def _send_via_twilio(to_phone: str, message: str) -> bool:
        """Send SMS via Twilio API (Free Trial available)."""
        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            raise ValueError("Twilio credentials not configured")
        
        if not settings.twilio_from_number:
            raise ValueError("Twilio from number not configured")
        
        # Account SID kontrolü
        if settings.twilio_account_sid.startswith("SK"):
            logger.warning("⚠️ TWILIO_ACCOUNT_SID 'SK' ile başlıyor - Bu bir API Key olabilir!")
            logger.warning("   Account SID 'AC' ile başlamalı. Twilio Console > Account > API Credentials'dan kontrol edin.")
        
        # Telefon numarasını temizle ve formatla
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        # Eğer Türkiye numarası ise +90 ekle
        if clean_phone.startswith("90") and not clean_phone.startswith("+90"):
            clean_phone = "+" + clean_phone
        elif not clean_phone.startswith("+") and len(clean_phone) == 10:
            clean_phone = "+90" + clean_phone
        elif not clean_phone.startswith("+"):
            clean_phone = "+" + clean_phone
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                    data={
                        "From": settings.twilio_from_number,
                        "To": clean_phone,
                        "Body": message,
                    },
                )
                response.raise_for_status()
                result = response.json()
                logger.info(f"✅ SMS sent successfully via Twilio to {clean_phone}")
                logger.debug(f"Twilio response: {result.get('sid', 'N/A')}")
                return True
            except httpx.HTTPStatusError as e:
                error_detail = e.response.text if e.response else "Unknown error"
                try:
                    error_json = e.response.json() if e.response else {}
                    error_code = error_json.get("code", "")
                    error_message = error_json.get("message", error_detail)
                    
                    # Özel hata mesajları
                    if error_code == 21266:
                        logger.error(f"❌ Twilio Error: 'To' and 'From' numbers cannot be the same!")
                        logger.error(f"   From: {settings.twilio_from_number}")
                        logger.error(f"   To: {clean_phone}")
                        logger.error(f"   Çözüm: TWILIO_FROM_NUMBER Twilio'dan aldığınız numara olmalı (örn: +1 555 123 4567)")
                        raise ValueError(f"Twilio Error: From ve To numaraları aynı olamaz. TWILIO_FROM_NUMBER Twilio'dan aldığınız numara olmalı.") from e
                    elif error_code == 21408:
                        logger.error(f"❌ Twilio Error: Türkiye'ye SMS gönderme izni yok!")
                        logger.error(f"   Twilio Free Trial Türkiye'ye SMS gönderemez.")
                        logger.error(f"   Çözüm 1: Development moduna geçin (SMS_PROVIDER=mock)")
                        logger.error(f"   Çözüm 2: Twilio ücretli plana geçin ve Türkiye izni alın")
                        logger.error(f"   Çözüm 3: Türkiye'ye özel SMS servisi kullanın (Netgsm, İleti Merkezi)")
                        # Development modunda devam et
                        is_development = settings.environment.lower() in {"local", "dev", "development"}
                        if is_development:
                            logger.warning(f"⚠️ Development modunda devam ediliyor - SMS gönderilmedi")
                            return False
                        raise ValueError(f"Twilio Error: Türkiye'ye SMS gönderme izni yok. Free Trial'da sadece ABD/İngiltere gibi ülkelere SMS gönderebilirsiniz.") from e
                    else:
                        logger.error(f"❌ Twilio HTTP error: {e.response.status_code} - {error_message}")
                        raise ValueError(f"Twilio error: {error_message}") from e
                except Exception:
                    logger.error(f"❌ Twilio HTTP error: {e.response.status_code} - {error_detail}")
                    raise ValueError(f"Twilio HTTP error: {e.response.status_code}") from e
            except Exception as e:
                logger.error(f"❌ Twilio request failed: {e}", exc_info=True)
                raise

    @staticmethod
    async def send_password_reset_code(
        to_phone: str,
        code: str,
        locale: str = "tr-TR",
    ) -> bool:
        """Send password reset verification code via SMS."""
        provider = settings.sms_provider.lower()
        
        if locale.startswith("tr"):
            message = f"KYRADİ şifre sıfırlama kodunuz: {code}. Bu kodu kimseyle paylaşmayın. Kod 15 dakika geçerlidir."
        else:
            message = f"KYRADİ password reset code: {code}. Do not share this code. Code is valid for 15 minutes."
        
        try:
            if provider == "twilio":
                result = await SMSService._send_via_twilio(to_phone, message)
                logger.info(f"Password reset SMS sent via Twilio to {to_phone}")
                return result
            elif provider == "iletimerkezi":
                result = await SMSService._send_via_iletimerkezi(to_phone, message)
                logger.info(f"Password reset SMS sent via İleti Merkezi to {to_phone}")
                return result
            else:
                # Development mode - show code in console
                logger.warning(f"⚠️ SMS NOT SENT - SMS provider '{provider}' not configured")
                logger.info("")
                logger.info("=" * 70)
                logger.info("📱 SMS ŞİFRE SIFIRLAMA KODU (TEST MODU - TERMINAL)")
                logger.info("=" * 70)
                logger.info(f"📞 Telefon Numarası: {to_phone}")
                logger.info(f"🔐 Şifre Sıfırlama Kodu: {code}")
                logger.info(f"⏰ Geçerlilik: 15 dakika")
                logger.info("=" * 70)
                logger.info("")
                return True
        except Exception as e:
            logger.error(f"Failed to send password reset SMS to {to_phone}: {e}", exc_info=True)
            is_development = settings.environment.lower() in {"local", "dev", "development"}
            if is_development:
                logger.warning(f"SMS sending failed, but continuing (development mode)")
                return True
            return False

    @staticmethod
    async def send_login_verification_code(
        to_phone: str,
        code: str,
        locale: str = "tr-TR",
    ) -> bool:
        """Send login verification code via SMS (for first login after password reset)."""
        provider = settings.sms_provider.lower()
        
        if locale.startswith("tr"):
            message = f"KYRADİ giriş doğrulama kodunuz: {code}. Bu kodu kimseyle paylaşmayın. Kod 10 dakika geçerlidir."
        else:
            message = f"KYRADİ login verification code: {code}. Do not share this code. Code is valid for 10 minutes."
        
        try:
            if provider == "twilio":
                result = await SMSService._send_via_twilio(to_phone, message)
                logger.info(f"Login verification SMS sent via Twilio to {to_phone}")
                return result
            elif provider == "iletimerkezi":
                result = await SMSService._send_via_iletimerkezi(to_phone, message)
                logger.info(f"Login verification SMS sent via İleti Merkezi to {to_phone}")
                return result
            else:
                # Development mode - show code in console
                logger.warning(f"⚠️ SMS NOT SENT - SMS provider '{provider}' not configured")
                logger.info("")
                logger.info("=" * 70)
                logger.info("📱 SMS GİRİŞ DOĞRULAMA KODU (TEST MODU - TERMINAL)")
                logger.info("=" * 70)
                logger.info(f"📞 Telefon Numarası: {to_phone}")
                logger.info(f"🔐 Giriş Doğrulama Kodu: {code}")
                logger.info(f"⏰ Geçerlilik: 10 dakika")
                logger.info("=" * 70)
                logger.info("")
                return True
        except Exception as e:
            logger.error(f"Failed to send login verification SMS to {to_phone}: {e}", exc_info=True)
            is_development = settings.environment.lower() in {"local", "dev", "development"}
            if is_development:
                logger.warning(f"SMS sending failed, but continuing (development mode)")
                return True
            return False


    @staticmethod
    async def send_bulk_email(
        recipients: list[str],
        subject: str,
        body: str,
        is_html: bool = False,
    ) -> dict:
        """Send bulk email to multiple recipients.
        
        Returns dict with success count, failed count, and failed emails.
        """
        provider = settings.email_provider.lower()
        success_count = 0
        failed_count = 0
        failed_emails = []
        
        body_html = body if is_html else f"<pre style='font-family: inherit; white-space: pre-wrap;'>{body}</pre>"
        body_text = body if not is_html else body.replace("<br>", "\n").replace("</p>", "\n")
        
        for email in recipients:
            try:
                if provider == "resend":
                    await EmailService._send_via_resend(email, subject, body_html, body_text)
                elif provider == "sendgrid":
                    await EmailService._send_via_sendgrid(email, subject, body_html, body_text)
                elif provider == "mailgun":
                    await EmailService._send_via_mailgun(email, subject, body_html, body_text)
                elif provider == "smtp":
                    if settings.smtp_host and settings.smtp_user:
                        await EmailService._send_via_smtp(email, subject, body_html, body_text)
                    else:
                        logger.info(f"[EMAIL LOG] Bulk email to {email}: {subject}")
                else:
                    logger.info(f"[EMAIL LOG] Bulk email to {email}: {subject}")
                
                success_count += 1
                logger.info(f"✅ Email sent to {email}")
            except Exception as e:
                failed_count += 1
                failed_emails.append(email)
                logger.error(f"❌ Failed to send email to {email}: {e}")
        
        return {
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_emails": failed_emails,
        }


# Global instances
email_service = EmailService()
sms_service = SMSService()
