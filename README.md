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
