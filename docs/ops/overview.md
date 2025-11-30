# KYRADİ Operasyon Rehberi (Taslak)

## CI/CD Pipeline

- GitHub Actions workflow: `.github/workflows/ci.yml`
- İş akışı:
  1. Python 3.11 kurulumu, `pip install -e backend[dev]`
  2. Ruff lint + pytest (backend)
  3. Node 18 kurulumu, `npm install`, lint/test/build (frontend)
- Pipeline çıktıları:
  - Pull requestlerde otomatik kontrol
  - Push → main üzerinde engelleyici

## Ortamlar

- `local`: docker-compose (planlanıyor), Postgres ve Redis container
- `staging`: TBD (Render/Fly.io/AWS ECS); env var yönetimi için `.env.staging` taslağı oluşturulacak
- `production`: TBD; IaC planı (Terraform/Pulumi) backlog'da

## Deployment Akışı (plan)

1. Main branch → CI geçerliyse `docker build` + push
2. Staging ortamına manuel deploy
3. Smoke testler → onay sonrası prod release

## İzleme & Loglama

- Backend için Sentry DSN (env: `SENTRY_DSN_BACKEND`) eklenmeli
- Frontend için Sentry/Analytics paketi
- Prometheus/Grafana kurulumu: API için `/metrics` endpoint planı
- Loglar JSON format: `structlog` entegrasyonu backlog'da

## Backup & Migration

- Alembic migration pipeline henüz yazım aşamasında
- Postgres günlük snapshot (Managed DB → provider bazlı) planlanıyor
- Migration politikası: PR → migration → staging apply → prod apply

## Runbook / Destek

- Kullanıcı aktifleştirme script'i (`backend/app/scripts/reactivate_user.py`)
- Seed kullanıcılar: `admin@kyradi.com` (superadmin), `admin@demo.com` (tenant admin)
- Destek senaryoları (kilit açma, ödeme retry) → admin panel geliştirme aşamasında
- Tenant plan limitleri:
  - Standard: 5 lokasyon, 50 dolap, 100 aktif rezervasyon, 10 aktif kullanıcı, 50 self-service rezervasyon/24s.
  - Pro: 20 lokasyon, 200 dolap, 500 aktif rezervasyon, 40 aktif kullanıcı, 200 self-service rezervasyon/24s.
  - Enterprise: limitsiz.
- Admin panelden tenant kullanıcı oluşturma/düzenleme sırasında limit aşımı hata mesajı ile (403) bildirilir; gerektiğinde plan limitleri "Plan Limitlerini Kaydet" modülünden artırılabilir.
- Tenant kullanıcı parola reseti:
  1. Admin panel → Tenant Yönetimi → Detay → Kullanıcılar tablosunda ilgili satırdan **Parola Sıfırla**.
  2. Açılan modalda yeni parola girilir, işlem audit loglarına `admin.tenant.user.reset_password` olarak düşer.
- QR modal akışı:
  - Partner paneli ve self-service sayfası teslim/iadeyi modal formları üzerinden kaydeder; fotoğraf/not alanları audit log'a dahil edilir.
  - Self-service tarafında modallar, QR doğrulama kartındaki aksiyonlardan tetiklenir ve audit log'a `reservation.handover` / `reservation.return` olarak yansır.
- Self-service destek adımları:
  1. Misafir QR kodunu giriş alanından doğrular.  
     ![Self-service lookup ekranı](img/self-service-lookup.svg)
  2. “Depoya Teslim Ettim” veya “Emanetimi Teslim Aldım” butonları modal açar; kullanıcıdan kişi adı, açıklama ve opsiyonel URL/FOTO istenir.  
     ![Self-service modal örneği](img/self-service-modal.svg)
  3. Kaydetme sonrası modal kapanır ve ek bilgi kartta “Audit Notu” ve “Ek / Fotoğraf” satırlarında görüntülenir.
  4. Destek ekibi admin panelde Audit Log sayfasında Kaynak filtresini “Self-Service” seçerek ilgili kayıtları hızlıca ister.
- Limit hata yanıtları ve çözüm rehberi:
  - Toplam/aktif rezervasyon limiti: Partner dashboard’daki Plan Uyarıları kutusunda “Planı Yükselt” CTA’sı yer alır; gerekli görülürse admin panelden plan limitleri artırılır.
  - Rapor export limiti (`report.reservations.export`): CSV aktarımı sırasında kalan hak toasta bildirilir; limit 24 saatte sıfırlanır. Doküman bağlantısı partner dashboard’daki uyarıda bulunur.
  - Depolama limiti: Depolama kartından “Dosya temizliği rehberi” linki ile eski media temizliği yapılır.
  - Self-service kotası: Dashboard kartı kalan hakkı gösterir; limit dolduğunda admin panelde plan limitleri bölümünden değer artırılır veya destek ekibiyle iletişime geçilir.

> Bu doküman taslaktır; ortam/araçlar netleştikçe güncellenecek.

## Self-Service Akışları

- QR doğrulama: `POST /public/reservations/lookup`
- Depo teslim onayı: `POST /public/reservations/{code}/handover`
- İade/pickup onayı: `POST /public/reservations/{code}/return`
- Partner paneli eşleşen uçlar: `POST /reservations/{id}/handover`, `POST /reservations/{id}/return`
- Audit log aksiyonları: `reservation.handover`, `reservation.return`
