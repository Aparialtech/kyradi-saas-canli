# KYRADI
## Akıllı Bagaj Emanet ve Operasyon Yönetim Platformu

**Doküman Türü:** Kurumsal Tanıtım  
**Sürüm:** 2026 Q1  
**Hedef Kitle:** Oteller, turizm işletmeleri, şehir içi bagaj emanet noktaları, iş ortakları

---

## 1) Kyradi Nedir?
Kyradi; bagaj emanet, rezervasyon, depo/locker atama, ödeme ve operasyon süreçlerini tek bir platformda birleştiren çok kiracılı (multi-tenant) bir SaaS çözümüdür.

İşletmeler Kyradi ile:
- bagaj operasyonunu dijitalleştirir,
- gelir akışını ölçülebilir hale getirir,
- personel iş yükünü azaltır,
- yönetim kararlarını gerçek veriye dayandırır.

---

## 2) Hangi Problemi Çözer?
Kyradi, geleneksel emanet süreçlerinde sık görülen sorunları doğrudan hedefler:
- dağınık rezervasyon ve ödeme takibi,
- depo kapasitesinin verimsiz kullanımı,
- manuel işlem kaynaklı hata riski,
- operasyon verisinin raporlanamaması,
- farklı şubelerde standart süreç yönetimi eksikliği.

---

## 3) Temel Ürün Bileşenleri

### 3.1 Rezervasyon Yönetimi
- Rezervasyon oluşturma ve izleme
- Durum geçişleri (rezervasyon, teslim, tamamlama)
- Müşteri bilgilerinin operasyonla eşzamanlı yönetimi

### 3.2 Depo / Locker Yönetimi
- Uygun depo atama
- Doluluk ve kapasite takibi
- Lokasyon bazlı operasyon görünürlüğü

### 3.3 Ödeme ve Tahsilat
- Gateway entegrasyonuna hazır ödeme mimarisi
- Ödeme durum takibi
- Operasyon ve ödeme akışlarının birbiriyle uyumlu çalışması

### 3.4 Partner Paneli
- Günlük saha operasyonları
- Rezervasyon/depo/personel yönetimi
- Gelir ve kullanım raporlarına erişim

### 3.5 Admin Paneli
- Tenant (müşteri işletme) yönetimi
- Domain/subdomain yönetimi
- Merkezi raporlama, denetim ve operasyon kontrolü

### 3.6 Raporlama ve Analitik
- Lokasyon bazlı gelir analizi
- Depo kullanım analizi
- Filtreleme, arama ve sayfalama destekli veri yönetimi

---

## 4) Teknik Altyapı (Yüksek Seviye)
- **Backend:** FastAPI
- **Veritabanı:** PostgreSQL
- **Frontend:** React + Vite
- **Deployment:** Railway (API), Vercel (Web)
- **Mimari:** Multi-tenant, domain/subdomain destekli

Güvenlik yaklaşımı:
- cookie tabanlı güvenli oturum yönetimi,
- tenant izolasyonu,
- imzalı entegrasyon istekleri (HMAC),
- rol bazlı yetki kontrolü.

---

## 5) İşletmeye Sağladığı Faydalar
- Operasyon süreçlerinde hız ve standartlaşma
- Daha düşük manuel hata oranı
- Kapasite kullanımında artış
- Gelir süreçlerinde görünürlük
- Merkezden yönetilebilir ölçeklenebilir yapı

---

## 6) Kullanım Senaryosu (Örnek Akış)
1. Müşteri rezervasyon oluşturur  
2. Sistem uygun depo/locker önerir veya atar  
3. Ödeme adımı tamamlanır  
4. Saha operasyonu durum günceller  
5. Yönetim paneli gelir ve kullanım verilerini raporlar

---

## 7) Kimler İçin Uygun?
- Oteller ve konaklama zincirleri
- Turizm/transfer şirketleri
- Şehir içi bagaj emanet noktaları
- AVM, terminal ve etkinlik alanı işletmeleri

---

## 8) Onboarding Yaklaşımı
- İhtiyaç analizi ve süreç tasarımı
- Tenant/domain kurulumu
- Operasyonel ayarların yapılandırılması
- Pilot kullanım
- Tam ölçekli canlı kullanım

---

## 9) Sonuç
Kyradi, bagaj emanet operasyonunu sadece dijitalleştirmez; rezervasyon, ödeme ve saha operasyonlarını tek veri omurgasında birleştirerek işletmeye ölçülebilir verim ve sürdürülebilir büyüme sağlar.

