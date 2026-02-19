#!/usr/bin/env python3
"""Test email gönderme scripti."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.messaging import EmailService
from app.core.config import settings


async def test_email():
    """Test email gönder."""
    print("=" * 60)
    print("EMAIL SERVİSİ TEST")
    print("=" * 60)
    print(f"\nMevcut Konfigürasyon:")
    print(f"  Provider: {settings.email_provider}")
    print(f"  SMTP Host: {settings.smtp_host}")
    print(f"  SMTP User: {settings.smtp_user}")
    print(f"  SMTP From: {settings.smtp_from_email}")
    print(f"  Frontend URL: {settings.frontend_url}")
    
    if settings.email_provider.lower() == "log":
        print("\n⚠️  UYARI: Email provider 'log' modunda!")
        print("   Email gönderilmeyecek, sadece log'a yazılacak.")
        print("\n   Çözüm: .env dosyasına şunları ekleyin:")
        print("   EMAIL_PROVIDER=smtp")
        print("   SMTP_HOST=smtp.gmail.com")
        print("   SMTP_PORT=587")
        print("   SMTP_USER=your-email@gmail.com")
        print("   SMTP_PASSWORD=your-app-password")
        print("   SMTP_FROM_EMAIL=noreply@kyradi.com")
        print("   FRONTEND_URL=http://localhost:5173")
    
    test_email = input("\nTest email adresi girin (doguncu13@gmail.com): ").strip()
    if not test_email:
        test_email = "doguncu13@gmail.com"
    
    test_token = "test-token-12345"
    test_url = f"{settings.frontend_url or 'http://localhost:5173'}/reset-password?token={test_token}"
    
    print(f"\n📧 Email gönderiliyor: {test_email}")
    print(f"   Reset URL: {test_url}")
    
    try:
        result = await EmailService.send_password_reset(
            to_email=test_email,
            reset_token=test_token,
            reset_url=test_url,
            locale="tr-TR",
        )
        
        if result:
            print(f"\n✅ Email başarıyla gönderildi!")
            if settings.email_provider.lower() == "log":
                print(f"   (Log modunda - gerçek email gönderilmedi)")
        else:
            print(f"\n❌ Email gönderilemedi")
    except Exception as e:
        print(f"\n❌ HATA: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_email())

