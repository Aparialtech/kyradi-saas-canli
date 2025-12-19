# KYRADİ SaaS Platform - Sistem Dokümantasyonu

**Versiyon:** 1.0  
**Tarih:** 19 Aralık 2025  
**Platform:** Otel Bagaj/Emanet Depolama Yönetim Sistemi

---

## 📋 İÇİNDEKİLER

1. [Genel Bakış](#1-genel-bakış)
2. [Kullanıcı Rolleri ve Yetkileri](#2-kullanıcı-rolleri-ve-yetkileri)
3. [Kimlik Doğrulama (Auth) Sistemi](#3-kimlik-doğrulama-auth-sistemi)
4. [Admin Panel](#4-admin-panel)
5. [Partner Panel](#5-partner-panel)
6. [Public (Genel) Sayfalar](#6-public-genel-sayfalar)
7. [Veritabanı Modelleri](#7-veritabanı-modelleri)
8. [API Endpoint'leri](#8-api-endpointleri)
9. [Frontend Servisleri](#9-frontend-servisleri)
10. [Enum Değerleri](#10-enum-değerleri)
11. [Teknik Altyapı](#11-teknik-altyapı)

---

## 1. GENEL BAKIŞ

KYRADİ, oteller ve turistik tesislerin bagaj/emanet depolama hizmetlerini yönetmelerini sağlayan bir SaaS platformudur.

### Ana Özellikler:
- Multi-tenant mimari (her otel ayrı tenant)
- Online rezervasyon sistemi (widget entegrasyonu)
- QR kod ile doğrulama
- Ödeme entegrasyonu (MagicPay, POS, Nakit)
- Gelir ve hakediş takibi
- Raporlama ve analiz
- Ticket/destek sistemi

### Teknik Stack:
- **Backend:** Python 3.11, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** React 18, TypeScript, Vite
- **Deployment:** Railway (Backend), Vercel (Frontend)

---

## 2. KULLANICI ROLLERİ VE YETKİLERİ

### 2.1 Sistem Seviyesi Roller

| Rol | Kod | Açıklama | Erişim |
|-----|-----|----------|--------|
| Süper Admin | `super_admin` | Tüm sisteme erişim | Admin Panel |
| Destek | `support` | Sistem destek ekibi | Admin Panel |

### 2.2 Otel Seviyesi Roller

| Rol | Kod | Açıklama | Erişim |
|-----|-----|----------|--------|
| Otel Müdürü | `hotel_manager` | Otel tam yetki | Partner Panel (Tüm) |
| Tenant Admin | `tenant_admin` | Backward compat. | Partner Panel (Tüm) |
| Depo Görevlisi | `storage_operator` | Operasyonel işler | Partner Panel (Sınırlı) |
| Muhasebe | `accounting` | Finans/raporlar | Partner Panel (Finans) |
| Personel | `staff` | Temel işlemler | Partner Panel (Temel) |
| Görüntüleyici | `viewer` | Sadece okuma | Partner Panel (Okuma) |

---

## 3. KİMLİK DOĞRULAMA (AUTH) SİSTEMİ

### 3.1 Sayfalar

| Sayfa | Route | Açıklama |
|-------|-------|----------|
| Giriş | `/login` | Partner/Admin giriş seçimi |
| Şifremi Unuttum | `/forgot-password` | E-posta ile kod gönderimi |
| Kod Doğrula | `/verify-reset-code` | 6 haneli kod doğrulama |
| Şifre Sıfırla | `/reset-password` | Yeni şifre belirleme |
| SMS Doğrulama | `/verify-sms` | Telefon doğrulama |

### 3.2 Giriş Akışı

```
1. Kullanıcı /login sayfasına gelir
2. Partner veya Admin sekmesi seçer
3. E-posta ve şifre girer
4. Backend doğrular → JWT token döner
5. Role göre /admin veya /app'e yönlendirilir
```

### 3.3 Şifre Sıfırlama Akışı

```
1. /forgot-password → E-posta gir
2. Backend 6 haneli kod gönderir
3. /verify-reset-code → Kodu gir
4. /reset-password → Yeni şifre belirle
5. /login'e yönlendir
```

### 3.4 API Endpoint'leri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/auth/login` | POST | Giriş yap |
| `/auth/logout` | POST | Çıkış yap |
| `/auth/me` | GET | Mevcut kullanıcı bilgisi |
| `/auth/refresh` | POST | Token yenile |
| `/auth/password-reset/request` | POST | Şifre sıfırlama kodu iste |
| `/auth/password-reset/verify-code` | POST | Kodu doğrula |
| `/auth/password-reset/reset` | POST | Yeni şifre belirle |

---

## 4. ADMIN PANEL

**Base Route:** `/admin`  
**İzin Verilen Roller:** `super_admin`, `support`

### 4.1 Sayfalar

| Sayfa | Route | Açıklama |
|-------|-------|----------|
| Genel Bakış | `/admin` veya `/admin/overview` | Dashboard, özet metrikler |
| Raporlar | `/admin/reports` | Detaylı analiz ve grafikler |
| Faturalar | `/admin/invoice` | Fatura yönetimi |
| Oteller (Tenants) | `/admin/tenants` | Otel/tenant CRUD |
| Gelirler | `/admin/revenue` | Gelir takibi |
| Hakedişler | `/admin/settlements` | Hakediş yönetimi |
| Kullanıcılar | `/admin/users` | Tüm kullanıcı yönetimi |
| Ticket'lar | `/admin/tickets` | Destek ticket yönetimi |
| Ayarlar | `/admin/settings` | Sistem ayarları |
| Denetim Logları | `/admin/audit` | İşlem geçmişi |

### 4.2 Admin - Oteller (Tenants) Sayfası

**İşlevler:**
- Otel listesi (pagination, arama, filtreleme)
- Yeni otel ekleme
- Otel düzenleme
- Otel aktif/pasif yapma
- Plan limitleri belirleme (max lokasyon, depo, kullanıcı)

**Alanlar:**
- Otel Adı
- Slug (URL identifier)
- Yasal Unvan
- Aktif durumu
- Plan limitleri

### 4.3 Admin - Kullanıcılar Sayfası

**İşlevler:**
- Tüm kullanıcıları listele
- Kullanıcı oluştur
- Kullanıcı düzenle
- Kullanıcı sil
- Rol atama
- Tenant atama

**Alanlar:**
- Ad Soyad
- E-posta
- Rol
- Bağlı Otel

### 4.4 Admin - Ticket Sayfası

**İşlevler:**
- Tüm ticket'ları görüntüle
- Ticket durumu değiştir (open, in_progress, resolved, closed)
- Çözüm notu ekle
- Öncelik filtreleme
- Otel bazlı filtreleme

---

## 5. PARTNER PANEL

**Base Route:** `/app`  
**İzin Verilen Roller:** `tenant_admin`, `hotel_manager`, `storage_operator`, `accounting`, `staff`, `viewer`

### 5.1 Sayfalar

| Sayfa | Route | Açıklama | Gerekli Roller |
|-------|-------|----------|----------------|
| Ana Sayfa | `/app` | Dashboard | Tüm |
| Lokasyonlar | `/app/locations` | Lokasyon listesi | Tüm |
| Lokasyon Düzenle | `/app/locations/:id/edit` | Lokasyon düzenleme | Tüm |
| Lokasyon Ekle | `/app/locations/new` | Yeni lokasyon | Tüm |
| Depolar | `/app/lockers` | Depo yönetimi | Tüm |
| Rezervasyonlar | `/app/reservations` | Rezervasyon listesi | Tüm |
| Widget Önizleme | `/app/widget-preview` | Widget test | Tüm |
| QR Doğrulama | `/app/qr` | QR okutma | Tüm |
| Raporlar | `/app/reports` | Analiz raporları | accounting, hotel_manager, tenant_admin |
| Gelirler | `/app/revenue` | Gelir takibi | accounting, hotel_manager, tenant_admin |
| Hakedişler | `/app/settlements` | Hakediş listesi | accounting, hotel_manager, tenant_admin |
| Transferler | `/app/transfers` | Para transfer takibi | accounting, hotel_manager, tenant_admin |
| Kullanıcılar | `/app/users` | Kullanıcı yönetimi | tenant_admin, hotel_manager |
| Çalışanlar | `/app/staff` | Personel atama | tenant_admin, hotel_manager |
| Ticket'lar | `/app/tickets` | Destek talepleri | tenant_admin, hotel_manager |
| Fiyatlandırma | `/app/pricing` | Fiyat kuralları | tenant_admin, hotel_manager |
| Demo Akış | `/app/demo-flow` | Test akışı | tenant_admin, hotel_manager |
| Ayarlar | `/app/settings` | Otel ayarları | Tüm |

### 5.2 Lokasyonlar Sayfası

**İşlevler:**
- Lokasyon listesi (pagination)
- Yeni lokasyon ekleme
- Lokasyon düzenleme (ayrı sayfa)
- Lokasyon silme
- Harita ile konum seçimi (Google Maps)
- Çalışma saatleri belirleme (çoklu zaman aralığı)

**Alanlar:**
- Lokasyon Adı (zorunlu)
- Açık Adres (zorunlu)
- İl/İlçe (zorunlu)
- Adres Detayları
- Telefon Numarası
- Çalışma Saatleri (JSON - başlangıç/bitiş aralıkları)
- Enlem/Boylam (haritadan otomatik)

### 5.3 Depolar (Storages) Sayfası

**İşlevler:**
- Depo listesi (pagination)
- Yeni depo ekleme
- Depo düzenleme
- Depo detayı görüntüleme (expand/collapse)
- Müsaitlik takvimi görüntüleme
- Kapasite yönetimi

**Alanlar:**
- Depo Adı
- Bağlı Lokasyon
- Kapasite (max bagaj)
- Boyut Tipi (small, medium, large)
- Durum (idle, occupied, faulty)
- Fiyat

### 5.4 Rezervasyonlar Sayfası

**İşlevler:**
- Rezervasyon listesi (pagination, arama, filtreleme)
- Rezervasyon detayı görüntüleme
- Durum değiştirme
- Ödeme bilgisi görüntüleme
- QR kod gösterme

**Alanlar:**
- Rezervasyon No
- Müşteri Adı
- Telefon
- E-posta
- Check-in/Check-out tarihleri
- Bagaj sayısı
- Durum
- Ödeme durumu
- Toplam tutar

**Durum Değerleri:**
- `reserved` - Rezerve edildi
- `active` - Aktif (bagaj bırakıldı)
- `completed` - Tamamlandı
- `cancelled` - İptal edildi
- `no_show` - Gelmedi

### 5.5 QR Doğrulama Sayfası

**İşlevler:**
- Kamera ile QR kod okuma
- Rezervasyon doğrulama
- Bagaj teslim/alım işlemi

**Akış:**
```
1. Kamera izni iste
2. QR kodu okut
3. Backend'e doğrulama isteği gönder
4. Sonucu göster (başarılı/başarısız)
5. Gerekli aksiyonu al (teslim/alım)
```

### 5.6 Gelirler ve Hakedişler Sayfası

**İşlevler:**
- Gelir özeti
- Tarih aralığı filtreleme
- Lokasyon/Depo bazlı filtreleme
- Hakediş listesi
- Hakediş durumu takibi

**Durum Değerleri:**
- `pending` - Beklemede
- `processing` - İşleniyor
- `completed` - Tamamlandı (Mutabakat)
- `cancelled` - İptal

### 5.7 Fiyatlandırma Sayfası

**İşlevler:**
- Fiyat kuralı listesi
- Yeni kural ekleme
- Kural düzenleme/silme
- Tenant/Lokasyon/Depo bazlı fiyatlandırma

**Kural Alanları:**
- Kural Adı
- Kapsam (tenant, location, storage)
- Süre Tipi (saatlik, günlük, haftalık)
- Baz Fiyat
- Ek Saat Fiyatı

### 5.8 Ticket Sayfası (Partner)

**İşlevler:**
- Ticket listesi
- Yeni ticket oluşturma
- Ticket detayı görüntüleme
- Durum takibi

**Alanlar:**
- Başlık
- Mesaj
- Öncelik (low, medium, high, urgent)
- Durum (open, in_progress, resolved, closed)

### 5.9 Kullanıcılar Sayfası (Partner)

**İşlevler:**
- Otel kullanıcıları listesi
- Yeni kullanıcı ekleme
- Kullanıcı düzenleme (ayrı sayfa)
- Kullanıcı silme
- Rol atama

**Alanlar:**
- Ad Soyad
- E-posta
- Rol
- Şifre (oluşturmada)

### 5.10 Çalışanlar (Staff) Sayfası

**İşlevler:**
- Personel listesi
- Lokasyon-personel ataması
- Atama düzenleme/silme

**Atama Alanları:**
- Kullanıcı seçimi
- Lokasyon seçimi
- Başlangıç/Bitiş tarihi

---

## 6. PUBLIC (GENEL) SAYFALAR

| Sayfa | Route | Açıklama |
|-------|-------|----------|
| Self-Service Rezervasyon | `/self-service` | Müşteri kendi rezervasyonu sorgular |
| Widget Demo | `/widget-demo` | Widget test sayfası |
| MagicPay Demo | `/payments/magicpay/demo/:sessionId` | Ödeme demo sayfası |

### 6.1 Widget Sistemi

Oteller web sitelerine embed edebilecekleri bir rezervasyon widget'ı kullanabilir.

**Widget URL:** `https://kyradi-saas-canli.vercel.app/widgets/kyradi-reserve.js`

**Embed Kodu:**
```html
<div id="kyradi-widget" data-tenant="otel-slug"></div>
<script src="https://kyradi-saas-canli.vercel.app/widgets/kyradi-reserve.js"></script>
```

**Widget Akışı:**
1. Müşteri tarih ve bagaj sayısı seçer
2. Fiyat hesaplanır
3. İletişim bilgileri girilir
4. Sözleşme kabul edilir (scroll ile)
5. Ödeme yapılır
6. Rezervasyon oluşturulur
7. QR kod gösterilir

---

## 7. VERİTABANI MODELLERİ

### 7.1 Ana Modeller

| Model | Tablo | Açıklama |
|-------|-------|----------|
| Tenant | `tenants` | Otel/işletme |
| User | `users` | Kullanıcı |
| Location | `locations` | Fiziksel lokasyon |
| Storage | `storages` | Depolama birimi |
| Reservation | `reservations` | Rezervasyon |
| Payment | `payments` | Ödeme |
| Settlement | `settlements` | Hakediş |
| Staff | `staff` | Personel ataması |
| Ticket | `tickets` | Destek talebi |
| PricingRule | `pricing_rules` | Fiyat kuralı |
| AuditLog | `audit_logs` | Denetim kaydı |

### 7.2 Model Detayları

#### Tenant (Otel)
```
id: UUID
name: String (Otel adı)
slug: String (URL için unique id)
legal_name: String (Yasal unvan)
is_active: Boolean
metadata: JSONB
created_at, updated_at: DateTime
```

#### User (Kullanıcı)
```
id: UUID
tenant_id: UUID (FK → tenants)
email: String (unique)
password_hash: String
full_name: String
role: UserRole enum
is_active: Boolean
created_at, updated_at: DateTime
```

#### Location (Lokasyon)
```
id: UUID
tenant_id: UUID (FK → tenants)
name: String
address: String
city: String
district: String
phone_number: String
latitude, longitude: Float
working_hours: JSONB
is_active: Boolean
created_at, updated_at: DateTime
```

#### Storage (Depo)
```
id: UUID
tenant_id: UUID (FK → tenants)
location_id: UUID (FK → locations)
name: String
capacity: Integer
size_type: String (small/medium/large)
status: StorageStatus enum
price_per_hour: Decimal
is_active: Boolean
created_at, updated_at: DateTime
```

#### Reservation (Rezervasyon)
```
id: UUID
tenant_id: UUID (FK → tenants)
storage_id: UUID (FK → storages)
reservation_code: String (unique)
customer_name: String
customer_email: String
customer_phone: String
check_in: DateTime
check_out: DateTime
luggage_count: Integer
status: ReservationStatus enum
total_price: Decimal
qr_code: String
notes: Text
created_at, updated_at: DateTime
```

#### Payment (Ödeme)
```
id: UUID
tenant_id: UUID (FK → tenants)
reservation_id: UUID (FK → reservations)
amount_minor: Integer (kuruş cinsinden)
currency: String (TRY)
status: PaymentStatus enum
provider: PaymentProvider enum
payment_mode: PaymentMode enum
transaction_id: String
created_at, updated_at: DateTime
```

#### Ticket (Destek Talebi)
```
id: UUID
tenant_id: UUID (FK → tenants, nullable)
creator_id: UUID (FK → users)
title: String
message: Text
status: TicketStatus enum
priority: TicketPriority enum
target: TicketTarget enum
resolved_at: DateTime
resolved_by_id: UUID (FK → users)
resolution_note: Text
read_at: DateTime
created_at, updated_at: DateTime
```

---

## 8. API ENDPOINT'LERİ

### 8.1 Kimlik Doğrulama (`/auth`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/auth/login` | POST | Giriş |
| `/auth/logout` | POST | Çıkış |
| `/auth/me` | GET | Mevcut kullanıcı |
| `/auth/refresh` | POST | Token yenile |
| `/auth/password-reset/request` | POST | Şifre sıfırlama iste |
| `/auth/password-reset/verify-code` | POST | Kod doğrula |
| `/auth/password-reset/reset` | POST | Şifre değiştir |

### 8.2 Admin Endpoint'leri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/admin/tenants` | GET | Otel listesi |
| `/admin/tenants` | POST | Otel oluştur |
| `/admin/tenants/{id}` | GET | Otel detay |
| `/admin/tenants/{id}` | PUT | Otel güncelle |
| `/admin/tenants/{id}` | DELETE | Otel sil |
| `/admin/users` | GET | Tüm kullanıcılar |
| `/admin/users` | POST | Kullanıcı oluştur |
| `/admin/users/{id}` | PUT | Kullanıcı güncelle |
| `/admin/users/{id}` | DELETE | Kullanıcı sil |

### 8.3 Lokasyonlar (`/locations`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/locations` | GET | Lokasyon listesi |
| `/locations` | POST | Lokasyon oluştur |
| `/locations/{id}` | GET | Lokasyon detay |
| `/locations/{id}` | PUT | Lokasyon güncelle |
| `/locations/{id}` | DELETE | Lokasyon sil |

### 8.4 Depolar (`/storages`, `/lockers`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/storages` | GET | Depo listesi |
| `/storages` | POST | Depo oluştur |
| `/storages/{id}` | GET | Depo detay |
| `/storages/{id}` | PUT | Depo güncelle |
| `/storages/{id}` | DELETE | Depo sil |
| `/storages/{id}/availability` | GET | Müsaitlik bilgisi |

### 8.5 Rezervasyonlar (`/reservations`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/reservations` | GET | Rezervasyon listesi |
| `/reservations` | POST | Rezervasyon oluştur |
| `/reservations/{id}` | GET | Rezervasyon detay |
| `/reservations/{id}` | PUT | Rezervasyon güncelle |
| `/reservations/{id}/status` | PATCH | Durum değiştir |
| `/reservations/{id}/cancel` | POST | İptal et |

### 8.6 Ödemeler (`/payments`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/payments` | GET | Ödeme listesi |
| `/payments/{id}` | GET | Ödeme detay |
| `/payments/create-session` | POST | Ödeme oturumu oluştur |

### 8.7 QR Doğrulama (`/qr`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/qr/verify` | POST | QR kod doğrula |
| `/qr/checkin` | POST | Check-in yap |
| `/qr/checkout` | POST | Check-out yap |

### 8.8 Ticket'lar (`/tickets`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/tickets` | GET | Ticket listesi (partner) |
| `/tickets` | POST | Ticket oluştur |
| `/tickets/{id}` | GET | Ticket detay |
| `/tickets/{id}` | PATCH | Ticket güncelle |
| `/tickets/admin/all` | GET | Tüm ticket'lar (admin) |

### 8.9 Fiyatlandırma (`/pricing`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/pricing/rules` | GET | Fiyat kuralları |
| `/pricing/rules` | POST | Kural oluştur |
| `/pricing/rules/{id}` | PUT | Kural güncelle |
| `/pricing/rules/{id}` | DELETE | Kural sil |
| `/pricing/calculate` | POST | Fiyat hesapla |

### 8.10 Raporlar (`/reports`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/reports/summary` | GET | Özet rapor |
| `/reports/revenue` | GET | Gelir raporu |
| `/reports/reservations` | GET | Rezervasyon raporu |
| `/reports/storage-usage` | GET | Depo kullanım raporu |

### 8.11 Gelir & Hakedişler (`/revenue`, `/settlements`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/revenue/summary` | GET | Gelir özeti |
| `/settlements` | GET | Hakediş listesi |
| `/settlements/{id}` | GET | Hakediş detay |

### 8.12 Personel (`/staff`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/staff` | GET | Personel listesi |
| `/staff` | POST | Personel ata |
| `/staff/{id}` | DELETE | Atama kaldır |

### 8.13 Widget API (`/widget`)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/widget/public/config/{tenant}` | GET | Widget config |
| `/widget/public/availability` | POST | Müsaitlik sorgula |
| `/widget/public/estimate` | POST | Fiyat tahmini |
| `/widget/public/reserve` | POST | Rezervasyon oluştur |

### 8.14 Health Check

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/health` | GET | Sistem durumu |

---

## 9. FRONTEND SERVİSLERİ

### 9.1 Admin Servisleri

| Servis | Dosya | Açıklama |
|--------|-------|----------|
| tenantService | `admin/tenants.ts` | Otel CRUD |
| adminUserService | `admin/tenantUsers.ts` | Kullanıcı CRUD |
| adminTicketService | `admin/tickets.ts` | Ticket yönetimi |
| auditService | `admin/audit.ts` | Denetim logları |
| adminReportService | `admin/reports.ts` | Raporlar |

### 9.2 Partner Servisleri

| Servis | Dosya | Açıklama |
|--------|-------|----------|
| locationService | `partner/locations.ts` | Lokasyon CRUD |
| storageService | `partner/storages.ts` | Depo CRUD |
| reservationService | `partner/reservations.ts` | Rezervasyon CRUD |
| paymentService | `partner/payments.ts` | Ödeme işlemleri |
| staffService | `partner/staff.ts` | Personel atamaları |
| ticketService | `partner/tickets.ts` | Ticket'lar |
| pricingService | `partner/pricing.ts` | Fiyatlandırma |
| qrService | `partner/qr.ts` | QR doğrulama |
| revenueService | `partner/revenue.ts` | Gelir bilgileri |
| reportService | `partner/reports.ts` | Raporlar |
| userService | `partner/users.ts` | Kullanıcı yönetimi |
| settingsService | `partner/settings.ts` | Otel ayarları |

### 9.3 Public Servisleri

| Servis | Dosya | Açıklama |
|--------|-------|----------|
| publicPricingService | `public/pricing.ts` | Fiyat hesaplama |
| publicReservationService | `public/reservations.ts` | Widget rezervasyon |

### 9.4 Auth Servisi

| Servis | Dosya | Açıklama |
|--------|-------|----------|
| authService | `auth.ts` | Giriş/çıkış/şifre işlemleri |

---

## 10. ENUM DEĞERLERİ

### 10.1 UserRole (Kullanıcı Rolleri)

| Değer | Açıklama |
|-------|----------|
| `super_admin` | Sistem süper admin |
| `support` | Destek ekibi |
| `hotel_manager` | Otel müdürü |
| `tenant_admin` | Tenant admin (backward compat.) |
| `storage_operator` | Depo görevlisi |
| `accounting` | Muhasebe |
| `staff` | Personel |
| `viewer` | Görüntüleyici |

### 10.2 ReservationStatus (Rezervasyon Durumu)

| Değer | Açıklama |
|-------|----------|
| `reserved` | Rezerve edildi |
| `active` | Aktif (bagaj bırakıldı) |
| `completed` | Tamamlandı |
| `cancelled` | İptal edildi |
| `no_show` | Gelmedi |
| `lost` | Kayıp bagaj |

### 10.3 PaymentStatus (Ödeme Durumu)

| Değer | Açıklama |
|-------|----------|
| `pending` | Beklemede |
| `authorized` | Yetkilendirildi |
| `captured` | Yakalandı |
| `paid` | Ödendi |
| `failed` | Başarısız |
| `cancelled` | İptal |
| `refunded` | İade edildi |

### 10.4 PaymentProvider (Ödeme Sağlayıcı)

| Değer | Açıklama |
|-------|----------|
| `MAGIC_PAY` | MagicPay |
| `POS` | POS cihazı |
| `FAKE` | Demo/test |

### 10.5 PaymentMode (Ödeme Modu)

| Değer | Açıklama |
|-------|----------|
| `POS` | POS ile ödeme |
| `CASH` | Nakit |
| `GATEWAY_DEMO` | Demo gateway |
| `GATEWAY_LIVE` | Canlı gateway |

### 10.6 StorageStatus (Depo Durumu)

| Değer | Açıklama |
|-------|----------|
| `idle` | Boş |
| `occupied` | Dolu |
| `faulty` | Arızalı |

### 10.7 TicketStatus (Ticket Durumu)

| Değer | Açıklama |
|-------|----------|
| `open` | Açık |
| `in_progress` | İşlemde |
| `resolved` | Çözüldü |
| `closed` | Kapatıldı |

### 10.8 TicketPriority (Ticket Önceliği)

| Değer | Açıklama |
|-------|----------|
| `low` | Düşük |
| `medium` | Orta |
| `high` | Yüksek |
| `urgent` | Acil |

### 10.9 TicketTarget (Ticket Hedefi)

| Değer | Açıklama |
|-------|----------|
| `admin` | Admin'e |
| `partner` | Partner'a |
| `all` | Herkese |

---

## 11. TEKNİK ALTYAPI

### 11.1 Backend

- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.0 (async)
- **Database:** PostgreSQL
- **Auth:** JWT tokens
- **Migration:** Alembic
- **Validation:** Pydantic v2

### 11.2 Frontend

- **Framework:** React 18
- **Build:** Vite
- **Language:** TypeScript
- **State:** React Query (TanStack)
- **Forms:** React Hook Form + Zod
- **Styling:** CSS Modules
- **HTTP:** Axios
- **Router:** React Router v6

### 11.3 Deployment

- **Backend:** Railway
- **Frontend:** Vercel
- **Database:** Railway PostgreSQL

### 11.4 Environment Variables

**Backend:**
```
DATABASE_URL=postgresql+asyncpg://...
JWT_SECRET=...
JWT_ALGORITHM=HS256
CORS_ORIGINS=["https://kyradi-saas-canli.vercel.app"]
ENVIRONMENT=production
```

**Frontend:**
```
VITE_API_URL=https://kyradi-saas-canli-production.up.railway.app
```

---

## 📝 TEST SENARYOLARI İÇİN ÖNEMLİ NOKTALAR

### Giriş Testleri
1. Partner girişi (geçerli/geçersiz)
2. Admin girişi (geçerli/geçersiz)
3. Şifre sıfırlama akışı
4. Yanlış şifre 3+ deneme (varsa rate limit)

### Lokasyon Testleri
1. Yeni lokasyon ekleme
2. Harita ile konum seçimi
3. Çalışma saatleri ekleme (çoklu aralık)
4. Lokasyon düzenleme
5. Lokasyon silme

### Depo Testleri
1. Depo oluşturma
2. Kapasite ayarlama
3. Müsaitlik takvimi görüntüleme
4. Durum değiştirme

### Rezervasyon Testleri
1. Widget üzerinden rezervasyon
2. Durum değişiklikleri
3. QR doğrulama
4. İptal işlemi
5. Ödeme akışı

### Ticket Testleri
1. Partner ticket oluşturma
2. Admin ticket görüntüleme
3. Ticket çözme/kapatma

### Yetki Testleri
1. Admin sayfalarına yetkisiz erişim
2. Partner sayfalarına yetkisiz erişim
3. Rol bazlı sayfa erişimi

---

**Doküman Sonu**
