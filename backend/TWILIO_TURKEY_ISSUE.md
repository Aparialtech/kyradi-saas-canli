# Twilio Türkiye SMS Sorunu

## ❌ Sorun:
Twilio Free Trial hesabında **Türkiye'ye SMS gönderme izni yok**.

Hata: `Permission to send an SMS has not been enabled for the region indicated by the 'To' number`

## 🔍 Neden?
Twilio Free Trial sadece belirli ülkelere SMS gönderebilir:
- ✅ ABD
- ✅ İngiltere
- ✅ Kanada
- ❌ Türkiye (ücretli plan gerekli)

## 💡 Çözümler:

### 1. Development Modu (ÖNERİLEN - Hızlı)
SMS gönderilmez, kodlar console'da görünür:

```bash
# .env dosyasında:
SMS_PROVIDER=mock
```

**Avantajlar:**
- ✅ Hemen çalışır
- ✅ Test için yeterli
- ✅ Ücretsiz

### 2. Twilio Ücretli Plan
- Twilio ücretli plana geçin
- Türkiye için izin alın
- Maliyet: ~$0.0075/SMS

### 3. Türkiye'ye Özel SMS Servisi
- Netgsm (Türkiye)
- İleti Merkezi (Türkiye)
- VatanSMS (Türkiye)

## 🎯 Öneri:
Development modunda çalıştırın (`SMS_PROVIDER=mock`). Production'a geçerken Türkiye'ye özel bir SMS servisi kullanın.

