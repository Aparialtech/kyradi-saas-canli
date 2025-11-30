# Email ve SMS Servisi Kurulum Rehberi

## Email Servisi Kurulumu

### Seçenek 1: Gmail SMTP (Önerilen - Ücretsiz)

1. Gmail hesabınızda "2 Adımlı Doğrulama"yı açın
2. "Uygulama Şifreleri" bölümünden yeni bir uygulama şifresi oluşturun
3. `.env` dosyasına ekleyin:

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-digit-app-password
SMTP_FROM_EMAIL=noreply@kyradi.com
```

### Seçenek 2: SendGrid

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@kyradi.com
```

### Seçenek 3: Mailgun

```bash
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

## SMS Servisi Kurulumu

### Seçenek 1: İleti Merkezi (Türkiye - Önerilen)

1. https://www.iletimerkezi.com adresinden hesap oluşturun
2. API kullanıcı adı ve şifrenizi alın
3. `.env` dosyasına ekleyin:

```bash
SMS_PROVIDER=iletimerkezi
ILETIMERKEZI_USERNAME=your-username
ILETIMERKEZI_PASSWORD=your-password
```

### Seçenek 2: Twilio

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

## Test Etme

Backend'i yeniden başlatın ve şifre sıfırlama işlemini test edin.

