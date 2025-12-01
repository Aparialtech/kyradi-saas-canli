# Kyradi Payment System Guide

Bu doküman Kyradi SaaS platformunun ödeme sistemini detaylı olarak açıklar.

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Mimari](#mimari)
3. [Payment Flow](#payment-flow)
4. [API Endpoint'leri](#api-endpointleri)
5. [Servisler](#servisler)
6. [Duplicate Koruma Mekanizması](#duplicate-koruma-mekanizması)
7. [Payment Mode'ları](#payment-modeları)
8. [Konfigürasyon](#konfigürasyon)
9. [Hata Yönetimi](#hata-yönetimi)
10. [Troubleshooting](#troubleshooting)

---

## Genel Bakış

Kyradi ödeme sistemi şu temel prensiplere dayanır:

- **Tek Kaynak (Single Source of Truth):** Tüm payment oluşturma işlemleri `payment_service.py` üzerinden yapılır
- **İdempotent İşlemler:** Aynı reservation için birden fazla payment oluşturulamaz
- **Güvenli Bağlama:** Payment-Reservation ilişkisi güvenli şekilde kurulur
- **Demo & Canlı Mod Desteği:** Hem test hem production ortamları desteklenir

### Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **Payment** | Ödeme kaydı (PENDING → PAID/FAILED) |
| **Reservation** | Depo rezervasyonu |
| **WidgetReservation** | Widget üzerinden yapılan ham rezervasyon |
| **Settlement** | Hakedis kaydı (komisyon hesaplı) |
| **Checkout Session** | MagicPay ödeme ekranı oturumu |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Widget Demo │  │ Partner     │  │ MagicPay Demo           │ │
│  │ Page        │  │ Dashboard   │  │ Checkout Page           │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ /public/widget/* │  │ /demo/*          │  │ /payments/*   │ │
│  │ router_public.py │  │ demo.py          │  │ magicpay.py   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
└───────────┼─────────────────────┼────────────────────┼─────────┘
            │                     │                    │
            ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVİSLER                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   payment_service.py                        │ │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐  │ │
│  │  │ get_or_create_      │  │ create_payment_for_         │  │ │
│  │  │ payment()           │  │ reservation()               │  │ │
│  │  │ [İDEMPOTENT]        │  │ [HIGH-LEVEL]                │  │ │
│  │  └─────────────────────┘  └─────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ widget_conversion.py│  │ magicpay/service.py             │   │
│  │ [CONVERT FLOW]      │  │ [CHECKOUT SESSION]              │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ payments   │  │reservations│  │ widget_    │  │settlements│ │
│  │            │  │            │  │reservations│  │           │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
│                                                                  │
│  UNIQUE CONSTRAINT: payments.reservation_id                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Payment Flow

### 1. Widget Reservation Flow (Tam Akış)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WIDGET FORM SUBMIT                                            │
│    POST /public/widget/reservations                              │
│    - Misafir bilgileri                                           │
│    - Tarih/saat                                                  │
│    - KVKK onayı                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. WIDGET RESERVATION OLUŞTUR                                    │
│    - WidgetReservation tablosuna kayıt                           │
│    - Status: "pending"                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CONVERT TO NORMAL RESERVATION                                 │
│    widget_conversion.convert_widget_reservation_to_reservation() │
│    - Uygun storage bul                                           │
│    - Normal Reservation oluştur                                  │
│    - Storage status: OCCUPIED                                    │
│    - WidgetReservation status: "converted"                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PAYMENT OLUŞTUR (İDEMPOTENT)                                  │
│    payment_service.get_or_create_payment()                       │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │ Mevcut payment var mı?                                    │ │
│    │   ├─ YES → Mevcut payment döndür (INSERT YOK)             │ │
│    │   └─ NO  → Yeni payment oluştur                           │ │
│    └──────────────────────────────────────────────────────────┘ │
│    - Payment status: PENDING                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CHECKOUT SESSION OLUŞTUR (Demo Mode)                          │
│    MagicPayService.create_checkout_session()                     │
│    - checkout_url oluştur                                        │
│    - session_id oluştur                                          │
│    - Payment meta güncelle                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RESPONSE                                                      │
│    {                                                             │
│      "id": 123,                                                  │
│      "status": "pending",                                        │
│      "payment_required": true,                                   │
│      "payment_url": "/payments/magicpay/demo/session_xxx",       │
│      "payment_intent_id": "session_xxx"                          │
│    }                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. ÖDEME EKRANI (Frontend)                                       │
│    - Kullanıcı checkout_url'e yönlendirilir                      │
│    - Demo: Fake kart formu gösterilir                            │
│    - Canlı: Gerçek ödeme gateway'i                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. ÖDEME TAMAMLA                                                 │
│    POST /payments/magicpay/demo/{session_id}/complete            │
│    - Payment status: PAID                                        │
│    - Settlement oluştur                                          │
│    - Hakedis hesapla (komisyon)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Manuel Checkout Session Oluşturma

Partner dashboard'dan manuel ödeme başlatmak için:

```
POST /payments/magicpay/checkout-session
{
  "reservation_id": "uuid-here"
}

Response:
{
  "payment_id": "payment-uuid",
  "session_id": "session_xxx",
  "checkout_url": "/payments/magicpay/demo/session_xxx",
  "amount_minor": 15000,
  "currency": "TRY"
}
```

---

## API Endpoint'leri

### Public Widget Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/public/widget/init` | GET | Widget token al |
| `/public/widget/reservations` | POST | Widget rezervasyonu oluştur |

### MagicPay Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/payments/magicpay/checkout-session` | POST | Checkout session oluştur |
| `/payments/magicpay/demo/{session_id}` | GET | Payment bilgisi al |
| `/payments/magicpay/demo/{session_id}/complete` | POST | Demo ödemeyi tamamla |

### Demo Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/demo/available-storages` | GET | Müsait depoları listele |
| `/demo/payments/{intent_id}/simulate` | POST | Ödeme simüle et |
| `/demo/widget-reservations/{id}/convert` | POST | Widget'ı normal rezervasyona çevir |

---

## Servisler

### payment_service.py

Ana payment servisi. Tüm payment işlemleri bu modül üzerinden yapılır.

#### get_existing_payment()

```python
async def get_existing_payment(
    session: AsyncSession,
    reservation_id: str,
) -> Optional[Payment]:
    """Reservation için mevcut payment'ı bul."""
```

#### get_or_create_payment()

```python
async def get_or_create_payment(
    session: AsyncSession,
    *,
    reservation_id: str,
    tenant_id: str,
    amount_minor: int,
    currency: str = "TRY",
    provider: str = "MAGIC_PAY",
    mode: str = "GATEWAY_DEMO",
    storage_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Tuple[Payment, bool]:
    """İdempotent payment oluştur.
    
    Returns:
        (Payment, created) - created=True ise yeni oluşturuldu
    """
```

**Önemli:** Bu fonksiyon **İDEMPOTENT**'tir:
- Mevcut payment varsa onu döndürür
- Yoksa yeni oluşturur
- Race condition durumunda IntegrityError yakalar

#### create_payment_for_reservation()

```python
async def create_payment_for_reservation(
    session: AsyncSession,
    *,
    reservation: Reservation,
    storage: Optional[Storage] = None,
    provider: str = "MAGIC_PAY",
    mode: str = "GATEWAY_DEMO",
    create_checkout_session: bool = True,
) -> Payment:
    """Yüksek seviye payment oluşturma.
    
    - Tenant config'den payment mode alır
    - Demo mode ise checkout session oluşturur
    """
```

#### link_payment_to_reservation()

```python
async def link_payment_to_reservation(
    session: AsyncSession,
    *,
    payment_id: str,
    reservation_id: str,
) -> Optional[Payment]:
    """Payment'ı reservation'a güvenli şekilde bağla.
    
    - Zaten bağlıysa yeni bağlama yapmaz
    - Başka payment varsa None döner
    """
```

### widget_conversion.py

Widget rezervasyonlarını normal rezervasyonlara çevirir.

```python
async def convert_widget_reservation_to_reservation(
    session: AsyncSession,
    widget_reservation_id: int,
    tenant_id: str,
    storage_id: Optional[str] = None,
    preferred_location_id: Optional[str] = None,
) -> Reservation:
    """Widget rezervasyonunu normal rezervasyona çevir.
    
    Bu fonksiyon:
    1. Storage bulur/atar
    2. Reservation oluşturur
    3. get_or_create_payment ile SADECE 1 payment oluşturur
    4. Checkout session oluşturur (demo mode)
    """
```

### magicpay/service.py

MagicPay checkout session yönetimi.

```python
class MagicPayService:
    async def create_checkout_session(
        self,
        session: AsyncSession,
        reservation: Reservation,
        payment_mode: str = "demo_local",
    ) -> Dict[str, Any]:
        """Checkout session oluştur.
        
        Returns:
            {
                "checkout_url": str,
                "session_id": str,
                "expires_at": float,
                "payment": Payment
            }
        """
    
    async def complete_payment(
        self,
        session: AsyncSession,
        payment: Payment,
        result: str,  # "success" | "failed"
    ) -> Payment:
        """Demo ödemeyi tamamla."""
```

---

## Duplicate Koruma Mekanizması

### Neden Gerekli?

Widget flow'da payment birden fazla yerden oluşturulabilir:
1. `widget_conversion` içinde otomatik
2. `magicpay.py` checkout-session endpoint'inde
3. `demo.py` convert endpoint'inde

Bu durum `UniqueViolationError: payments_reservation_id_key` hatasına yol açabilir.

### Nasıl Çözüldü?

```
┌─────────────────────────────────────────────────────────────────┐
│                    get_or_create_payment()                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. SELECT * FROM payments WHERE reservation_id = ?         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│            ┌────────────┴────────────┐                          │
│            ▼                         ▼                          │
│  ┌─────────────────┐      ┌─────────────────────────────────┐  │
│  │ MEVCUT VAR      │      │ MEVCUT YOK                      │  │
│  │                 │      │                                  │  │
│  │ LOG:            │      │ INSERT INTO payments ...         │  │
│  │ "Existing       │      │                                  │  │
│  │  payment        │      │ ┌─────────────────────────────┐ │  │
│  │  detected,      │      │ │ IntegrityError?             │ │  │
│  │  skipping..."   │      │ │   → ROLLBACK                │ │  │
│  │                 │      │ │   → SELECT (race condition) │ │  │
│  │ return (p,False)│      │ └─────────────────────────────┘ │  │
│  └─────────────────┘      │                                  │  │
│                           │ return (new_payment, True)       │  │
│                           └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Log Mesajları

| Log | Anlam |
|-----|-------|
| `Existing payment detected, skipping creation...` | Mevcut payment bulundu, duplicate engellendi |
| `Payment already linked to reservation...` | Payment zaten bağlı |
| `Race condition detected...` | Eşzamanlı istek yakalandı |
| `Created new payment...` | Yeni payment başarıyla oluşturuldu |

---

## Payment Mode'ları

### Desteklenen Mode'lar

| Mode | Açıklama | Client |
|------|----------|--------|
| `demo_local` | Yerel demo | FakeMagicPayClient |
| `GATEWAY_DEMO` | Gateway demo | FakeMagicPayClient |
| `live` | Canlı ödeme | MagicPayClient |

### Mode Belirleme

Payment mode şu sırayla belirlenir:

1. Tenant metadata'dan `payment_mode`
2. Default: `GATEWAY_DEMO`

```python
# Tenant metadata örneği
{
    "payment_mode": "GATEWAY_DEMO",
    "payment_provider": "MAGIC_PAY"
}
```

### Demo vs Canlı

```python
# Demo mode kontrolü
from app.services.magicpay.client import DEMO_MODES, normalize_payment_mode

is_demo = payment_mode in DEMO_MODES or normalize_payment_mode(mode) == "demo"
```

---

## Konfigürasyon

### Tenant Ayarları

Tenant'ın payment ayarları `tenants.metadata_` JSON alanında saklanır:

```json
{
  "payment_mode": "GATEWAY_DEMO",
  "payment_provider": "MAGIC_PAY",
  "commission_rate": 5.0
}
```

### Environment Variables

```bash
# Backend (.env)
MAGIC_PAY_API_KEY=xxx
MAGIC_PAY_SECRET=xxx
MAGIC_PAY_WEBHOOK_SECRET=xxx

# Widget
WIDGET_HCAPTCHA_ENABLED=false
HCAPTCHA_SECRET=xxx
```

---

## Hata Yönetimi

### HTTP Status Kodları

| Kod | Durum | Örnek |
|-----|-------|-------|
| 200 | Başarılı | Payment oluşturuldu |
| 400 | Bad Request | Geçersiz tarih aralığı |
| 401 | Unauthorized | Widget token geçersiz |
| 403 | Forbidden | Tenant erişim yok |
| 404 | Not Found | Reservation bulunamadı |
| 409 | Conflict | Duplicate payment (nadir) |
| 422 | Validation Error | KVKK onayı eksik |
| 500 | Server Error | Beklenmeyen hata |

### Hata Response Formatı

```json
{
  "detail": "Hata mesajı",
  "errors": [
    {
      "loc": ["body", "field_name"],
      "msg": "Alan hatası",
      "type": "value_error"
    }
  ]
}
```

---

## Troubleshooting

### 1. "UniqueViolationError: payments_reservation_id_key"

**Sebep:** Aynı reservation için birden fazla payment INSERT denemesi.

**Çözüm:** Bu hata artık oluşmamalı. `get_or_create_payment` idempotent çalışır.

**Eğer hala görüyorsanız:**
1. Tüm payment oluşturma yerlerinin `get_or_create_payment` kullandığını doğrulayın
2. Log'larda `"Existing payment detected"` mesajını arayın

### 2. "Bu tarihler arasında depo yoktur"

**Sebep:** Seçilen tarihler için müsait storage yok.

**Çözüm:**
1. Tenant'ın storage'ları var mı kontrol edin
2. Mevcut rezervasyonları kontrol edin
3. Storage status'larını kontrol edin (IDLE olmalı)

```sql
-- Tenant'ın storage'larını kontrol et
SELECT id, status FROM storages WHERE tenant_id = 'xxx';

-- Aktif rezervasyonları kontrol et
SELECT storage_id, start_at, end_at 
FROM reservations 
WHERE tenant_id = 'xxx' AND status IN ('RESERVED', 'ACTIVE');
```

### 3. "Widget token geçersiz"

**Sebep:** JWT token süresi dolmuş veya yanlış.

**Çözüm:**
1. `/public/widget/init` ile yeni token alın
2. `Authorization: Bearer <token>` header'ını kontrol edin

### 4. Payment oluşturuldu ama checkout_url yok

**Sebep:** Checkout session oluşturma başarısız olmuş.

**Çözüm:**
1. Log'larda `"Failed to create MagicPay checkout session"` arayın
2. MagicPay client konfigürasyonunu kontrol edin
3. Manuel olarak checkout session oluşturun:

```bash
curl -X POST /payments/magicpay/checkout-session \
  -H "Authorization: Bearer <token>" \
  -d '{"reservation_id": "xxx"}'
```

### 5. Settlement oluşturulmuyor

**Sebep:** Payment PAID durumuna geçmemiş veya reservation_id bağlı değil.

**Kontrol:**
```sql
SELECT id, status, reservation_id FROM payments WHERE id = 'xxx';
SELECT * FROM settlements WHERE payment_id = 'xxx';
```

---

## Örnek Senaryolar

### Senaryo 1: Başarılı Widget Rezervasyonu

```bash
# 1. Widget init
curl -X GET "/public/widget/init?tenant_id=xxx&key=demo-public-key"
# Response: { "access_token": "jwt...", "expires_in": 3600 }

# 2. Rezervasyon oluştur
curl -X POST "/public/widget/reservations" \
  -H "Authorization: Bearer jwt..." \
  -d '{
    "guest": {"name": "Test", "email": "test@test.com", "phone": "555"},
    "checkin_date": "2025-12-10",
    "checkout_date": "2025-12-12",
    "kvkk_consent": true,
    "terms_consent": true
  }'
# Response: { "id": 1, "payment_url": "/payments/...", "payment_intent_id": "session_xxx" }

# 3. Demo ödemeyi tamamla
curl -X POST "/payments/magicpay/demo/session_xxx/complete" \
  -H "Authorization: Bearer <staff_token>" \
  -d '{"result": "success"}'
# Response: { "ok": true, "payment_status": "paid", "settlement_id": "..." }
```

### Senaryo 2: Duplicate Payment Denemesi

```
İstek 1: POST /payments/magicpay/checkout-session {"reservation_id": "xxx"}
Log: "Creating new payment payment_id=abc..."
Response: { "payment_id": "abc", ... }

İstek 2: POST /payments/magicpay/checkout-session {"reservation_id": "xxx"}
Log: "Existing payment detected, skipping creation. payment_id=abc"
Response: { "payment_id": "abc", ... }  ← Aynı payment döner!
```

---

## Versiyon Geçmişi

| Tarih | Değişiklik |
|-------|------------|
| 2025-12-01 | İdempotent payment sistemi implementasyonu |
| 2025-12-01 | Duplicate koruma mekanizması eklendi |
| 2025-12-01 | get_or_create_payment helper eklendi |
| 2025-12-01 | Tüm endpoint'ler güncellendi |

---

## İletişim

Sorular için: [Kyradi Geliştirici Ekibi]

