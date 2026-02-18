# KYRADI-SAAS Domain Kurulum Rehberi

Tarih: 18 Şubat 2026  
Kapsam: `app.kyradi.com`, `admin.kyradi.com`, `{tenant}.kyradi.com` ve custom domain

## 1) Mimari Özeti

- Frontend: Vercel (`app/admin/tenant hostları`)
- Backend API: Railway
- Auth: Cookie tabanlı (`access_token`, `Domain=.kyradi.com`, `HttpOnly`, `Secure`, `SameSite=Lax`)
- Multi-tenant çözümleme: Host/subdomain üzerinden tenant resolver

## 2) DNS Gereksinimleri

Kök domain örneği: `kyradi.com`

Zorunlu kayıtlar:

1. `app.kyradi.com` -> Vercel target
2. `admin.kyradi.com` -> Vercel target
3. `*.kyradi.com` (wildcard) -> Vercel target

Not:
- Wildcard tenant subdomainleri (`demo-hotel.kyradi.com`) için gereklidir.
- DNS propagation tamamlanmadan auth ve tenant çözümleme tutarsız olabilir.

## 3) Vercel Domain Ayarı

1. Vercel proje ayarlarında domainleri ekleyin:
   - `app.kyradi.com`
   - `admin.kyradi.com`
   - `*.kyradi.com`
2. SSL/TLS sertifikalarının `Valid` olduğundan emin olun.
3. Frontend `vercel.json` rewrite kuralları API pathlerini backend’e yönlendirmeli, SPA pathleri `index.html` fallback olmalı.

## 4) Railway / Backend Ayarı

1. API public URL doğrulayın (ör. `https://kyradi-saas-canli-production.up.railway.app`)
2. CORS allow list içinde en az:
   - `https://app.kyradi.com`
   - `https://admin.kyradi.com`
   - tenant hostları (`https://*.kyradi.com`) için middleware/pattern
3. Proxy header ve HTTPS şeması doğru çalışmalı (http redirect üretmemeli).

## 5) Auth Cookie Standardı (Prod)

Backend set-cookie standardı:

- `key=access_token`
- `HttpOnly=true`
- `Secure=true`
- `Path=/`
- `Domain=.kyradi.com` (kyradi subdomainleri arası paylaşım için)
- `SameSite=Lax`

Custom domain notu:
- Custom domain (`hotel-x.com`) için `.kyradi.com` cookie geçmez.
- Bu durumda host-only cookie + token exchange akışı gerekir.

## 6) Tenant Subdomain Yönlendirme

Hedef akış:

1. Kullanıcı `app.kyradi.com` üzerinden partner login olur.
2. Login sonrası `/auth/me` başarılı doğrulanır.
3. Tenant slug’a göre `https://{tenant}.kyradi.com/app` yönlendirilir.
4. Tenant host üzerinde `/auth/me` stabil `200` dönmelidir.

## 7) Doğrulama Komutları

### 7.1 Cookie jar ile login ve cross-subdomain me kontrolü

```bash
curl -i -c /tmp/cj.txt -X POST "https://app.kyradi.com/auth/partner/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"***"}'

curl -i -b /tmp/cj.txt "https://app.kyradi.com/auth/me"
curl -i -b /tmp/cj.txt "https://demo-hotel.kyradi.com/auth/me"
```

Beklenen:
- Login: `200`
- `app/auth/me`: `200`
- `tenant/auth/me`: `200`

### 7.2 Otomatik smoke script

```bash
SAAS_BASE_URL="https://app.kyradi.com" \
PARTNER_EMAIL="admin@demo.com" \
PARTNER_PASSWORD="***" \
ADMIN_EMAIL="superadmin@kyradi.com" \
ADMIN_PASSWORD="***" \
./scripts/smoke_e2e.sh
```

## 8) Sık Hata ve Çözüm

1. `Tenant not found for custom domain`  
   - Host yanlış projeye düşüyor olabilir, DNS/Vercel domain eşleşmesini kontrol edin.

2. `GET /auth/me 401` dalgalanması  
   - Cookie propagation race olabilir; frontend retry/grace akışının deploy edildiğini doğrulayın.

3. `Not Found` dönüşleri  
   - Rewrite path/backend route prefix eşleşmesini kontrol edin.

## 9) Yayın Öncesi Kısa Checklist

1. DNS kayıtları aktif
2. Vercel domainler `Valid`
3. Railway API erişilebilir
4. `app` ve `admin` login çalışıyor
5. tenant yönlendirme doğru hosta gidiyor
6. `/auth/me` hem app hem tenant hostta `200`
7. Smoke script PASS

## 10) Rollback

Sorun durumunda:

1. Yeni rewrite kuralı varsa önce geri alın.
2. Cookie domain/samesite değişikliği yapıldıysa bir önceki sürüme dönün.
3. Frontend son commit rollback ile önce auth akışını stabilize edin.
4. DNS değişikliklerinde eski kayıtları restore edip propagation bekleyin.

