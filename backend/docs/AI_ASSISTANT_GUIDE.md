# Kyradi AI Assistant Guide

Bu doküman Kyradi AI Asistanı'nın kullanımını ve konfigürasyonunu açıklar.

## API Endpoints

### 1. Health Check
```bash
GET /ai/health

Response:
{
  "status": "ok",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "timestamp": "2025-12-01T12:00:00Z"
}
```

### 2. Assistant Endpoint (Auth Opsiyonel)
```bash
POST /ai/assistant

Request:
{
  "message": "Payment neden duplicate oluyor?",
  "tenant_id": "optional-tenant-id",
  "locale": "tr-TR",
  "use_technical_mode": true
}

Response:
{
  "answer": "Duplicate payment sorunu genellikle...",
  "request_id": "abc123",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 200
  },
  "latency_ms": 1250.5,
  "model": "gpt-4o-mini",
  "success": true
}
```

### 3. Chat Endpoint (Auth Gerekli)
```bash
POST /ai/chat
Authorization: Bearer <jwt-token>

Request:
{
  "tenant_id": "your-tenant-id",
  "user_id": "your-user-id",
  "message": "Rezervasyon nasıl oluşturulur?",
  "locale": "tr-TR",
  "use_rag": true,
  "top_k": 6
}

Response:
{
  "answer": "Rezervasyon oluşturmak için...",
  "sources": [
    {"title": "Rezervasyon Rehberi", "snippet": "..."}
  ],
  "usage": {"input_tokens": 200, "output_tokens": 300},
  "latency_ms": 1500,
  "request_id": "def456"
}
```

## Konfigürasyon

### Environment Variables

```bash
# AI Provider (openai, anthropic, ollama)
AI_PROVIDER=openai

# Model
AI_MODEL=gpt-4o-mini

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic (alternatif)
ANTHROPIC_API_KEY=...

# Ollama (lokal)
OLLAMA_BASE_URL=http://localhost:11434
```

## System Prompt

Asistan şu teknik bilgilere sahiptir:

### Payment System
- `get_or_create_payment()` fonksiyonu ile idempotent payment oluşturma
- Duplicate payment koruması
- Payment flow: Widget → Reservation → Payment → Checkout → Settlement

### Troubleshooting
- **UniqueViolationError** → Duplicate payment, `get_or_create_payment` kontrol et
- **MissingGreenlet** → Lazy loading hatası, `selectinload()` ekle
- **CORS Error** → `main.py` CORS ayarları
- **ValidationError** → Pydantic şema kontrolü

## Frontend Kullanımı

### React Hook
```tsx
import { useKyradiAI } from "../lib/kyradi-ai";

function MyComponent() {
  const { ask, isLoading, error, retry } = useKyradiAI({
    apiBase: "https://api.kyradi.com",
    tenantId: "your-tenant",
    userId: "your-user",
    useAssistantEndpoint: true, // Auth gerektirmez
  });

  const handleAsk = async () => {
    try {
      const result = await ask("Payment neden duplicate oluyor?");
      console.log(result.answer);
    } catch (err) {
      // Error handling
    }
  };
}
```

### Chat Component
```tsx
import { KyradiChat } from "../components/KyradiChat";

<KyradiChat
  apiBase="https://api.kyradi.com"
  tenantId="your-tenant"
  userId="your-user"
  locale="tr-TR"
  theme="light"
  useAssistantEndpoint={true}
/>
```

### Floating Widget
```tsx
import { FloatingChatWidget } from "../components/FloatingChatWidget";

// Otomatik olarak auth context'ten tenant/user alır
<FloatingChatWidget />
```

## Özellikler

### Backend
- ✅ Retry mekanizması (3 deneme, exponential backoff)
- ✅ Timeout handling (40s)
- ✅ Rate limit koruması
- ✅ Yapılandırılmış hata yanıtları
- ✅ Comprehensive logging
- ✅ Teknik Kyradi system prompt

### Frontend
- ✅ Loading state
- ✅ Error toast ile retry butonu
- ✅ Auto-scroll
- ✅ Enter to send, Shift+Enter for newline
- ✅ Kyradi AI branding
- ✅ LocalStorage chat history
- ✅ Network error retry (2 deneme)

## Test

```bash
# Health check
curl https://your-api/ai/health

# Assistant (auth yok)
curl -X POST https://your-api/ai/assistant \
  -H "Content-Type: application/json" \
  -d '{"message": "Payment neden duplicate oluyor?"}'

# Chat (auth gerekli)
curl -X POST https://your-api/ai/chat \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "xxx", "user_id": "yyy", "message": "Test"}'
```

## Hata Kodları

| Kod | Açıklama |
|-----|----------|
| 200 | Başarılı |
| 400 | Geçersiz istek (boş mesaj vb.) |
| 401 | Yetkilendirme hatası (chat endpoint) |
| 403 | Tenant erişim yok |
| 429 | Rate limit aşıldı |
| 502 | LLM sağlayıcı hatası |
| 503 | Servis kullanılamıyor |
| 504 | Timeout |

## Versiyon

- **v1.0** - İlk sürüm
- **v1.1** - Assistant endpoint eklendi
- **v1.2** - Kyradi teknik system prompt eklendi
- **v1.3** - Frontend retry ve error handling iyileştirmeleri

