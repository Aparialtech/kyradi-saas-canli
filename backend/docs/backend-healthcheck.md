# Kyradi Backend Healthcheck Checklist

Bu doküman backend sisteminin sağlıklı çalıştığını doğrulamak için kullanılan kontrol listesidir.

---

## 1. Startup Logs

Backend başlangıcında aşağıdaki logların görünmesi beklenir:

### ✅ Başarılı Başlangıç Logları

```
Starting Kyradi backend...
CORS allowed origins: ['https://kyradi-saas-canli.vercel.app', ...]
ensure_widget_tables_exist: widget tables ensured
Demo tenant already exists, skipping creation
Demo tenant admin user already exists, skipping creation
Platform super admin user already exists, skipping creation
Demo widget config already exists for tenant ..., skipping
Demo location already exists for tenant ..., using existing ID ...
Demo storage already exists for tenant ..., skipping
```

### ❌ Hata Durumları ve Çözümleri

| Log Mesajı | Sorun | Çözüm |
|------------|-------|-------|
| `MultipleResultsFound` | Birden fazla demo kaydı var | `scalars().first()` kullanıldı, artık sorun yok |
| `column storages.capacity does not exist` | Database schema uyumsuz | `_apply_critical_ddl` ile otomatik düzeltilir |
| `AI service NOT configured: OPENAI_API_KEY missing` | AI API key eksik | Uyarı, AI dışı özellikler çalışır |

---

## 2. Payment & Reservation Akışı

### Checklist

- [ ] **Widget rezervasyonu oluşturulabiliyor mu?**
  - `POST /public/widget/init` → 200 OK
  - `POST /public/widget/reservations` → 200 OK

- [ ] **Aynı rezervasyon için birden fazla istek atıldığında tek payment kalıyor mu?**
  - Log'da `Existing payment detected, skipping creation` mesajı görülmeli
  - `payments_reservation_id_key` UNIQUE constraint ihlali OLMAMALI

- [ ] **MagicPay demo checkout URL'i düzgün dönüyor mu?**
  - Response'da `payment_url` alanı `/payments/magicpay/demo/{session_id}` formatında olmalı

- [ ] **Demo ödeme tamamlandıktan sonra settlement oluşuyor mu?**
  - Payment status = `PAID`
  - Settlement kaydı oluşmuş olmalı

### Payment Duplicate Koruma Mekanizması

```
┌─────────────────────────────────────────────────────────────┐
│                    get_or_create_payment                     │
├─────────────────────────────────────────────────────────────┤
│  1. SELECT * FROM payments WHERE reservation_id = ?         │
│     └─ Varsa: return existing_payment (created=False)       │
│                                                              │
│  2. INSERT yeni payment                                      │
│     └─ IntegrityError yakalanırsa:                          │
│         - rollback                                           │
│         - SELECT tekrar                                      │
│         - return existing_payment                            │
│                                                              │
│  Log: "Existing payment detected, skipping creation..."     │
└─────────────────────────────────────────────────────────────┘
```

### Test Senaryoları

```bash
# 1. Widget init
curl -X GET "https://backend/public/widget/init?tenant_id=DEMO_TENANT_ID&key=demo-public-key"

# 2. Widget reservation submit
curl -X POST "https://backend/public/widget/reservations" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "guest": {"name": "Test User", "email": "test@example.com", "phone": "+905551234567"},
    "checkin_date": "2025-12-10",
    "checkout_date": "2025-12-11",
    "kvkk_consent": true,
    "terms_consent": true
  }'

# 3. Demo payment complete
curl -X POST "https://backend/payments/magicpay/demo/{session_id}/complete"
```

---

## 3. Plan Limitleri

### Checklist

- [ ] **Lokasyon plan limiti doluyken yeni lokasyon eklenemiyor mu?**
  - HTTP 403 + `"Plan limitine ulaşıldı"` mesajı dönmeli

- [ ] **Plan limit hata mesajı anlaşılır mı?**
  - Backend: `Plan limit reached: maximum locations for this tenant`
  - Frontend'de Türkçe gösterilmeli

### Limit Kontrol Mekanizması

```python
# app/services/limits.py
async def ensure_location_limit(session, tenant_id):
    plan = await get_tenant_plan(session, tenant_id)
    current_count = await count_locations(session, tenant_id)
    if current_count >= plan.max_locations:
        raise ValueError(f"Plan limitine ulaşıldı: maksimum {plan.max_locations} lokasyon")
```

---

## 4. Eleman / Kullanıcı Akışı

### Checklist

- [ ] **Yeni kullanıcı eklenebiliyor mu?**
  - `POST /users` → 201 Created

- [ ] **Kullanıcı limiti aşıldığında anlamlı hata dönüyor mu?**
  - HTTP 403 + limit mesajı

- [ ] **Eleman atama için atanabilir kullanıcılar listeleniyor mu?**
  - `GET /users/assignable` → 200 OK + kullanıcı listesi
  - Boşsa: `[]` (boş array) dönmeli

### Atanabilir Kullanıcı Kriterleri

```python
# Atanabilir roller:
assignable_roles = [
    UserRole.STAFF,
    UserRole.STORAGE_OPERATOR,
    UserRole.HOTEL_MANAGER,
]

# Koşullar:
- is_active = True
- Henüz staff ataması yapılmamış
- Tenant'a ait
```

### Test Senaryoları

```bash
# 1. Kullanıcı listesi
curl -X GET "https://backend/users" \
  -H "Authorization: Bearer {admin_token}"

# 2. Atanabilir kullanıcılar
curl -X GET "https://backend/users/assignable" \
  -H "Authorization: Bearer {admin_token}"

# 3. Yeni kullanıcı oluştur
curl -X POST "https://backend/users" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@hotel.com",
    "password": "SecurePass123!",
    "role": "STAFF",
    "is_active": true
  }'
```

---

## 5. AI / Kyradi Asistan Backend

### Checklist

- [ ] **AI servis model adı logta doğru gösteriliyor mu?**
  - Log: `AI service configured: model=gpt-4.1-mini` (veya ayarlanan model)

- [ ] **AI endpoint 200 dönüyor mu?**
  - `GET /ai/health` → 200 OK
  - `POST /ai/assistant` → 200 OK (AI etkinse)

- [ ] **Rate limit veya timeout durumunda anlamlı error mesajı dönüyor mu?**
  - Rate limit: HTTP 429 + `"OpenAI kullanım limiti doldu"`
  - Timeout: HTTP 504 + `"AI yanıt süresi aşıldı"`
  - API key eksik: HTTP 503 + `"AI servisi yapılandırılmamış"`

### AI Durum Kontrol

```bash
# Health check
curl -X GET "https://backend/ai/health"

# Beklenen cevap (AI aktif):
{
  "status": "ok",
  "available": true,
  "provider": "openai",
  "model": "gpt-4.1-mini"
}

# Beklenen cevap (AI pasif):
{
  "status": "unavailable",
  "available": false,
  "reason": "OPENAI_API_KEY eksik"
}
```

### AI Graceful Degradation

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Modülü                               │
├─────────────────────────────────────────────────────────────┤
│  OPENAI_API_KEY var mı?                                     │
│  ├─ EVET → OpenAI provider kullan                           │
│  └─ HAYIR → DummyAIProvider kullan                          │
│             └─ /ai/chat → HTTP 503                          │
│             └─ /ai/health → {"available": false}            │
│                                                              │
│  Backend CRASH ETMEZ, diğer özellikler çalışır!            │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. CORS & Origin Validation

### Checklist

- [ ] **Widget init CORS hatası vermiyor mu?**
  - `Access-Control-Allow-Origin` spesifik domain döndürülmeli
  - `Access-Control-Allow-Credentials: true`

- [ ] **Vercel preview URL'leri destekleniyor mu?**
  - Pattern: `https://kyradi-saas-canli-*.vercel.app`

### İzin Verilen Origin'ler

```python
ALLOWED_ORIGINS = [
    "https://kyradi-saas-canli.vercel.app",
    "https://kyradi-saas-canli-cqly0ovkl-aparialtechs-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# Vercel preview için pattern
ALLOWED_ORIGIN_PATTERNS = [
    r"https://kyradi-saas-canli-[a-z0-9-]+\.vercel\.app",
]
```

---

## 7. Database Schema Migrations

### Otomatik Uygulanan DDL

```sql
-- _apply_critical_ddl (her ortamda çalışır)
ALTER TABLE storages ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB;
```

### Kontrol

```bash
# PostgreSQL'de kontrol
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'storages';"
# capacity kolonu görülmeli
```

---

## 8. Hata Sınıflandırma Tablosu

| Hata Tipi | HTTP Kodu | Örnek Mesaj | Log Level |
|-----------|-----------|-------------|-----------|
| `IntegrityError` (Duplicate) | 409 | "Payment zaten var" | WARNING |
| `ValueError` (Business Logic) | 400 | "Depo bulunamadı" | WARNING |
| `Plan Limit` | 403 | "Plan limitine ulaşıldı" | WARNING |
| `Auth Error` | 401/403 | "Yetkiniz yok" | INFO |
| `Rate Limit` | 429 | "Çok fazla istek" | INFO |
| `AI Unavailable` | 503 | "AI servisi kullanılamıyor" | WARNING |
| `Internal Error` | 500 | "Beklenmeyen hata" | ERROR |

---

## 9. Monitoring Önerileri

### Kritik Metrikler

1. **Payment duplicate rate**: `Existing payment detected` log sayısı
2. **Widget conversion success rate**: `Auto-converted widget reservation` / toplam
3. **AI availability**: `/ai/health` uptime
4. **Error rate by type**: 4xx vs 5xx oranı

### Log Arama Komutları

```bash
# Duplicate payment uyarıları
grep "Existing payment detected" logs.txt

# Widget conversion hataları
grep "Failed to auto-convert widget reservation" logs.txt

# Plan limit hataları
grep "Plan limit reached" logs.txt

# AI hataları
grep "AI service" logs.txt
```

---

## 10. Quick Sanity Test Script

```bash
#!/bin/bash
# Kyradi Backend Quick Test

BASE_URL="https://your-backend-url"

echo "=== Health Check ==="
curl -s "$BASE_URL/health" | jq

echo "=== AI Health ==="
curl -s "$BASE_URL/ai/health" | jq

echo "=== Widget Init (Demo) ==="
curl -s "$BASE_URL/public/widget/init?tenant_id=DEMO_TENANT_ID&key=demo-public-key" | jq

echo "=== Test Complete ==="
```

---

**Son Güncelleme:** 2025-12-04

