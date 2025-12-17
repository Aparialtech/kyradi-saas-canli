# Twilio Hata Düzeltme Rehberi

## ❌ Hata: "To and From number cannot be the same"

### Sorun:
TWILIO_FROM_NUMBER ve gönderilecek numara aynı. Twilio'da From numarası Twilio'dan aldığınız numara olmalı.

### Çözüm:

1. **Twilio Console'dan Numara Alın:**
   - Twilio Console > Phone Numbers > Get a number
   - Ücretsiz trial numarası alın (örn: +1 555 123 4567)
   - Bu numara ABD numarası olacak (trial için normal)

2. **.env Dosyasını Güncelleyin:**
   ```bash
   TWILIO_FROM_NUMBER=+15551234567  # Twilio'dan aldığınız numara
   ```

3. **Test Numarasını Doğrulayın:**
   - Twilio Console > Phone Numbers > Verified Caller IDs
   - SMS almak istediğiniz numarayı ekleyin (örn: +905452196863)
   - Bu numaraya SMS gönderebilirsiniz

## ❌ Hata: Account SID 'SK' ile başlıyor

### Sorun:
TWILIO_ACCOUNT_SID değeri 'SK' ile başlıyor. Bu bir API Key, Account SID değil.

### Çözüm:

1. **Twilio Console'dan Doğru Account SID Alın:**
   - Twilio Console > Account > API Credentials
   - **Account SID** (AC ile başlar) - Bu olmalı
   - **Auth Token** (zaten doğru)

2. **.env Dosyasını Güncelleyin:**
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # AC ile başlamalı
   ```

## ✅ Doğru Konfigürasyon:

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # AC ile başlar
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15551234567  # Twilio'dan aldığınız numara (ABD numarası)
```

## 📱 Test İçin:

1. Twilio Console > Verified Caller IDs'ye test numaranızı ekleyin
2. Backend'i restart edin
3. SMS göndermeyi deneyin

