# Hızlı SMS Kurulumu - Twilio (Ücretsiz)

## 5 Dakikada Kurulum

### 1. Twilio Hesabı Oluştur (2 dakika)
- https://www.twilio.com/try-twilio
- Email ile kayıt ol (kredi kartı GEREKMEZ)
- Telefon numaranı doğrula

### 2. Trial Numarası Al (1 dakika)
- Twilio Console > Phone Numbers > Get a number
- "Get a number" butonuna tıkla
- Ücretsiz numara al (örn: +1 555 123 4567)

### 3. API Bilgilerini Kopyala (1 dakika)
- Twilio Console > Account > API Credentials
- Account SID: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Auth Token: `your_auth_token_here`

### 4. .env Dosyasını Güncelle (1 dakika)

```bash
cd backend
nano .env  # veya vi .env
```

Şu satırları ekle/güncelle:

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15551234567
```

### 5. Test Numarasını Doğrula (Twilio Console)
- Twilio Console > Phone Numbers > Verified Caller IDs
- Test için kullanacağınız telefon numarasını ekle
- SMS almak için bu numarayı doğrulamanız gerekir

### 6. Backend'i Yeniden Başlat

```bash
cd backend
poetry run uvicorn app.main:app --reload
```

## ✅ Hazır!

Artık SMS gönderebilirsiniz. Twilio free trial ile:
- Günde 1 SMS gönderebilirsiniz
- Sadece doğrulanmış numaralara SMS gönderebilirsiniz
- Test için yeterli!

## Sorun mu var?

SMS gelmiyorsa:
1. Twilio Console > Logs > Debugger'ı kontrol edin
2. Telefon numarasının doğrulandığından emin olun
3. Backend console'da hata mesajlarını kontrol edin

