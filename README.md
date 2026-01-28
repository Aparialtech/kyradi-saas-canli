# Kyradi SaaS

## Admin: Tenant Domain Yönetimi (kısa)

1) Admin panelde tenant seçin ve **Domain Yönetimi** sayfasını açın.  
2) Custom domain ekleyin (ör. `panel.oteliniz.com`) veya subdomain oluşturun (ör. `oteliniz.kyradi.app`).  
3) **Verify** ile TXT kaydı talimatını alın:  
   - Name: `_kyradi-verify.<domain>`  
   - Value: `kyradi=<token>`  
4) DNS kaydı eklendikten sonra **Ben Ekledim / Kontrol Et** ile doğrulayın.  
5) Domain `VERIFIED` olduğunda tenant erişimi aktifleşir.

## Deploy notları

- `dnspython` bağımlılığı backend deploy paketine dahil edilmelidir.
- Migrations deploy sırasında çalıştırılmalı (Railway: `alembic upgrade head`).
- CORS için `CORS_ORIGINS` env'ine şu originler eklenmeli:
  `https://app.kyradi.com`, `https://admin.kyradi.com`, `https://branding.kyradi.com`,
  `https://kyradi.com`, `https://www.kyradi.com` (virgülle ayrılmış).


## Manual Auth Checklist
- app.kyradi.com üzerinde login → /auth/me 200
- demo-hotel.kyradi.com/app → dashboard (loginli)
- demo-hotel.kyradi.com/auth/me → 200 (loginli)
- login değilken demo-hotel.kyradi.com/app → app.kyradi.com/partner/login?redirect=...
- infinite refresh / loop yok
