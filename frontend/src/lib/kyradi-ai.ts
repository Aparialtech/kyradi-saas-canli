/**
 * Kyradi AI Hook - Frontend integration for Kyradi Assistant
 * 
 * Features:
 * - Automatic retry on network errors
 * - Proper error handling and user-friendly messages
 * - Support for both authenticated and unauthenticated modes
 * - Structured response parsing
 */

import { useCallback, useMemo, useState } from "react";
import { tokenStorage } from "./tokenStorage";

export interface KyradiAISource {
  title: string;
  snippet: string;
}

export interface KyradiAIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface KyradiAIResult {
  answer: string;
  sources: KyradiAISource[];
  usage: KyradiAIUsage;
  requestId: string;
  model?: string;
  latencyMs?: number;
}

export interface UseKyradiAIParams {
  apiBase: string;
  tenantId: string;
  userId: string;
  locale?: string;
  /**
   * Override JWT when not relying on local storage.
   */
  token?: string;
  /**
   * Use simplified assistant endpoint (no auth required)
   */
  useAssistantEndpoint?: boolean;
}

export interface AskOptions {
  useRag?: boolean;
  useTechnicalMode?: boolean;
  metadata?: Record<string, unknown>;
  retryCount?: number;
}

export interface UseKyradiAIResponse {
  ask: (message: string, options?: AskOptions) => Promise<KyradiAIResult>;
  isLoading: boolean;
  error: string | null;
  lastAnswer: KyradiAIResult | null;
  clearError: () => void;
  retry: () => Promise<KyradiAIResult | null>;
}

interface ChatApiUsage {
  input_tokens?: number;
  output_tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface ChatApiResponse {
  answer?: string;
  sources?: KyradiAISource[];
  usage?: ChatApiUsage;
  request_id?: string;
  requestId?: string;
  model?: string;
  latency_ms?: number;
  latencyMs?: number;
  success?: boolean;
  detail?: string | { message?: string };
  error?: string;
}

// Error messages in Turkish
const ERROR_MESSAGES = {
  NETWORK_ERROR: "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.",
  TIMEOUT_ERROR: "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.",
  AUTH_ERROR: "Oturum süresi dolmuş. Lütfen tekrar giriş yapın.",
  RATE_LIMIT_ERROR: "Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
  SERVER_ERROR: "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
  UNKNOWN_ERROR: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  EMPTY_MESSAGE: "Mesaj boş olamaz.",
};

// Retry delay in ms
const RETRY_DELAYS = [1000, 2000, 4000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useKyradiAI({
  apiBase,
  tenantId,
  userId,
  locale = "tr-TR",
  token,
  useAssistantEndpoint = false,
}: UseKyradiAIParams): UseKyradiAIResponse {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<KyradiAIResult | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [lastOptions, setLastOptions] = useState<AskOptions>({});

  // Select endpoint based on mode
  const endpoint = useMemo(() => {
    const base = apiBase.replace(/\/$/, "");
    return useAssistantEndpoint ? `${base}/ai/assistant` : `${base}/ai/chat`;
  }, [apiBase, useAssistantEndpoint]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const ask = useCallback(
    async (message: string, options: AskOptions = {}): Promise<KyradiAIResult> => {
      const trimmed = message.trim();
      if (!trimmed) {
        const errorMsg = ERROR_MESSAGES.EMPTY_MESSAGE;
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      setIsLoading(true);
      setError(null);
      setLastMessage(trimmed);
      setLastOptions(options);

      const jwt = token ?? tokenStorage.get();
      const maxRetries = options.retryCount ?? 2;

      // Build payload based on endpoint type
      const payload = useAssistantEndpoint
        ? {
            message: trimmed,
            tenant_id: tenantId || undefined,
            locale,
            use_technical_mode: options.useTechnicalMode ?? true,
            metadata: {
              channel: "web",
              user_id: userId,
              ...options.metadata,
            },
          }
        : {
            tenant_id: tenantId,
            user_id: userId,
            message: trimmed,
            locale,
            use_rag: options.useRag ?? true,
            metadata: {
              channel: "web",
              ...options.metadata,
            },
          };

      let lastError: Error | null = null;

      // Retry loop
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
            console.log(`Kyradi AI: Retry attempt ${attempt} after ${delay}ms`);
            await sleep(delay);
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(jwt && !useAssistantEndpoint ? { Authorization: `Bearer ${jwt}` } : {}),
            },
            body: JSON.stringify(payload),
          });

          let data: ChatApiResponse | null = null;
          try {
            data = (await response.json()) as ChatApiResponse;
          } catch {
            data = null;
          }

          // Handle HTTP errors
          if (!response.ok) {
            const statusCode = response.status;
            let errorMessage: string;

            switch (statusCode) {
              case 401:
              case 403:
                errorMessage = ERROR_MESSAGES.AUTH_ERROR;
                break;
              case 429:
                errorMessage = ERROR_MESSAGES.RATE_LIMIT_ERROR;
                break;
              case 502:
              case 503:
              case 504:
                errorMessage = ERROR_MESSAGES.SERVER_ERROR;
                // Retry on server errors
                if (attempt < maxRetries) {
                  lastError = new Error(errorMessage);
                  continue;
                }
                break;
              default:
                errorMessage =
                  data?.error ||
                  (typeof data?.detail === "string"
                    ? data.detail
                    : typeof data?.detail === "object" && data?.detail?.message
                      ? data.detail.message
                      : ERROR_MESSAGES.UNKNOWN_ERROR);
            }

            setError(errorMessage);
            throw new Error(errorMessage);
          }

          // Check for success flag in assistant endpoint
          if (useAssistantEndpoint && data?.success === false) {
            const errorMessage = data?.error || ERROR_MESSAGES.UNKNOWN_ERROR;
            // Retry on transient errors
            if (attempt < maxRetries && errorMessage.includes("zaman aşımı")) {
              lastError = new Error(errorMessage);
              continue;
            }
            setError(errorMessage);
            throw new Error(errorMessage);
          }

          // Parse successful response
          const result: KyradiAIResult = {
            answer: data?.answer ?? "",
            sources: data?.sources ?? [],
            usage: {
              inputTokens: data?.usage?.input_tokens ?? data?.usage?.inputTokens ?? 0,
              outputTokens: data?.usage?.output_tokens ?? data?.usage?.outputTokens ?? 0,
            },
            requestId: data?.request_id ?? data?.requestId ?? "",
            model: data?.model,
            latencyMs: data?.latency_ms ?? data?.latencyMs,
          };

          setLastAnswer(result);
          setError(null);
          return result;
        } catch (err) {
          // Handle network errors
          if (err instanceof TypeError && err.message.includes("fetch")) {
            const errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
            if (attempt < maxRetries) {
              lastError = new Error(errorMessage);
              continue;
            }
            setError(errorMessage);
            throw new Error(errorMessage);
          }

          // Re-throw other errors
          if (err instanceof Error) {
            lastError = err;
            if (attempt >= maxRetries) {
              throw err;
            }
          }
        }
      }

      // If we get here, all retries failed
      const finalError = lastError?.message || ERROR_MESSAGES.UNKNOWN_ERROR;
      setError(finalError);
      throw new Error(finalError);
    },
    [endpoint, tenantId, userId, locale, token, useAssistantEndpoint],
  );

  // Retry last failed request
  const retry = useCallback(async (): Promise<KyradiAIResult | null> => {
    if (!lastMessage) {
      return null;
    }
    try {
      return await ask(lastMessage, lastOptions);
    } catch {
      return null;
    }
  }, [ask, lastMessage, lastOptions]);

  return {
    ask,
    isLoading,
    error,
    lastAnswer,
    clearError,
    retry,
  };
}
