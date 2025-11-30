# İleti Merkezi API Format Düzeltmesi

## Sorun
İleti Merkezi API'sinden 400 hatası alınıyor: "İstek çözümlenemedi"

## Olası Çözümler

### 1. API Endpoint Kontrolü
İleti Merkezi'nin güncel API endpoint'ini kontrol edin:
- Panel: https://www.iletimerkezi.com
- API Dokümantasyon: Panel içinde "API Dokümantasyonu" bölümü

### 2. API Formatı
Şu anki format:
```json
{
  "username": "kyradi-sms",
  "password": "***",
  "messages": [
    {
      "numbers": ["905452196863"],
      "msg": "Mesaj içeriği"
    }
  ]
}
```

### 3. Alternatif Formatlar Deneyin

**Format 1 (String numbers):**
```json
{
  "username": "kyradi-sms",
  "password": "***",
  "messages": [
    {
      "numbers": "905452196863",
      "msg": "Mesaj içeriği"
    }
  ]
}
```

**Format 2 (Farklı endpoint):**
- `https://api.iletimerkezi.com/v1/send-sms` yerine
- `https://api.iletimerkezi.com/v1/sms/send` deneyin

### 4. İleti Merkezi Panel Kontrolleri
1. API kullanıcı adı ve şifresinin doğru olduğundan emin olun
2. SMS bakiyenizin olduğundan emin olun
3. API erişiminin aktif olduğundan emin olun
4. Gönderici başlığı (sender ID) ayarlanmış mı kontrol edin

### 5. Test
Backend console'da SMS gönderme loglarını kontrol edin.
Development modunda kod console'da görünecektir.

