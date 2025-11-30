# Email Gönderme Sorunu Düzeltme Talimatları

## Sorun
Email servisi şu anda "log" modunda çalışıyor, bu yüzden email'ler gönderilmiyor, sadece console'da log'a yazılıyor.

## Çözüm

### 1. .env Dosyasına Email Ayarlarını Ekleyin

Backend klasöründeki `.env` dosyanıza aşağıdaki satırları ekleyin:

```bash
# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-digit-app-password
SMTP_FROM_EMAIL=noreply@kyradi.com

# Frontend URL (Email linklerinde kullanılacak)
FRONTEND_URL=http://localhost:5173
```

### 2. Gmail için Uygulama Şifresi Oluşturun

1. Gmail hesabınızda **2 Adımlı Doğrulama** açın
2. **Uygulama Şifreleri** bölümüne gidin
3. Yeni bir uygulama şifresi oluşturun (16 haneli)
4. Bu şifreyi `.env` dosyasındaki `SMTP_PASSWORD` olarak kullanın

### 3. Backend'i Yeniden Başlatın

```bash
cd backend
poetry run uvicorn app.main:app --reload
```

### 4. Test Edin

1. Login sayfasında "Şifremi Unuttum" butonuna tıklayın
2. Email adresinizi girin (doguncu13@gmail.com)
3. Email adresinize şifre sıfırlama linki gelecek

## Alternatif: SendGrid veya Mailgun

Gmail yerine SendGrid veya Mailgun kullanmak isterseniz:

### SendGrid:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@kyradi.com
FRONTEND_URL=http://localhost:5173
```

### Mailgun:
```bash
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
SMTP_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=http://localhost:5173
```

## Notlar

- Gmail için **normal şifre çalışmaz**, mutlaka **Uygulama Şifresi** kullanmalısınız
- Development modunda email gönderilemezse, console'da log görünecektir
- Email gönderilmezse backend log'larını kontrol edin: `tail -f logs/*.log`

