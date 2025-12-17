# KYRADİ – SaaS Projesi Mimari ve Teknik Doküman

Bu doküman; KYRADİ platformunun mimari prensiplerini, teknik bileşenlerini, veri modelini, API sözleşmelerini ve sürüm planını özetler. Amaç, backend (FastAPI), frontend (React) ve PostgreSQL veritabanı üzerinde inşa edilen SaaS çözümünün hem ürün geliştirme ekibine hem de operasyon tarafına rehberlik etmesidir.

## Giriş
- **Kapsam**: Partner Paneli (lokasyon operasyonları) ve Admin Paneli (merkezi yönetim) dahil olmak üzere tüm SaaS katmanları.
- **Hedef**: 4–5 günlük MVP geliştirme sürecini destekleyecek net gereksinim seti ve teknik yönlendirme sağlamak.
- **Varsayımlar**: Ekip FastAPI, React, PostgreSQL ve Docker teknolojilerine hâkim; temel altyapı (CI/CD, izleme) sprint sonrası kademeli olarak tamamlanacak.

## 1. Mimari Genel Bakış

### Backend (FastAPI + PostgreSQL)
- Çok kiracılı (multi-tenant) mimari; her API çağrısında tenant izolasyonu.
- JWT tabanlı kimlik doğrulama; access token hazır, refresh/MFA roadmap'te.
- Audit log ve ödeme intent altyapısı (Stripe/Iyzico stub) çekirdek parçalar olarak ele alınır.
- FastAPI + SQLAlchemy (async) + PostgreSQL; Alembic migration yapısı, seed script ve test veritabanı desteği.

### Frontend (React + React Query)
- Partner ve admin panelleri için ayrı yönlendirme akışları, role bazlı guard yapılandırması.
- Axios interceptor ile token yönetimi, React Query ile veri önbellekleme ve hata yakalama.
- Form yönetimi: React Hook Form + Zod; toast/tabanlı bildirim altyapısı.

### Operasyonel Katman
- Migration/test/CI pipeline'ları, observability, dağıtım ve dokümantasyon süreçleri aynı sprintte kurgulanır.
- Docker tabanlı local geliştirme; GitHub Actions ile lint/test/build otomasyonu, Sentry & monitor entegrasyonları.

### Self-Service/Müşteri Katmanı (Sonraki Sprintler)
- QR kodlu rezervasyon oluşturma ve yönetim web deneyimi.
- Ödeme, teslim alma ve durum takip ekranları; PWA/mobil uygulama roadmap'te.

## 2. Backend Detaylı Yol Haritası

### 2.1 Auth & RBAC
- JWT access/refresh çifti; access hazır, refresh/MFA sonraki faz.
- Şifre sıfırlama ve MFA akışları için altyapı gereksinimleri backlog'da.
- Kullanıcı CRUD: SuperAdmin → tenant admin (oluşturur), tenant admin → staff/viewer bölümlenir; her aksiyon audit'lenir.

### 2.2 Tenant Yönetimi
- Tenant kayıtlarında tutulacak alanlar: `slug`, `plan`, `status`, marka rengi/logo URL.
- Plan limitlerini (dolap/rezervasyon) enforce edecek kontrol katmanı roadmap'te; uyarı ve bloklama stratejileri belirlenecek.
- Admin audit log üzerinden yapılan tüm değişikliklerin kaydı mevcut; destek araçları için arama/filtre ekleri planlanır.

### 2.3 Depo / Dolap Modeli
- `locations`: Şube/depo bilgisi; coğrafi koordinat alanı opsiyonel.
- `lockers`: Dolap/emanet rafı; IoT alanları (device_id, firmware) için nullable alanlar.
- `reservations`: `start_date` / `end_date` beklenti; `status` geçişleri otomatize; `qr_code` string + metadata.
- `payments`: Ödeme intent tablosu; sağlayıcı kimliği, durum, webhook correlation alanları.
- `audit_logs`: Her kritik değişiklik için entity referansı, actor, action ve JSON metadata.

### 2.4 Rezervasyon İş Akışı
- Partner kullanıcıları müşteri bilgisiyle rezervasyon oluşturur (`POST /reservations`); sistem QR kod üretir.
- QR doğrulama (`POST /qr/verify`) veya manuel onay ile teslim süreci tetiklenir; statüler idle ↔ occupied.
- Rezervasyon iptal/tamamla işlemleri audit log ve raporlamaya bağlıdır; ödeme intent tetiklenir.
- Ödeme sağlayıcı webhook'ları için endpoint stub mevcut; gerçek entegrasyon sonraki sprintlerde tamamlanır.

### 2.5 Raporlama ve Dashboard
- Partner raporu: aktif rezervasyon, doluluk, günlük gelir; tenant bazlı datalar.
- Admin raporu: tenant bazlı gelir ve rezervasyon sayısı (mevcut); tarih aralığı ve trend grafikleri roadmap'te.
- Audit log filtreleri (tenant, action, tarih) ve CSV/Excel export sonraki iterasyonlarda eklenecek.

### 2.6 Depolama ve Yedekleme
- PostgreSQL için yedek politikası; otomatik snapshot + manuel restore prosedürü.
- Dosya depolama (logo, belge) için S3/MinIO entegrasyonu opsiyonel olarak değerlendirilir.
- PII alanları için maskeleme ve at-rest şifreleme; gizlilik politikalarına uyum.

## 3. Frontend Detayları

### 3.1 Ortak Altyapı
- React Query + Axios interceptors; otomatik retry/refresh stratejileri belirlenecek.
- Yetki kontrolü için role guard bileşenleri ve route bazlı layout'lar.
- Form bileşenleri: React Hook Form + Zod, reusable input/validation pattern'ları; toast bildirimleri.
- Tasarım şu an custom CSS; Tailwind veya Chakra UI'e geçiş stratejik değerlendirmede.

### 3.2 Partner Paneli
- Dashboard: Aktif rezervasyon, doluluk, gelir kartları; liste filtreleme ile entegre.
- Lokasyon Yönetimi: CRUD + filtreler + paginasyon; harita gösterimi opsiyon olarak backlog'da.
- Dolap Yönetimi: Status filtreleme (idle, occupied, faulty), bulk import/export (CSV) roadmap'te.
- Rezervasyon Yönetimi: Liste + durum filtreleri; rezervasyon oluşturma formu; QR kod görüntüleme; iptal/tamamlama aksiyonları; ödeme intent modalı.
- QR doğrulama ve bavul teslim onayı ekranları; mobil uyum ve offline senaryolar (opsiyonel).
- User yönetimi: Tenant admin tarafından staff/viewer ekleme (backend uçları hazır).

### 3.3 Admin Paneli
- Genel bakış dashboard'u: tenant health ve gelir kartları; trend grafikleri uzun vadede.
- Tenant Yönetimi: Listeleme, plan/durum güncelleme, marka ayarları, limitler.
- Audit Log: Temel liste bugün mevcut; tarih ve action filtreleri, JSON detay popover ve export roadmap'te.
- Support araçları: Tenant impersonation, manuel rezervasyon iptali, ödeme yeniden deneme (roadmap); SLA ihlali bildirimleri Slack/email entegrasyonu ile planlanır.

## 4. Müşteri/Self-Service Katmanı (Roadmap)
- QR kod linki ile self-service web sayfası üzerinden rezervasyon oluşturma (checkout + ödeme) akışı.
- Rezervasyon durum izleme, iptal talebi ve teslim alma ekranları; imza ve fotoğraf yükleme opsiyonları.
- Mobil cihaz uyumluluğu ve olası PWA/Native uygulama sonraki planlarda yer alır.
- Müşteri katmanındaki aksiyonlar audit log ve payment süreçlerine entegre edilir.

## 5. Operasyonel İşler

### 5.1 Test ve Kalite
- Backend: Pytest + HTTPX; unit ve entegrasyon testleri; pytest-postgresql ile izole DB.
- Frontend: React Testing Library + Cypress/Playwright; smoke test senaryoları.
- Sürekli entegrasyon: GitHub Actions pipeline; lint, test, build, deploy adımları; load test için k6 senaryoları planlanır.

### 5.2 Veritabanı Yönetimi
- Alembic migration setup (halihazırda `seed init_db` mevcut); migration policy: her PR migration ile gelmeli.
- Migration incelemeleri code review sürecine dahil; seed verileri tenant bazlı senaryoları kapsar.

### 5.3 Dağıtım ve İzleme
- Dockerfile + docker-compose; staging/prod ortamları Render/Fly.io/AWS ECS kombinasyonları.
- Frontend dağıtımı için Vercel/Netlify değerlendiriliyor; CDN önbellekleme planı.
- İzleme: Sentry (frontend/backend), Prometheus/Grafana (opsiyon); log yönetimi JSON formatında, retention politikası belirlenecek.

### 5.4 Dokümantasyon & Eğitim
- FastAPI Swagger ve Postman koleksiyonu ile API dokümantasyonu.
- Partner/admin kullanıcı dokümanları ve iç süreç runbook'ları hazırlanır.

## 6. Depo Senaryosu İçin Süreç Akışı (Örnek)
- Admin paneli üzerinden otele ait tenant oluşturulur.
- Tenant admin lokasyon (depo) ve dolap/slot bilgilerini tanımlar.
- Partner personeli rezervasyon formu ile müşteri bilgisi girer; sistem QR kod üretir ve paylaşır.
- Müşteri QR kodu veya kimlik ile geldiğinde doğrulama yapılır, bavul teslim edilir, dolap statüsü `occupied` olur.
- Bavul geri alındığında rezervasyon `complete`, dolap `idle` durumuna geçer; audit log ve raporlar güncellenir.
- Opsiyonel: Ödeme intent tetiklenir; gerçek ödeme süreci sonraki fazlarda tamamlanır.
- Admin tüm tenant'ların durumunu izler, audit log ve raporlardan süreçleri takip eder.

## 7. Roadmap Özet
- MVP finalize: Kullanıcı yönetimi, self-service rezervasyon linki altyapısı, raporlama modülü.
- Ödeme & Faturalandırma: Stripe/Iyzico tam entegrasyon, otomatik fatura (PDF).
- IoT/Depo Gelişimi: Raf takibi, durum güncelleme, IoT entegrasyonu.
- Mobil/Teslim Uygulaması: PWA/Native client geliştirme.
- Analitik & Bildirim: SLA alarmı, doluluk forecast, Slack/Email entegrasyonu.
- Güvenlik & Compliance: MFA, audit export, log retention, KVKK/GDPR uyumluluğu.
- DevOps: Full CI/CD, IaC, monitoring dashboard'ları.

## 8. Sistem Özeti
- KYRADİ; otel, havaalanı ve AVM gibi işletmelerin kendi emanet dolaplarını yönetmelerini sağlayan çok kiracılı SaaS platformudur.
- Her müşteri `tenant` olarak temsil edilir; partner paneli üzerinden günlük operasyonlar yürütülür, admin paneli Aparial ekibine merkezi yönetim olanağı sağlar.
- Ana iş akışları: QR kod ile dolap rezervasyonu, ödemelerin provizyonu, audit ve raporlama, lisans ve plan yönetimi.

## 9. Ana Bileşenler

### 9.1 Partner Paneli
- Lokasyon, dolap ve rezervasyon yönetimi için responsive dashboard.
- QR kod üretme/doğrulama, ödeme intent yönetimi ve temel rapor kartları.
- Tenant bazlı özelleştirme: logo, renk paleti, alt alan adı desteği (MVP'de tema değişimi).

### 9.2 Admin Paneli
- Tenant kayıt/aktivasyon, plan tanımları ve sistem lisans yönetimi.
- Tüm tenantlara ait metrik özetleri, gelir analizi ve audit log görüntüleme.
- Destek süreçleri için manuel müdahale araçları (rezervasyon iptali, yeniden tetikleme vb.).

## 10. Mimari Yaklaşım

- **Topoloji**: Üç katmanlı (frontend, backend, veritabanı) + yardımcı servisler (queue, object storage, izleme).
- **İletişim**: Frontend ile backend REST API üzerinden, üçüncü parti ödeme sağlayıcıları ile webhooks üzerinden haberleşir.
- **Dağıtım**: Konteyner temelli; staging ve production ayrı ortamlar, çevresel değişkenler aracılığıyla yapılandırma.

### 10.1 Backend Katmanı
- **Teknolojiler**: FastAPI, SQLAlchemy (async), Alembic, Pydantic, Redis (opsiyonel cache), Celery (gelecek faz).
- **Modüller**:
  - `auth`: JWT tabanlı oturum açma, refresh token, tenant slug doğrulama.
  - `tenants`: tenant CRUD, plan yönetimi, lisanslama.
  - `locations`, `lockers`, `reservations`: temel iş akışı modülleri.
  - `payments`: Stripe / Iyzico adaptörleri, webhook sonlandırıcıları.
  - `reports` ve `audit`: özet metrikler ve log kayıtları.
- **Katmanlama**: Router → Service → Repository → Model; domain servislerinde tenant doğrulamaları zorunlu.
- **Performans**: Async IO, query optimizasyonu (selectinload), kritik listeler için sayfalama.

### 10.2 Frontend Katmanı
- **Teknolojiler**: React (Vite), TypeScript, React Router, Axios, Zustand/Context API.
- **Mimari**:
  - Çok panelli yapı: `/app` (tenant) ve `/admin` (merkez) için yönlendirme.
  - UI bileşen kütüphanesi: Tailwind veya Chakra UI (karar sprint 1'de).
  - Token yönetimi: HTTP interceptor ile access token, refresh flow (gelecek faz).
- **Özelleştirme**: Tenant bazlı tema context’i, logo/kısa ad ile header uyarlaması.

### 10.3 Veritabanı Katmanı
- PostgreSQL 14+, tek şema; tüm tablo satırlarında `tenant_id`.
- UUID primary key kullanımı; tarih alanları `TIMESTAMP WITH TIME ZONE`.
- Alembic migration pipeline; seed script ile demo tenant ve kullanıcı oluşturma.
- İlerleyen fazda TIMESCALE veya materialized view ile raporlama hızlandırma opsiyonu.

## 11. Çok Kiracılı (Multi-tenant) Tasarım
- **Tenant Context**: Girişte `tenant_slug` alınır, `tenant_id` resolve edilerek request context'ine aktarılır.
- **Veri İzolasyonu**: Repository seviyesinde zorunlu `tenant_id` filtrelemesi; Admin API'leri hariç cross-tenant erişim yok.
- **Marka Özelleştirmesi**: `tenants.brand_color`, `tenants.logo_url` alanları üzerinden frontend teması.
- **Sözleşmeler**: Payment sağlayıcılarında tenant bazlı API anahtarları saklanmaz; global hesap + metadata kullanılır (MVP).
- **Gelecek**: Kurumsal müşteriler için ayrı schema (schema-per-tenant) veya read replica desteği değerlendirilir.

## 12. Roller ve Yetkilendirme

| Rol | Panel | Yetkiler | Notlar |
| --- | --- | --- | --- |
| SuperAdmin | Admin | Tüm tenant yönetimi, plan/limit konfigürasyonu, audit görüntüleme | Aparial çekirdek ekip |
| Support | Admin | Tenant okuma, rezervasyon iptali, sınırlı CRUD | Operasyon destek |
| TenantAdmin | Partner | Lokasyon, dolap, rezervasyon, ödeme, kullanıcı yönetimi | Her tenantta en az bir kullanıcı |
| Staff | Partner | Aktif rezervasyon işlemleri, QR doğrulama, dolap durumu güncelleme | Mobil/tablet odaklı |
| Viewer | Partner/Admin | Read-only dashboard ve raporlar | Yöneticiye raporlama |
| Customer | Harici | QR/rezervasyon akışı, kimliksiz veya OTP tabanlı | MVP'de kayıt zorunlu değil |

- Yetkilendirme kontrolü FastAPI dependency katmanında yapılır; route bazlı izin listeleri merkezi bir `PermissionMatrix` içinde saklanır.

## 13. Fonksiyonel Gereksinimler

### 13.1 Partner Paneli
- **Kimlik Yönetimi**: Tenant slug + e-posta/şifre ile login, parolayı reset etme e-postası (MVP), 2FA sonraki faz.
- **Lokasyon Yönetimi**: CRUD, çalışma saatleri, koordinat; aktif/pasif durumu.
- **Dolap Yönetimi**: Dolap kodu, durumu (`idle`, `occupied`, `faulty`), seri ekleme; toplu import CSV (Next).
- **Rezervasyon Akışı**: Çakışma kontrolü, saat bazlı ücret hesaplama, durum güncelleme (aktif, iptal, tamamlandı).
- **QR İdaresi**: Tekil QR üretimi, kısa süreli geçerlilik, offline fallback (gelecek faz).
- **Ödeme Intent**: Stripe/Iyzico stub; rezervasyon başına intent kaydı; webhook ile durumu güncelleme.
- **Kullanıcı Yönetimi**: TenantAdmin tarafından Staff/Viewer yaratma, rol atama, davet e-postası (Next).
- **Raporlama**: Dashboard kartları (doluluk, günlük işlem, ciro), tarih filtreli listeler (Next).
- **White-label**: Logo ve renk seçimi; subdomain yapılandırması sonraki fazda DNS entegrasyonu ile.

### 13.2 Admin Paneli
- **Tenant Yönetimi**: Tenant CRUD, plan atama, aktivasyon/deaktivasyon.
- **Abonelik**: Plan meta alanları (dolap limiti, kullanıcı limiti) saklama; kullanım hesaplama (Next).
- **Operasyon Gözlemi**: Tenant metrikleri, audit log arama, kritik alarmlar (Next).
- **Destek Araçları**: Rezervasyonları manuel iptal, kilit açma talimatı, webhook retry.
- **Entegrasyon**: Webhook logları inceleme, üçüncü parti servis anahtarları yönetimi.

## 14. Veri Modeli

| Tablo | Açıklama | Kritik Alanlar |
| --- | --- | --- |
| `tenants` | Müşteri işletmeler | `slug`, `name`, `plan`, `is_active`, `brand_color`, `logo_url` |
| `users` | Panel kullanıcıları | `tenant_id`, `email`, `password_hash`, `role`, `is_active` |
| `locations` | İşletme lokasyonları | `tenant_id`, `name`, `address`, `lat`, `lon` |
| `lockers` | Dolap cihazları | `tenant_id`, `location_id`, `code`, `status`, `last_seen_at` |
| `reservations` | Dolap rezervasyonları | `tenant_id`, `locker_id`, `customer_name`, `start_at`, `end_at`, `status`, `amount_minor`, `currency`, `qr_code` |
| `payments` | Ödeme kayıtları | `tenant_id`, `reservation_id`, `provider`, `provider_intent_id`, `status`, `amount_minor`, `currency` |
| `invoices` | Faturalama (Next) | `tenant_id`, `period_start`, `period_end`, `amount_minor`, `status` |
| `audit_logs` | Sistem olayları | `tenant_id`, `actor_user_id`, `action`, `entity`, `entity_id`, `meta_json` |

- **İndeksler**: `reservations (tenant_id, locker_id, start_at)` çakışma kontrolü için; `payments (provider_intent_id)` hızlı webhook eşleştirmesi.
- **İlişkiler**: Tüm yabancı anahtarlar `ON DELETE CASCADE`; audit loglar kritik işlemlerde transaction içi kaydedilir.

## 15. API Tasarımı
- **Standartlar**: JSON REST, hata yönetimi için `{"detail": "..."}` formatı; sayfalama parametreleri `page`, `page_size`.
- **Yetkilendirme**: Bearer JWT; Admin rotaları `X-Admin-Auth` verify middleware ile ek kontrol (SuperAdmin check).

### 15.1 Kimlik Doğrulama
- `POST /auth/login`: Email, şifre, `tenant_slug`; 200 → `access_token`, `token_type`.
- `POST /auth/refresh` (Next): Refresh token ile yeni access almak.
- `GET /me`: JWT doğrulama sonrası kullanıcı bilgisi; tenant ve rol döner.
- Kabul kriteri: Yanlış kombinasyon 401; inaktif tenant 403.

### 15.2 Admin API'leri
- `GET /admin/tenants`: Filtreleme (plan, aktiflik), sayfalama.
- `POST /admin/tenants`: Tenant oluşturma, varsayılan TenantAdmin daveti.
- `PATCH /admin/tenants/{id}`: Plan, durum, marka ayarları.
- `GET /admin/reports/summary`: Tenantlara göre revenue, aktif rezervasyonlar.
- `GET /admin/audit-logs`: Tarih, action ve tenant filtreleri.

### 15.3 Partner API'leri
- `GET /locations`, `POST /locations`, `PATCH/DELETE /locations/{id}`.
- `GET /lockers`, `POST /lockers`: status validasyonları; reserved dolap silinemez.
- `GET /reservations`: `status`, `from`, `to` query parametreleri; default son 7 gün.
- `POST /reservations`: Tarih aralığı çakışma kontrolü; başarılı rezervasyon `amount_minor`, `qr_code` döner.
- `POST /reservations/{id}/cancel`, `.../complete`: Durum geçiş kuralları enforced (aktif → iptal/tamamlandı).
- `POST /qr/verify`: QR kodu validasyon; invalid durumlar 422 yerine 200 + `valid: false`.


### 15.4 Ödeme ve Webhook API'leri
- `POST /payments/create-intent`: Reservation id, provider seçimi; response `payment_id`, `provider_intent_id`, `status`.
- `POST /webhooks/payments`: Provider payload; imza kontrolü, idempotency anahtarı (`provider_event_id`).
- Ödeme durumları: `pending`, `authorized`, `captured`, `failed`, `refunded`.

### 15.5 Raporlama ve Audit API'leri
- `GET /reports/summary`: Aktif rezervasyon sayısı, doluluk oranı, günlük gelir.
- `GET /reports/locker-usage` (Next): Dolap bazlı kullanım oranları.
- `GET /audit-logs`: Partner tarafında kendi tenant logları; Admin tüm tenantları görebilir.

## 16. Güvenlik
- **Kimlik Doğrulama**: JWT + refresh akışı (gelecek faz), parola saklama için Argon2.
- **Veri İzolasyonu**: Her sorguda `tenant_id` kontrolü; admin fonksiyonları role guard ile korunur.
- **İletişim**: Tüm ortamlarda HTTPS zorunlu, CORS whitelist tenant domainlerine göre dinamik.
- **Rate Limiting**: Auth, ödeme ve QR doğrulama uçları için Redis tabanlı limit.
- **Audit & Alerting**: Kritik eylemler audit log; başarısız ödeme webhookları için alarm.
- **Gizlilik**: PII alanları (telefon, e-posta) maskelenmiş loglama; gizlilik sözleşmeleri (Ekler).

## 17. DevOps ve Dağıtım
- **Containerization**: Backend için Dockerfile (Python slim), frontend için Vite build + Nginx.
- **Ortamlar**: `dev`, `staging`, `prod`; yapılandırma `.env` dosyaları ve secret manager.
- **CI/CD**: GitHub Actions (lint, test, build, deploy); Alembic migration komutları pipeline'a entegre.
- **Monitoring**: Sentry (uygulama hataları), Grafana + Prometheus (Next), uptime check (BetterStack).
- **Scaling**: Backend autoscaling (2→5 instance), veritabanı için read replica planı, Redis cache (oturum, rate limit).

## 18. Test ve Kalite Güvencesi
- **Backend**: Pytest ile unit ve integration testleri; test veritabanı olarak `postgres:15-alpine`.
- **Frontend**: React Testing Library ile component testleri, Playwright ile e2e (Next).
- **API Testleri**: Postman collection + Newman CI entegrasyonu.
- **Kalite Kriterleri**: Kod coverage %70 (MVP), kritik modüller (auth, reservations, payments) için zorunlu test.
- **Load Test**: k6 senaryoları (Next) ile rezervasyon ve QR uçlarının stres testi.

## 19. 4 Günlük Sprint Planı
- **Gün 1**: Proje iskeleti, Docker compose, PostgreSQL şeması, `auth` ve `tenants` modülleri.
- **Gün 2**: `locations`, `lockers`, `reservations` servisleri; çakışma kontrolü; temel testler.
- **Gün 3**: React giriş, dashboard, CRUD ekranları; tema context; API entegrasyonu.
- **Gün 4**: Ödeme stub, rapor kartları, hata düzeltme, Postman koleksiyonu, deploy notları.

## 20. Mentör Demo Akışı
- Mimari diyagram ve multi-tenant yaklaşımı; tenant slug → context akışı.
- Veritabanı ER diyagramı ve izolasyon stratejisi (tenant_id).
- Postman üzerinden Auth → Locations → Lockers → Reservations → QR → Payments uçlarının demo edilmesi.
- Admin panelde tenant oluşturma, plan güncelleme, audit inceleme.
- Soru-cevap: güvenlik, ölçeklenebilirlik, faturalama, white-label seçenekleri.

## 21. Yol Haritası (MVP → Next)
- **MVP**: Auth, tenant izolasyonu, lokasyon/dolap/rezervasyon CRUD, QR doğrulama, ödeme intent, rapor özet, audit.
- **Kısa Vade**: Plan limitleri, ödeme iade akışı, fatura PDF, webhook retry, temel telemetri.
- **Orta Vade**: SSO/2FA, IoT health monitoring, detaylı raporlama, SLA bildirimleri, mobil uygulama (React Native).
- **Uzun Vade**: Çoklu ödeme sağlayıcı entegrasyonu, gerçek zamanlı dashboard (WebSocket), yapay zekâ ile dolap tahminleri.

## 22. Riskler ve Azaltma Stratejileri
- **Ödeme Sağlayıcı Bağımlılığı**: Stripe/Iyzico değişiklikleri → Provider adapter katmanı, sözleşme testleri.
- **Tenant Veri Sızıntısı**: Yanlış sorgular → Repository seviyesinde zorunlu tenant filtresi, otomatik testler.
- **IoT Bağlantı Sorunları**: Dolap cihaz offline → Sağlık ping endpointleri (Next) ve alarm mekanizması.
- **Sprint Takvimi**: 4 gün sıkışık → Önceliklendirilmiş backlog, MVP kapsamını netleştirme.
- **Performans**: Yoğun rezervasyon saatlerinde API yükü → Rate limit, caching, read replica planı.

## 23. Ekler
- **A. Ortam Değişkenleri**: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_API_KEY`, `CORS_ALLOWED_ORIGINS`.
- **B. Postman Koleksiyonu**: `KYRADI_SaaS_Postman_Collection.json`, baseUrl `http://localhost:8000`.
- **C. Kullanılan Kütüphaneler**: FastAPI, SQLAlchemy, Alembic, Pydantic, React, Axios, Tailwind/Chakra.
- **D. Referans Diyagramlar**: ER diyagramı ve dağıtım çizimi (Miro, Lucidchart).


Sistem güvenlik testleri :
-Eklenecek kısımlar : 
1-refere kısmı ekleneecek sistem açıldığında url kısmında hangi sayfa açıksa o page ait adres bilgisi yazmakta bu da sistemin security bağlamında zayıflatmaktadır. 
