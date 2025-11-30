# KYRADİ Rezervasyon Widget'ı Gömme Rehberi / Embed Guide

## 1. Genel Bakış
KYRADİ rezervasyon formu otellerin kendi sitelerine gömebileceği, çok kiracılı güvenlik kontrolleri içeren bir web bileşenidir. Form, KYRADİ SaaS backend'ine doğrudan bağlanır ve tüm rezervasyonlar **widget** kaynağı ile işaretlenir.

## 2. Hızlı Başlangıç / Quick Start
```html
<script
  src="https://cdn.example.com/widgets/kyradi-reserve.js"
  data-tenant-id="TENANT_ID"
  data-widget-key="WIDGET_PUBLIC_KEY"
  data-api-base="https://api.example.com"
  data-locale="tr-TR"
  data-theme="light"
  data-hcaptcha-sitekey="HCAPTCHA_SITE_KEY"
  defer></script>
<kyradi-reserve></kyradi-reserve>
```

- **data-tenant-id**: KYRADİ tenant UUID.
- **data-widget-key**: Yönetim panelinde oluşturulan public key.
- **data-api-base**: Backend URL (örn. `https://api.kyradi.com`).
- **data-locale**: `tr-TR` veya `en-US`.
- **data-theme**: `light` veya `dark`.
- **data-hcaptcha-sitekey**: Opsiyonel; anti-bot için Turnstile/hCaptcha kullanılacaksa doldurun.

Script yüklendiğinde `window.KyradiReserve.mount()` otomatik çağrılır. Ek olarak `window.KyradiReserve.config` üzerinden varsayılan değerler güncellenebilir.

## 3. Tenant Konfigürasyonu / Provisioning
1. **Admin veya partner panelinden** her otel için `Widget Konfigürasyonu` kaydı açın. Zorunlu alanlar:
   - `tenant_id`, `widget_public_key`, `widget_secret`
   - `allowed_origins` (tam domain listesi)
   - `default_locale`, `default_theme`
   - `kvkk_text` ve bildirim tercihleri (e-posta/SMS)
2. CLI üzerinden seed gerekiyorsa: `cd backend && poetry run python -m app.db.utils` komutu eksik tabloları ve örnek konfigleri oluşturur.
3. Konfigürasyon kaydı olmadan widget token üretilmez; embed işlemi başlamadan önce her tenant için bu adımı tamamlayın.

## 4. Allowed Origins
Her tenant için yönetim panelinden (veya API) `widget_config` kaydı oluşturulmalıdır:
- `allowed_origins`: `https://otel.com`, `https://booking.otel.com` gibi tam origin listesi.
- Widget `init` çağrısı sadece bu origin'lerden yapılabilir.
- Origin uyuşmazsa `/public/widget/init` 403 döndürür.

## 5. KVKK / GDPR Onayı
Konfigürasyon sırasında özel KVKK/GDPR metni girilebilir. Kullanıcı onay kutusunu işaretlemeden form gönderemez; backend `kvkk_approved=false` durumunda 422 hata döndürür.

Örnek KVKK Metni (TR):
> “6698 sayılı KVKK uyarınca kişisel verilerimin KYRADİ tarafından saklanmasını ve rezervasyon sürecinde paylaşılmasını onaylıyorum.”

Sample GDPR Consent (EN):
> “I consent to KYRADİ storing my personal data for the purpose of managing my reservation.”

KVKK metnini partner panelinden güncellediğinizde widget otomatik olarak yeni metni gösterir.

## 6. Anti-bot Koruması
- `WIDGET_HCAPTCHA_ENABLED=true` ve `HCAPTCHA_SECRET` tanımlandığında widget `captcha_token` göndermek zorundadır.
- `<script data-hcaptcha-sitekey="...">` parametresi ile otomatik render edilir.
- Backend `https://hcaptcha.com/siteverify` servisi üzerinden token doğrular.

## 7. Webhook & İmza Doğrulama
Tenant için webhook URL tanımlandığında rezervasyon oluşturma anında `POST` çağrısı yapılır:
- Header: `X-Kyradi-Signature: HMAC_SHA256(body, WEBHOOK_SIGNATURE_SECRET)`
- Gövde örneği:
```json
{
  "id": 123,
  "event": "reservation.created",
  "tenant_id": "tenant-uuid",
  "status": "pending",
  "guest": {
    "name": "Ali Veli",
    "email": "ali@example.com"
  }
}
```

**Node.js doğrulama örneği**
```js
import crypto from "node:crypto";

function verifySignature(body, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**Python doğrulama örneği**
```python
import hmac
import hashlib

def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## 8. Çevresel Değişkenler / Environment Checklist
`.env` içinde aşağıdaki değerleri üretim ortamına göre ayarlayın:
```
PUBLIC_CDN_BASE=https://cdn.example.com
RATE_LIMIT_PUBLIC_PER_MIN=20
JWT_WIDGET_ISSUER="kyradi-widget"
JWT_WIDGET_EXPIRE_MIN=10
WIDGET_HCAPTCHA_ENABLED=true
HCAPTCHA_SECRET=******
WEBHOOK_SIGNATURE_SECRET=******
ENABLE_INTERNAL_RESERVATIONS=false
```
- Rate limit anahtarı `origin+IP+tenant` kombinasyonunu kullanır; yüksek trafikli oteller için değeri artırın.
- `ENABLE_INTERNAL_RESERVATIONS=false` olduğunda partner panelinde manuel rezervasyon formu gizlenir.

## 9. Partner Paneli Akışı
- Partner panelindeki "Rezervasyon Oluştur" ekranı `ENABLE_INTERNAL_RESERVATIONS=false` olduğunda gizlenir.
- "Widget Rezervasyonları" sayfası yalnızca listeleme / filtreleme ve onaylama / iptal işlevlerini sunar.
- Filtreler: durum, tarih aralığı, kaynak domain.
- "Widget Önizleme" ve `/widget-demo` sayfaları toplantı/demo için hazır; script yüklenmese dahi statik form şablonu gösterilebilir.

## 10. Rate Limit & Audit
- Public API rate limit: `RATE_LIMIT_PUBLIC_PER_MIN` (varsayılan 20 istek/dk).
- Audit logları `actor="widget"` olarak kaydedilir, PII alanları maskeleme ile saklanır.

## 11. Test ve Doğrulama / Acceptance Checklist
1. `npm run dev` ile frontend’i açın, `/widget-demo` sayfasında tenant ID + widget key girip formu test edin.
2. Form gönderimleri `Widget Rezervasyonları` panelinde görünüyor mu kontrol edin (status: pending).
3. Webhook URL’i tanımlı tenant için teslim loglarını ve imza doğrulamasını test edin.
4. Rate limit ve captcha açık senaryolarında başarısız denemeleri loglarda gözlemleyin.
5. `poetry run pytest` ile backend testlerini, `npm run test` ile kritik frontend testlerini çalıştırın.

## 12. Operasyon Rehberi / FAQ
**S: 403 "Domain eşleşmiyor" hatası aldım, neden?**  
Y: Script'in çağırıldığı origin `widget_config.allowed_origins` listesinde değil. Tüm alt domainleri ayrı ayrı ekleyin.

**S: Form CAPTCHA doğrulaması istiyor.**  
Y: `WIDGET_HCAPTCHA_ENABLED=true` ise site key'i script attribute olarak geçmeli ve backend `HCAPTCHA_SECRET` ayarlanmalıdır.

**S: Rate limit aşıldı hatası görüyorum.**  
Y: Aynı IP + origin kombinasyonu kısa sürede çok fazla istek gönderdi. Bir süre bekleyin veya kotayı yükseltin.

---
For English readers: Every section above includes bilingual explanations. Please contact KYRADİ support for additional locales or advanced customization.
