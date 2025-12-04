"""Dummy AI Provider - Used when no AI providers are available.

This provider returns helpful fallback responses when:
- OpenAI library is not installed or API key missing
- Ollama is not running locally
- Any other AI initialization error occurs
"""

from typing import Any, Dict, Optional


class DummyAIProvider:
    """Fallback AI provider that returns helpful offline responses."""
    
    provider_name = "dummy"
    model = "kyradi-helper"
    enabled = True  # Always enabled to provide helpful responses
    
    # Helpful responses for common questions (Turkish)
    COMMON_RESPONSES = {
        # Reservations
        "rezervasyon": "📋 **Rezervasyon Yönetimi**\n\nRezervasyon işlemleri için sol menüden **Rezervasyonlar** sayfasına gidin. Burada:\n- Yeni rezervasyonları görüntüleyebilirsiniz\n- Mevcut rezervasyonların durumunu değiştirebilirsiniz\n- Teslim ve iade işlemlerini yapabilirsiniz\n\nWidget üzerinden gelen rezervasyonlar otomatik olarak bu listede görünür.",
        "onay": "✅ **Rezervasyon Onaylama**\n\nBir rezervasyonu onaylamak için:\n1. Rezervasyonlar sayfasına gidin\n2. İlgili rezervasyonu bulun\n3. 'Onayla' butonuna tıklayın\n\nOnaylanan rezervasyonlar 'Aktif' durumuna geçer.",
        
        # Payments
        "ödeme": "💳 **Ödeme Sistemi**\n\nÖdemeler rezervasyon onaylandığında otomatik olarak işlenir:\n- Widget: Kredi kartı ile online ödeme\n- Partner: POS veya nakit ödeme\n\nÖdeme durumunu **Gelir** sayfasından takip edebilirsiniz.",
        "fiyat": "💰 **Fiyatlandırma**\n\nFiyat ayarları için **Ücretlendirme** sayfasını ziyaret edin:\n- Saatlik ve günlük ücretler tanımlayabilirsiniz\n- Lokasyona özel fiyatlar belirleyebilirsiniz\n- Minimum ücret ayarlayabilirsiniz",
        "tutar": "💰 **Tutar Hesaplama**\n\nSistem tutarı otomatik hesaplar:\n- Süre × Saatlik/Günlük ücret\n- Bavul sayısı çarpanı uygulanır\n- Minimum ücret kontrolü yapılır\n\nDetaylar için **Ücretlendirme** sayfasına bakın.",
        
        # Storage
        "depo": "📦 **Depo Yönetimi**\n\n**Depolar** sayfasından:\n- Yeni depo ekleyebilirsiniz\n- Depo durumlarını görebilirsiniz (Boş/Dolu/Arızalı)\n- Takvim ile müsaitlik kontrolü yapabilirsiniz\n\n💡 İpucu: Her depoda 📅 butonuna tıklayarak aylık doluluk takvimini görebilirsiniz.",
        "doluluk": "📊 **Doluluk Kontrolü**\n\nDepo doluluk durumunu görmek için:\n1. **Depolar** sayfasına gidin\n2. İlgili depoda 📅 (Bilgi) butonuna tıklayın\n3. Takvimde yeşil=boş, kırmızı=dolu günleri görün",
        "müsait": "🟢 **Müsaitlik**\n\nBir depo şu durumlarda müsait sayılır:\n- Statüsü 'Boş' ise\n- Seçilen tarih aralığında çakışan rezervasyon yoksa\n\nSistem otomatik olarak çakışma kontrolü yapar.",
        
        # Widget
        "widget": "🔌 **Widget Entegrasyonu**\n\n**Ayarlar** sayfasından widget bilgilerinize ulaşabilirsiniz:\n- Public Key\n- Embed kodu\n- Widget önizleme\n\nWidget'ı web sitenize eklemek için embed kodunu kopyalayıp HTML'e yapıştırın.",
        
        # Staff
        "personel": "👥 **Personel Yönetimi**\n\n**Kullanıcılar** ve **Elemanlar** sayfalarından personel yönetimi yapabilirsiniz:\n- Yeni kullanıcı oluşturma\n- Rol atama\n- Depo/lokasyon erişimi tanımlama\n- Şifre sıfırlama",
        "eleman": "👤 **Eleman Ataması**\n\n**Elemanlar** sayfasından personel ataması yapabilirsiniz:\n1. Kullanıcı seçin\n2. Erişim vereceğiniz depoları seçin\n3. Lokasyonları seçin\n4. Kaydedin",
        
        # Settings
        "ayar": "⚙️ **Ayarlar**\n\n**Ayarlar** sayfasından:\n- Otel bilgilerinizi düzenleyebilirsiniz\n- Marka rengi ve logo ayarlayabilirsiniz\n- Widget yapılandırmasını görebilirsiniz\n- Bildirim tercihlerinizi ayarlayabilirsiniz",
        
        # Reports
        "rapor": "📈 **Raporlar**\n\nGelir raporları için:\n- **Gelir** sayfası: Tamamlanan ödemeler\n- **Hakedişler** sayfası: Komisyon hesaplaması\n\nTarih aralığı ve lokasyon filtreleri kullanabilirsiniz.",
        "gelir": "💵 **Gelir Takibi**\n\n**Gelir** sayfasından:\n- Toplam brüt gelir\n- Komisyon tutarı\n- Net hakediş\n\nFiltreler: Tarih aralığı, lokasyon, ödeme durumu",
        "hakediş": "📊 **Hakedişler**\n\nHakediş = Toplam Tutar - Komisyon\n\n**Hakedişler** sayfasından detaylı dökümü görebilirsiniz. Filtreler kullanarak istediğiniz dönemi seçebilirsiniz.",
        
        # General help
        "yardım": "🆘 **Yardım**\n\nSık sorulan konular:\n- 📋 Rezervasyon yönetimi\n- 💳 Ödeme sistemi\n- 📦 Depo yönetimi\n- ⚙️ Ayarlar\n\nDetaylı yardım için sol menüdeki ilgili sayfayı ziyaret edin veya sistem yöneticinize başvurun.",
        "nasıl": "❓ **Nasıl Yapılır?**\n\nBana daha spesifik bir soru sorabilirsiniz:\n- 'Rezervasyon nasıl onaylanır?'\n- 'Depo nasıl eklenir?'\n- 'Fiyat nasıl ayarlanır?'\n- 'Widget nasıl kurulur?'",
    }
    
    DEFAULT_RESPONSE_TR = """Merhaba! 👋 Ben Kyradi AI Asistan.

Bu konuda size yardımcı olmaya çalışayım. Sık sorulan konulardan birini seçebilir veya sorunuzu daha detaylı yazabilirsiniz:

📋 **Rezervasyon** - rezervasyon yönetimi
💳 **Ödeme** - ödeme sistemi
📦 **Depo** - depo yönetimi
⚙️ **Ayarlar** - sistem ayarları
📊 **Rapor** - gelir raporları

💡 **İpucu:** Sorununuzu 'rezervasyon nasıl onaylanır?' gibi soru şeklinde yazarsanız daha iyi yardımcı olabilirim."""

    DEFAULT_RESPONSE_EN = """Hello! 👋 I'm Kyradi AI Assistant.

Let me help you with that. You can choose from common topics or ask your question in more detail:

📋 **Reservation** - reservation management
💳 **Payment** - payment system
📦 **Storage** - storage management
⚙️ **Settings** - system settings
📊 **Reports** - revenue reports

💡 **Tip:** Ask your question like 'how to confirm a reservation?' for better help."""
    
    def __init__(self, locale: str = "tr-TR"):
        self.locale = locale
    
    async def chat(self, prompt: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Return a helpful fallback response.
        
        Args:
            prompt: The user's prompt
            context: Optional context (ignored in dummy)
            
        Returns:
            Dict with helpful response
        """
        prompt_lower = prompt.lower()
        
        # Try to match common questions
        for keyword, response in self.COMMON_RESPONSES.items():
            if keyword in prompt_lower:
                return {
                    "answer": response,
                    "success": True,
                    "model": "kyradi-helper",
                    "provider": "dummy",
                    "offline": True,
                }
        
        # Return default helpful message
        is_turkish = self.locale.startswith("tr")
        message = self.DEFAULT_RESPONSE_TR if is_turkish else self.DEFAULT_RESPONSE_EN
        
        return {
            "answer": message,
            "success": True,
            "model": "kyradi-helper",
            "provider": "dummy",
            "offline": True,
        }
    
    def is_available(self) -> bool:
        """Check if this provider is available (always True - provides offline help)."""
        return True
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of this provider."""
        return {
            "available": True,
            "provider": "dummy",
            "model": "kyradi-helper",
            "mode": "offline-helper",
            "note": "AI is running in offline mode - providing helpful built-in responses",
        }
