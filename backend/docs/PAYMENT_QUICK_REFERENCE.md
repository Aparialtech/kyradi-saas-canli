# Kyradi Payment System - Hızlı Referans

## 🔑 Temel Kural

> **Tüm payment oluşturma işlemleri `payment_service.get_or_create_payment()` üzerinden yapılır!**

```python
from app.services.payment_service import get_or_create_payment

payment, was_created = await get_or_create_payment(
    session,
    reservation_id=reservation.id,
    tenant_id=tenant_id,
    amount_minor=amount,
    currency="TRY",
)

if was_created:
    print("Yeni payment oluşturuldu")
else:
    print("Mevcut payment kullanıldı (duplicate engellendi)")
```

---

## 📁 Dosya Yapısı

```
backend/app/services/
├── payment_service.py      # ← ANA PAYMENT SERVİSİ (buradan kullan!)
├── widget_conversion.py    # Widget → Reservation dönüşümü
└── magicpay/
    ├── client.py           # MagicPay API client
    └── service.py          # Checkout session yönetimi

backend/app/api/routes/
├── magicpay.py             # /payments/magicpay/* endpoints
├── demo.py                 # /demo/* endpoints
└── ...
```

---

## 🔄 Flow Diyagramı

```
Widget Submit → WidgetReservation → Reservation → Payment → Checkout → Settlement
                     │                    │            │
                     └────────────────────┴────────────┘
                        get_or_create_payment()
                        (TEK NOKTADAN OLUŞTUR!)
```

---

## ✅ Doğru Kullanım

### Payment Oluşturma

```python
# ✅ DOĞRU - get_or_create_payment kullan
from app.services.payment_service import get_or_create_payment

payment, created = await get_or_create_payment(
    session,
    reservation_id=reservation.id,
    tenant_id=tenant_id,
    amount_minor=1500,
)
```

### Payment Kontrolü

```python
# ✅ DOĞRU - get_existing_payment kullan
from app.services.payment_service import get_existing_payment

existing = await get_existing_payment(session, reservation.id)
if existing:
    # Mevcut payment var, yeni oluşturma!
    return existing
```

### Payment Bağlama

```python
# ✅ DOĞRU - link_payment_to_reservation kullan
from app.services.payment_service import link_payment_to_reservation

linked = await link_payment_to_reservation(
    session,
    payment_id=payment.id,
    reservation_id=reservation.id,
)
```

---

## ❌ Yanlış Kullanım

```python
# ❌ YANLIŞ - Direkt Payment oluşturma
payment = Payment(
    reservation_id=reservation.id,
    ...
)
session.add(payment)
# Bu duplicate hatası verebilir!

# ❌ YANLIŞ - Manuel kontrol
stmt = select(Payment).where(Payment.reservation_id == reservation.id)
existing = (await session.execute(stmt)).scalar_one_or_none()
if not existing:
    payment = Payment(...)  # Race condition riski!

# ✅ DOĞRU - Helper fonksiyon kullan
payment, _ = await get_or_create_payment(session, reservation_id=..., ...)
```

---

## 📝 Log Mesajları

| Mesaj | Anlam |
|-------|-------|
| `Existing payment detected, skipping creation...` | ✅ Duplicate engellendi |
| `Payment already linked to reservation...` | ✅ Zaten bağlı |
| `Created new payment...` | ✅ Yeni payment oluşturuldu |
| `Race condition detected...` | ⚠️ Eşzamanlı istek yakalandı |

---

## 🔧 Fonksiyon Referansı

### payment_service.py

| Fonksiyon | Parametre | Return | Açıklama |
|-----------|-----------|--------|----------|
| `get_existing_payment` | `session, reservation_id` | `Payment \| None` | Mevcut payment'ı bul |
| `get_or_create_payment` | `session, *, reservation_id, tenant_id, amount_minor, ...` | `(Payment, bool)` | İdempotent oluştur |
| `create_payment_for_reservation` | `session, *, reservation, ...` | `Payment` | Yüksek seviye oluşturma |
| `link_payment_to_reservation` | `session, *, payment_id, reservation_id` | `Payment \| None` | Güvenli bağlama |

---

## 🚨 Troubleshooting

### UniqueViolationError: payments_reservation_id_key

```bash
# Sebep: Direkt Payment oluşturma yapılmış
# Çözüm: get_or_create_payment kullan
```

### Checkout URL Yok

```bash
# Manuel oluştur:
POST /payments/magicpay/checkout-session
{"reservation_id": "xxx"}
```

### Payment Bulunamadı

```sql
-- Kontrol:
SELECT * FROM payments WHERE reservation_id = 'xxx';
```

---

## 📌 Checklist

Yeni payment kodu yazarken:

- [ ] `get_or_create_payment` kullandım
- [ ] Direkt `Payment()` oluşturmadım
- [ ] `session.add(Payment(...))` yapmadım
- [ ] Log mesajlarını kontrol ettim
- [ ] Duplicate senaryosunu test ettim

---

## 🔗 İlgili Dokümanlar

- [Detaylı Payment Guide](./PAYMENT_SYSTEM_GUIDE.md)
- [API Docs](/docs)
- [MagicPay Integration](./MAGICPAY_INTEGRATION.md)

