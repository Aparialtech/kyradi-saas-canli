# KYRADI SAAS - Müşteri Onboarding SOP
## (Satış + Operasyon Hızlı Uygulama Rehberi)

**Amaç:** Yeni bir oteli aynı gün canlıya almak  
**Süre:** 15-30 dk (DNS yayılımı hariç)  
**Model:** Önce `tenant.kyradi.com`, sonra istenirse custom domain

---

## 1) Hızlı Canlıya Alma (Zorunlu)

1. Admin panelde yeni tenant oluştur:
   - `name`
   - `slug` (örn: `otelx`)
2. Tenant admin kullanıcı oluştur ve giriş bilgilerini ver.
3. Müşteriye ilk erişim URL’sini gönder:
   - `https://{slug}.kyradi.com`
4. İlk login + rezervasyon + rapor ekranı smoke test yap.

**Çıktı:** Müşteri aynı gün sistemde çalışmaya başlar.

---

## 2) Custom Domain Aktivasyonu (Opsiyonel)

Müşteri kendi domaini ile açmak isterse:
- Örnek hedef domain: `panel.otelx.com`

### 2.1 Bizim taraf
1. Tenant’a `custom_domain` alanını gir.
2. Domain status takibi yap: `unverified -> pending -> verified`.
3. Verify işlemini tetikle (panelden).

### 2.2 Müşteri tarafı (DNS)
Müşteri DNS sağlayıcısında kayıt açar.

**Örnek CNAME (önerilen):**
- Type: `CNAME`
- Name/Host: `panel`
- Target/Value: `app.kyradi.com`
- Proxy/CDN: DNS only (ilk kurulumda önerilir)

> Not: Bazı DNS sağlayıcılarında root (`@`) için CNAME yerine ALIAS/ANAME gerekir.

---

## 3) Doğrulama Checklist (Go-Live)

1. `https://{slug}.kyradi.com` açılıyor mu?
2. Login başarılı mı?
3. `/auth/me` 200 dönüyor mu?
4. Rezervasyon oluşturuluyor mu?
5. Depo atama ekranı çalışıyor mu?
6. Ödeme adımı açılıyor mu?
7. Raporlar yükleniyor mu?
8. Custom domain varsa `verified` oldu mu?
9. Custom domain üzerinden login + panel erişimi tamam mı?

Tüm maddeler `PASS` ise canlıya al.

---

## 4) Müşteriye Gönderilecek Hazır Mesaj

Merhaba, hesabınız aktif edildi.  
İlk erişim linkiniz: `https://{slug}.kyradi.com`

Kendi domaininizi kullanmak isterseniz:
- `panel.{sizin-domaininiz}.com` için CNAME kaydı açıp `app.kyradi.com` hedefini girmeniz yeterli.
- DNS tamamlandığında biz doğrulayıp sizin domaininizi canlıya alacağız.

---

## 5) Sık Sorunlar ve Hızlı Çözüm

### Sorun: Domain doğrulanmıyor
- DNS henüz yayılmamış olabilir (5 dk - 24 saat)
- CNAME hedefi hatalı olabilir
- Proxy/CDN açık ise geçici olarak kapatıp tekrar dene

### Sorun: Login olduktan sonra tekrar login’e atıyor
- Cookie/domain senkronu kontrol et
- Host yönlendirme ve `/auth/me` kontrolü yap

### Sorun: Panel açılıyor ama veri yok
- Tenant çözümleme host’a göre doğru mu kontrol et
- API route rewrite / domain mapping kontrol et

---

## 6) İç Ekip Notu (Standart)

- Her yeni müşteride önce subdomain ile canlıya alın.
- Custom domain’i ikinci adımda aktive edin.
- Böylece satış süreci beklemeden başlayabilir, DNS gecikmesi operasyonu bloklamaz.

