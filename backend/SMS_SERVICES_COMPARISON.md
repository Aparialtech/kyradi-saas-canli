# SMS Servisleri Karşılaştırması

## 1. Twilio (ÖNERİLEN - Ücretsiz Trial)

**Avantajlar:**
- ✅ Ücretsiz trial hesabı (kredi kartı gerekmez)
- ✅ Günde 1 SMS (test için yeterli)
- ✅ Kolay kurulum
- ✅ Güvenilir servis
- ✅ Türkiye'ye SMS gönderebilir

**Kurulum:**
1. https://www.twilio.com/try-twilio
2. Hesap oluştur
3. Trial numarası al
4. API bilgilerini .env'ye ekle

**Maliyet:** Ücretsiz (trial), sonra $0.0075/SMS

## 2. İleti Merkezi (Türkiye)

**Avantajlar:**
- Türkiye'ye özel
- Uygun fiyatlı

**Dezavantajlar:**
- API formatı karmaşık
- Şu anda 400 hatası alınıyor

## 3. Development Mode (Test için)

SMS_PROVIDER=mock veya boş bırakırsanız:
- SMS gönderilmez
- Kod backend console'da görünür
- Test için yeterli

