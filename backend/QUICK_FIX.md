# Hızlı Çözüm - Development Modu

## Twilio Kurulumu Zor mu? Hemen Çözüm:

### 1. .env Dosyasını Açın
```bash
cd backend
nano .env  # veya vi .env
```

### 2. SMS_PROVIDER'ı Değiştirin
```bash
# Şu anki (çalışmıyor):
SMS_PROVIDER=twilio

# Değiştirin (çalışır):
SMS_PROVIDER=mock
```

### 3. Backend'i Restart Edin
```bash
# Backend'i durdurun (Ctrl+C)
# Yeniden başlatın:
poetry run uvicorn app.main:app --reload
```

### 4. Test Edin
- Login yaparken telefon doğrulama kodu isteyin
- SMS gönderilmez
- Kod backend console'da görünür (okunabilir format)

## ✅ Avantajlar:
- ✅ Hemen çalışır
- ✅ Twilio kurulumu gerekmez
- ✅ Test için yeterli
- ✅ Kodlar console'da görünür

## ⚠️ Dezavantajlar:
- ❌ Gerçek SMS gönderilmez
- ❌ Production için uygun değil

## 📱 Production İçin:
Twilio kurulumunu tamamladıktan sonra:
```bash
SMS_PROVIDER=twilio
```

