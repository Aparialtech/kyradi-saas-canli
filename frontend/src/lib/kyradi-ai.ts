/**
 * Kyradi AI Hook - Frontend integration for Kyradi Assistant
 * 
 * Features:
 * - Automatic retry on network errors
 * - Proper error handling with Turkish messages
 * - Support for both /ai/assistant and /ai/chat endpoints
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
  tenantId?: string;
  userId: string;
  userRole?: string;
  panelType?: "partner" | "admin";
  locale?: string;
  token?: string;
  useAssistantEndpoint?: boolean;
}

export interface AskOptions {
  useRag?: boolean;
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

// Error messages in Turkish
const ERROR_MESSAGES = {
  NETWORK_ERROR: "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.",
  TIMEOUT_ERROR: "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.",
  AUTH_ERROR: "AI servisi yapılandırılmamış. Lütfen yöneticiye başvurun.",
  RATE_LIMIT_ERROR: "Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
  SERVER_ERROR: "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
  UNKNOWN_ERROR: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  EMPTY_MESSAGE: "Mesaj boş olamaz.",
  API_KEY_MISSING: "AI servisi yapılandırılmamış: OPENAI_API_KEY eksik.",
};

export interface AIError {
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

// Retry delays in ms
const RETRY_DELAYS = [1000, 2000, 4000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useKyradiAI({
  apiBase,
  tenantId,
  userId,
  userRole,
  panelType,
  locale = "tr-TR",
  token,
  useAssistantEndpoint = true,
}: UseKyradiAIParams): UseKyradiAIResponse {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<KyradiAIResult | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [lastOptions, setLastOptions] = useState<AskOptions>({});

  // Select endpoint - always use /ai/assistant for simplicity
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

      // Build payload - use 'question' or 'message' based on endpoint
      const payload = useAssistantEndpoint
        ? {
            question: trimmed,  // Assistant endpoint expects 'question'
            tenant_id: tenantId || undefined,
            locale,
          }
        : {
            ...(tenantId && { tenant_id: tenantId }),
            user_id: userId,
            message: trimmed,
            locale,
            use_rag: options.useRag ?? false,
            metadata: options.metadata,
          };

      let lastError: Error | null = null;

      try {
        // Retry loop
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
              console.log(`Kyradi AI: Retry attempt ${attempt} after ${delay}ms`);
              await sleep(delay);
            }

            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            
            // Only add auth header for /ai/chat endpoint
            if (!useAssistantEndpoint && jwt) {
              headers["Authorization"] = `Bearer ${jwt}`;
            }

            const response = await fetch(endpoint, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            });

            let data: any = null;
            try {
              data = await response.json();
            } catch {
              data = null;
            }

            // Handle HTTP errors with typed error responses
            if (!response.ok) {
              const statusCode = response.status;
              let aiError: AIError;

              // Try to parse structured error response
              if (data?.detail && typeof data.detail === 'object' && data.detail.code) {
                aiError = {
                  code: data.detail.code,
                  message: data.detail.message || ERROR_MESSAGES.UNKNOWN_ERROR,
                  retryAfterSeconds: data.detail.retry_after_seconds,
                };
              } else {
                // Fallback to status code based errors
                switch (statusCode) {
                  case 401:
                    aiError = {
                      code: "AUTH_ERROR",
                      message: ERROR_MESSAGES.API_KEY_MISSING,
                    };
                    break;
                  case 403:
                    aiError = {
                      code: "AUTH_ERROR",
                      message: ERROR_MESSAGES.AUTH_ERROR,
                    };
                    break;
                  case 429:
                    aiError = {
                      code: "RATE_LIMIT",
                      message: ERROR_MESSAGES.RATE_LIMIT_ERROR,
                      retryAfterSeconds: 10,
                    };
                    break;
                  case 503:
                    aiError = {
                      code: data?.detail?.code || "AI_DISABLED",
                      message: data?.detail?.message || data?.detail || ERROR_MESSAGES.SERVER_ERROR,
                    };
                    break;
                  case 500:
                  case 502:
                  case 504:
                    aiError = {
                      code: "SERVER_ERROR",
                      message: data?.detail?.message || data?.detail || ERROR_MESSAGES.SERVER_ERROR,
                    };
                    // Retry on server errors
                    if (attempt < maxRetries) {
                      lastError = new Error(aiError.message);
                      continue;
                    }
                    break;
                  default:
                    aiError = {
                      code: "UNKNOWN",
                      message: data?.detail?.message || data?.detail || ERROR_MESSAGES.UNKNOWN_ERROR,
                    };
                }
              }

              setError(aiError.message);
              const error = new Error(aiError.message) as Error & AIError;
              error.code = aiError.code;
              error.retryAfterSeconds = aiError.retryAfterSeconds;
              
              // Don't retry for certain errors
              if (aiError.code === "AUTH_ERROR" || aiError.code === "AI_DISABLED") {
                setIsLoading(false);
                throw error;
              }
              
              // Retry for other errors
              if (attempt < maxRetries) {
                lastError = error;
                continue;
              }
              
              setIsLoading(false);
              throw error;
            }

            // Check for success flag in response
            if (data?.success === false) {
              const errorMessage = data?.error || ERROR_MESSAGES.UNKNOWN_ERROR;
              
              // Check if it's an API key issue
              if (errorMessage.includes("OPENAI_API_KEY")) {
                setIsLoading(false);
                setError(ERROR_MESSAGES.API_KEY_MISSING);
                throw new Error(ERROR_MESSAGES.API_KEY_MISSING);
              }
              
              // Retry on transient errors
              if (attempt < maxRetries && (errorMessage.includes("zaman aşımı") || errorMessage.includes("timeout"))) {
                lastError = new Error(errorMessage);
                continue;
              }
              
              setIsLoading(false);
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
            setIsLoading(false); // Reset loading state on success
            return result;
            
          } catch (err) {
            // Handle network errors
            if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) {
              const errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
              if (attempt < maxRetries) {
                lastError = new Error(errorMessage);
                continue;
              }
              setIsLoading(false);
              setError(errorMessage);
              throw new Error(errorMessage);
            }

            // Re-throw other errors
            if (err instanceof Error) {
              lastError = err;
              if (attempt >= maxRetries) {
                setIsLoading(false);
                throw err;
              }
            }
          }
        }

        // If we get here, all retries failed
        const finalError = lastError?.message || ERROR_MESSAGES.UNKNOWN_ERROR;
        setIsLoading(false);
        setError(finalError);
        throw new Error(finalError);
      } catch (err) {
        // Ensure loading is reset even if unexpected error occurs
        setIsLoading(false);
        throw err;
      }
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
