# Kyradi QA Checklist (Partner & Admin Panelleri)

Bu doküman, Kyradi SaaS sisteminin test edilmesi için kapsamlı bir kontrol listesi içerir.

---

## A) Partner Paneli Test Senaryoları

### 🔐 Kimlik Doğrulama

- [ ] **Demo kullanıcı ile giriş**
  - E-posta: `admin@demo.com`
  - Şifre: `Kyradi!2025`
  - Dashboard yükleniyor mu?
  - Metinler düzgün Türkçe mi?

- [ ] **Yanlış şifre ile giriş denemesi**
  - Türkçe hata mesajı gösteriliyor mu?
  - "Geçersiz kullanıcı bilgileri" veya benzeri mesaj görünüyor mu?

- [ ] **Şifre sıfırlama**
  - "Şifremi unuttum" linki çalışıyor mu?
  - Geçici şifre oluşturma akışı düzgün mü?

---

### 📍 Lokasyon Yönetimi

- [ ] **Lokasyon listesi**
  - Tablo başlıkları net mi? (Lokasyon, Adres, Koordinat, İşlemler)
  - Yükleniyor durumu gösteriliyor mu?
  - Hata durumunda mesaj gösteriliyor mu?

- [ ] **Yeni lokasyon ekleme**
  - Form açılıyor mu?
  - Tüm alanlar görünüyor mu? (özellikle Enlem/Boylam)
  - Zorunlu alan belirteci (*) var mı?

- [ ] **Plan limiti dolu ise**
  - Türkçe, anlaşılır hata mesajı gösteriliyor mu?
  - "Plan limitine ulaşıldı. Bu otel için en fazla X lokasyon oluşturabilirsiniz."

- [ ] **Lokasyon düzenleme/silme**
  - Düzenleme formu önceki değerlerle doluyor mu?
  - Silme onay penceresi çıkıyor mu?
  - Başarı mesajı gösteriliyor mu?

---

### 🏬 Depo Yönetimi (Depolar)

- [ ] **Depo listesi**
  - Tablo başlıkları net mi? (Depo Kodu, Lokasyon, Durum, Kapasite, Oluşturulma Tarihi)
  - Boş state düzgün mü? "Henüz depo kaydı yok"

- [ ] **Yeni depo ekleme**
  - Form çalışıyor mu?
  - Lokasyon dropdown'u doluyor mu?
  - Başarı mesajı gösteriliyor mu?

- [ ] **Depo düzenleme**
  - Mevcut değerler forma yükleniyor mu?

---

### 📋 Rezervasyonlar

- [ ] **Rezervasyon listesi**
  - Widget'tan gelen rezervasyonlar listeleniyor mu?
  - Tablo başlıkları net mi? (Konuk, İletişim, Kimlik, Tarih, Bavul, Oda No, Durum, Domain, İşlemler)

- [ ] **Durum ve ödeme durumu kolonları**
  - Türkçe ve renkli Badge kullanılıyor mu?
  - Beklemede: Sarı
  - Aktif: Yeşil
  - Tamamlandı: Mavi
  - İptal: Kırmızı

- [ ] **Filtreler**
  - Durum filtresi çalışıyor mu?
  - Tarih aralığı filtresi çalışıyor mu?
  - Domain filtresi çalışıyor mu?

- [ ] **Aksiyonlar**
  - "Bavul Teslim Alındı" butonu çalışıyor mu?
  - "Gelmedi" butonu çalışıyor mu?
  - "Bavul Teslim Edildi" butonu çalışıyor mu?
  - Tooltip'ler eklendi mi?

- [ ] **Boş state**
  - Kayıt bulunamadığında "Rezervasyon bulunamadı" mesajı gösteriliyor mu?

---

### 📱 QR Doğrulama

- [ ] **Manuel QR giriş alanı**
  - Input çalışıyor mu?
  - Doğrulama sonucu gösteriliyor mu?

---

### 💰 Gelir & Hakedişler

- [ ] **Gelir sayfası**
  - "Yükleniyor…" durumunda takılmıyor mu?
  - Hata durumunda "Tekrar Dene" butonu var mı?
  - Boş state mesajı düzgün mü?

- [ ] **Hakedişler sayfası**
  - Tablo başlıkları net mi?
  - Tutarlar doğru formatlanıyor mu? (₺ 150,00)
  - Tarihler okunabilir formatta mı?

---

### 👥 Kullanıcılar & Elemanlar

- [ ] **Yeni kullanıcı ekleme**
  - Form çalışıyor mu?
  - "Şifre Oluştur" butonu random güçlü şifre üretiyor mu?
  - Şifre kopyalanıyor mu?

- [ ] **Kullanıcı listesi**
  - Tablo başlıkları net mi? (E-posta, Telefon, Rol, Durum, Son Giriş, İşlemler)
  - Roller Türkçe gösteriliyor mu?

- [ ] **Kullanıcı limiti aşılırsa**
  - Anlamlı hata mesajı geliyor mu?
  - "Plan limitine ulaşıldı..."

- [ ] **Eleman ataması**
  - Atanabilir kullanıcılar listeleniyor mu?
  - Yoksa "Atanabilir personel bulunmuyor" mesajı çıkıyor mu?

- [ ] **Parola sıfırlama**
  - Modal açılıyor mu?
  - Yeni şifre oluşturuluyor mu?
  - Panoya kopyalama çalışıyor mu?

---

### 💲 Ücretlendirme Yönetimi

- [ ] **Kural listesi**
  - Yükleniyor mu?
  - Tablo başlıkları net mi?

- [ ] **Yeni kural ekleme**
  - Form çalışıyor mu?
  - Validasyon hataları Türkçe mi?

---

### 🔧 Widget Önizleme

- [ ] **Widget formu**
  - Yükleniyor mu?
  - Tema değiştirme çalışıyor mu?

- [ ] **Embed kodu**
  - Kopyalanabilir mi?

---

### 🎮 Demo Akışı

- [ ] **Widget config yükleniyor mu?**
- [ ] **Rezervasyon oluşturma çalışıyor mu?**
- [ ] **Depo ataması çalışıyor mu?**
- [ ] **Ödeme simülasyonu çalışıyor mu?**
- [ ] **Sonuç sayfalarına yönlendirme çalışıyor mu?**

---

## B) Admin Paneli Test Senaryoları

### 🔐 Admin Girişi

- [ ] **Admin kullanıcı ile giriş**
  - E-posta: `admin@kyradi.com`
  - Şifre: `Kyradi!2025`
  - Admin dashboard yükleniyor mu?

---

### 🏨 Otel Yönetimi (Tenants)

- [ ] **Oteller listesi**
  - Tablo yükleniyor mu?
  - Tablo başlıkları net mi? (Otel Adı, Kısa Ad, Durum, Plan, Max Depo, Max Personel, Komisyon Oranı)

- [ ] **Yeni tenant ekleme**
  - Form açılıyor mu?
  - Tüm alanlar var mı?

- [ ] **Tenant aktif/pasif etme**
  - Butonlar çalışıyor mu?

---

### 📊 Global Gelir & Hakedişler

- [ ] **Filtreler**
  - Tenant filtresi çalışıyor mu?
  - Tarih aralığı filtresi çalışıyor mu?

- [ ] **Liste**
  - Veriler doğru formatlanıyor mu?
  - Boş/hata state'ler düzgün mü?

---

### ⚙️ Sistem Ayarları

- [ ] **E-posta ayarları**
  - Form açılıyor mu?
  - Kaydetme çalışıyor mu?

- [ ] **Marka rengi alanı**
  - Input var mı?
  - Color picker veya text input?

- [ ] **Logo URL alanı**
  - Input var mı?

---

### 📝 Audit Log

- [ ] **Audit log listesi**
  - Yükleniyor mu?

- [ ] **Filtreler**
  - Tenant filtresi çalışıyor mu?
  - Aksiyon filtresi çalışıyor mu?
  - Tarih filtresi çalışıyor mu?

---

## C) AI / Kyradi Asistanı Testleri

### 💬 Chat Paneli

- [ ] **Chat paneli açılıyor mu?**
  - Floating chat butonu var mı?
  - Tooltip "Kyradi Asistanı" gösteriyor mu?

- [ ] **İlk karşılama mesajı**
  - "Merhaba! 👋" başlığı var mı?
  - Öneri butonları var mı?

- [ ] **Mesaj gönderme**
  - Enter ile mesaj gönderilebiliyor mu?
  - Shift+Enter ile yeni satır oluşturuluyor mu?

- [ ] **AI yanıtı**
  - Basit bir soru sorunca mantıklı Türkçe cevap alınıyor mu?
  - Typing indicator gösteriliyor mu?

- [ ] **Hata durumları**
  - Rate limit hatası: "OpenAI kullanım limiti doldu..." mesajı
  - Network hatası: "AI servisine ulaşılamıyor..." mesajı
  - 500 hatası: "Kyradi Asistanı bir hata ile karşılaştı..." mesajı
  - Retry butonu çalışıyor mu?

---

## D) Widget Demo Testi (End-to-End)

### 📝 Widget Formu

- [ ] **Form yükleniyor mu?**
  - `/public/widget/init` endpoint çağrılıyor mu?
  - CORS hatası yok mu?

- [ ] **Form alanları**
  - Ad Soyad
  - TC Kimlik No / Pasaport No
  - Telefon
  - E-posta
  - Oda Numarası
  - Giriş/Çıkış tarihi
  - Bavul sayısı
  - KVKK onayı

- [ ] **Form gönderimi**
  - Validasyon hataları Türkçe mi?
  - Başarılı gönderim mesajı var mı?

### 💳 Ödeme Akışı

- [ ] **Rezervasyon oluşturuldu mu?**
- [ ] **Payment oluşturuldu mu?**
- [ ] **MagicPay demo sayfası açılıyor mu?**
- [ ] **Ödeme tamamlanınca Settlement oluşturuluyor mu?**

---

## E) Bilinen Hatalar ve Çözümleri

| Hata | Durum | Çözüm |
|------|-------|-------|
| `UniqueViolationError: payments_reservation_id_key` | ✅ Çözüldü | `get_or_create_payment` kullanılıyor |
| `MissingGreenlet` in /staff | ✅ Çözüldü | `selectinload` eklendi |
| `ValueError: Unknown payment_mode: GATEWAY_DEMO` | ✅ Çözüldü | `normalize_payment_mode` eklendi |
| Widget "Bu alan için yetki bulunamadı" | ✅ Çözüldü | Demo mode her origin kabul ediyor |
| `MultipleResultsFound` in demo seed | ✅ Çözüldü | `scalars().first()` kullanılıyor |
| AI "OPENAI_API_KEY missing" | ✅ Çözüldü | Graceful fallback eklendi |

---

## F) Test Kullanıcıları

| Rol | E-posta | Şifre | Panel |
|-----|---------|-------|-------|
| Demo Admin | admin@demo.com | Kyradi!2025 | Partner |
| Super Admin | admin@kyradi.com | Kyradi!2025 | Admin |

---

## G) Hızlı Test Akışı

1. **Partner Login** → Dashboard kontrol
2. **Lokasyonlar** → Yeni lokasyon ekle
3. **Depolar** → Yeni depo ekle
4. **Widget Demo** → Rezervasyon oluştur
5. **Rezervasyonlar** → Listeyi kontrol et
6. **Kullanıcılar** → Yeni kullanıcı ekle
7. **Kyradi AI** → Chat panelini test et
8. **Admin Login** → Dashboard kontrol
9. **Oteller** → Liste kontrol et
10. **Audit Log** → Kayıtları kontrol et

---

*Son güncelleme: Aralık 2025*

