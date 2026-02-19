# Hızlı Email ve SMS Kurulumu

## 1. Email Servisi (Gmail SMTP - En Kolay)

### Adımlar:
1. Gmail hesabınızda **2 Adımlı Doğrulama** açın
2. **Uygulama Şifreleri** bölümünden yeni şifre oluşturun
3. Backend klasöründe `.env` dosyası oluşturun veya düzenleyin:

```bash
# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-digit-app-password
SMTP_FROM_EMAIL=noreply@kyradi.com
```

## 2. SMS Servisi (İleti Merkezi)

### Adımlar:
1. https://www.iletimerkezi.com adresinden hesap oluşturun
2. API kullanıcı adı ve şifrenizi alın
3. `.env` dosyasına ekleyin:

```bash
# SMS Configuration
SMS_PROVIDER=iletimerkezi
ILETIMERKEZI_USERNAME=your-username
ILETIMERKEZI_PASSWORD=your-password
```

## 3. Kullanıcıya Telefon Numarası Ekleme

Test için kullanıcıya telefon numarası ekleyin:

```bash
cd backend
poetry run python -c "
import asyncio
from app.db.session import get_session
from app.models import User
from sqlalchemy import select

async def add_phone():
    async for session in get_session():
        stmt = select(User).where(User.email == 'doguncu13@gmail.com')
        user = (await session.execute(stmt)).scalar_one_or_none()
        if user:
            user.phone_number = '905551234567'  # Örnek numara
            await session.commit()
            print(f'Telefon numarası eklendi: {user.phone_number}')
        break

asyncio.run(add_phone())
"
```

## 4. Test Etme

```bash
# Email test
cd backend
poetry run python scripts/test_email_sms.py
```

## 5. Backend'i Yeniden Başlatın

```bash
cd backend
poetry run uvicorn app.main:app --reload
```

## Notlar

- Gmail için **Uygulama Şifresi** kullanmanız gerekiyor (normal şifre çalışmaz)
- İleti Merkezi için telefon numarası formatı: `905551234567` (90 + 10 haneli numara)
- Development modunda email/SMS gönderilemezse console'da log görünecektir

