# Twilio Kurulumu - Adım Adım (Görsel Rehber)

## ⚠️ ÖNEMLİ: İki Bilgi Gerekli

1. **Account SID** (AC ile başlar) - Şu an SK var, yanlış!
2. **Twilio Phone Number** (From numarası) - Şu an kendi numaranız var, yanlış!

## 📸 Adım Adım:

### 1. Twilio Console'a Giriş
- https://console.twilio.com adresine gidin
- Giriş yapın

### 2. Account SID Bulma
- Sol menüden **Account** > **API Credentials** seçin
- **Account SID** satırını bulun (AC ile başlar, örn: `ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- Bu değeri kopyalayın

### 3. Phone Number Alma
- Sol menüden **Phone Numbers** > **Manage** > **Get a number** seçin
- **Get a number** butonuna tıklayın
- Ücretsiz trial numarası alın (ABD numarası olacak, örn: `+1 555 123 4567`)
- Bu numarayı kopyalayın

### 4. Test Numarasını Doğrulama
- Sol menüden **Phone Numbers** > **Verified Caller IDs** seçin
- **Add a new Caller ID** butonuna tıklayın
- `+905452196863` numaranızı ekleyin
- SMS ile doğrulayın

### 5. .env Güncelleme

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6  # AC ile başlamalı!
TWILIO_AUTH_TOKEN=92cc3ad0dbf258b8bbbf270d5fe01cec  # Bu doğru
TWILIO_FROM_NUMBER=+15551234567  # Twilio'dan aldığınız numara (ABD numarası)
```

## 🔄 Alternatif: Development Modu (Twilio Olmadan)

Eğer Twilio kurulumu zorsa, development modunda çalıştırabilirsiniz:

```bash
SMS_PROVIDER=mock
```

Bu durumda SMS gönderilmez, kodlar backend console'da görünür.

