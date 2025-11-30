# Twilio Ücretsiz SMS Servisi Kurulumu

## Twilio Free Trial (Önerilen - Ücretsiz)

Twilio ücretsiz trial hesabı ile günde 1 SMS gönderebilirsiniz (test için yeterli).

### Adımlar:

1. **Twilio Hesabı Oluşturun:**
   - https://www.twilio.com/try-twilio adresine gidin
   - Ücretsiz hesap oluşturun (kredi kartı gerekmez)
   - Telefon numaranızı doğrulayın

2. **Trial Numarası Alın:**
   - Twilio Console > Phone Numbers > Get a number
   - Ücretsiz trial numarası alın (örn: +1 555 123 4567)

3. **API Bilgilerini Alın:**
   - Twilio Console > Account > API Credentials
   - Account SID ve Auth Token'ı kopyalayın

4. **.env Dosyasını Güncelleyin:**

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15551234567  # Twilio'dan aldığınız numara
```

### Twilio Free Trial Limitleri:
- Günde 1 SMS (test için yeterli)
- Trial numarası ile sadece doğrulanmış numaralara SMS gönderebilirsiniz
- Production için ücretli plana geçmeniz gerekir

### Test Numarası Doğrulama:
Twilio Console > Phone Numbers > Verified Caller IDs
Buraya test için kullanacağınız telefon numarasını ekleyin.

