#!/bin/bash
# Hızlı Email Servisi Kurulum Scripti

echo "=========================================="
echo "  EMAIL SERVİSİ HIZLI KURULUM"
echo "=========================================="
echo ""

# .env dosyasını kontrol et
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env dosyası bulunamadı!"
    exit 1
fi

echo "📝 .env dosyasına email ayarları ekleniyor..."
echo ""

# Email ayarlarını kontrol et
if grep -q "EMAIL_PROVIDER" "$ENV_FILE"; then
    echo "⚠️  Email ayarları zaten var. Güncellemek için manuel olarak düzenleyin."
    echo ""
    echo "Gerekli ayarlar:"
    echo "  EMAIL_PROVIDER=smtp"
    echo "  SMTP_HOST=smtp.gmail.com"
    echo "  SMTP_PORT=587"
    echo "  SMTP_USER=your-email@gmail.com"
    echo "  SMTP_PASSWORD=your-16-digit-app-password"
    echo "  SMTP_FROM_EMAIL=noreply@kyradi.com"
    echo "  FRONTEND_URL=http://localhost:5173"
else
    echo "" >> "$ENV_FILE"
    echo "# Email Configuration" >> "$ENV_FILE"
    echo "EMAIL_PROVIDER=smtp" >> "$ENV_FILE"
    echo "SMTP_HOST=smtp.gmail.com" >> "$ENV_FILE"
    echo "SMTP_PORT=587" >> "$ENV_FILE"
    echo "SMTP_USER=your-email@gmail.com" >> "$ENV_FILE"
    echo "SMTP_PASSWORD=your-16-digit-app-password" >> "$ENV_FILE"
    echo "SMTP_FROM_EMAIL=noreply@kyradi.com" >> "$ENV_FILE"
    echo "" >> "$ENV_FILE"
    echo "# Frontend URL" >> "$ENV_FILE"
    echo "FRONTEND_URL=http://localhost:5173" >> "$ENV_FILE"
    
    echo "✅ Email ayarları eklendi!"
    echo ""
    echo "⚠️  ŞİMDİ YAPMANIZ GEREKENLER:"
    echo "1. .env dosyasını açın"
    echo "2. SMTP_USER ve SMTP_PASSWORD değerlerini güncelleyin"
    echo "3. Gmail için 'Uygulama Şifresi' kullanın (normal şifre çalışmaz!)"
    echo ""
fi

echo "=========================================="
echo "  GMAIL UYGULAMA ŞİFRESİ NASIL ALINIR?"
echo "=========================================="
echo ""
echo "1. Gmail hesabınızda '2 Adımlı Doğrulama' açın"
echo "2. Google Hesabım > Güvenlik > 2 Adımlı Doğrulama"
echo "3. 'Uygulama şifreleri' bölümüne gidin"
echo "4. 'Uygulama seç' > 'Diğer' > 'KYRADI' yazın"
echo "5. Oluşturulan 16 haneli şifreyi kopyalayın"
echo "6. .env dosyasındaki SMTP_PASSWORD'a yapıştırın"
echo ""
echo "=========================================="
echo "  TEST ETME"
echo "=========================================="
echo ""
echo "Backend'i yeniden başlatın:"
echo "  poetry run uvicorn app.main:app --reload"
echo ""
echo "Test email göndermek için:"
echo "  poetry run python scripts/send_test_email.py"
echo ""

