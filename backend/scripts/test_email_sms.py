#!/usr/bin/env python3
"""Test script for email and SMS services."""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.messaging import email_service, sms_service
from app.core.config import settings


async def test_email():
    """Test email service."""
    print("\n=== Email Service Test ===")
    print(f"Provider: {settings.email_provider}")
    
    test_email = input("Test email adresi girin: ").strip()
    if not test_email:
        print("Email adresi gerekli!")
        return
    
    try:
        result = await email_service.send_password_reset(
            to_email=test_email,
            reset_token="test-token-12345",
            reset_url="http://localhost:5173/reset-password?token=test-token-12345",
            locale="tr-TR",
        )
        if result:
            print(f"✅ Email başarıyla gönderildi: {test_email}")
        else:
            print(f"❌ Email gönderilemedi: {test_email}")
    except Exception as e:
        print(f"❌ Email gönderme hatası: {e}")


async def test_sms():
    """Test SMS service."""
    print("\n=== SMS Service Test ===")
    print(f"Provider: {settings.sms_provider}")
    
    test_phone = input("Test telefon numarası girin (örn: 905551234567): ").strip()
    if not test_phone:
        print("Telefon numarası gerekli!")
        return
    
    test_code = "123456"
    
    try:
        result = await sms_service.send_login_verification_code(
            to_phone=test_phone,
            code=test_code,
            locale="tr-TR",
        )
        if result:
            print(f"✅ SMS başarıyla gönderildi: {test_phone}")
            print(f"   Kod: {test_code}")
        else:
            print(f"❌ SMS gönderilemedi: {test_phone}")
    except Exception as e:
        print(f"❌ SMS gönderme hatası: {e}")


async def main():
    """Main test function."""
    print("=" * 50)
    print("Email ve SMS Servisi Test Aracı")
    print("=" * 50)
    
    print("\nMevcut Konfigürasyon:")
    print(f"  Email Provider: {settings.email_provider}")
    print(f"  SMS Provider: {settings.sms_provider}")
    
    choice = input("\n1. Email Test\n2. SMS Test\n3. Her İkisi\nSeçim (1/2/3): ").strip()
    
    if choice == "1":
        await test_email()
    elif choice == "2":
        await test_sms()
    elif choice == "3":
        await test_email()
        await test_sms()
    else:
        print("Geçersiz seçim!")


if __name__ == "__main__":
    asyncio.run(main())

