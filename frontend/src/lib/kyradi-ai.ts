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
}

export interface AskOptions {
  useRag?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UseKyradiAIResponse {
  ask: (message: string, options?: AskOptions) => Promise<KyradiAIResult>;
  isLoading: boolean;
  error: string | null;
  lastAnswer: KyradiAIResult | null;
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
  detail?: string | { message?: string };
}

export function useKyradiAI({
  apiBase,
  tenantId,
  userId,
  locale = "tr-TR",
  token,
}: UseKyradiAIParams): UseKyradiAIResponse {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<KyradiAIResult | null>(null);

  const endpoint = useMemo(() => `${apiBase.replace(/\/$/, "")}/ai/chat`, [apiBase]);

  const ask = useCallback(
    async (message: string, options: AskOptions = {}): Promise<KyradiAIResult> => {
      const trimmed = message.trim();
      if (!trimmed) {
        throw new Error("Mesaj boş olamaz.");
      }
      setIsLoading(true);
      setError(null);

      const jwt = token ?? tokenStorage.get();
      const payload = {
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

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        let data: ChatApiResponse | null = null;
        try {
          data = (await response.json()) as ChatApiResponse;
        } catch {
          data = null;
        }

        if (!response.ok) {
          const detail =
            typeof data?.detail === "string"
              ? data.detail
              : typeof data?.detail === "object" && data?.detail !== null && "message" in data.detail
                ? (data.detail.message as string | undefined) ?? "Asistan yanıtı alınamadı."
                : "Asistan yanıtı alınamadı.";
          setError(detail);
          throw new Error(detail);
        }

        const result: KyradiAIResult = {
          answer: data?.answer ?? "",
          sources: data?.sources ?? [],
          usage: {
            inputTokens: data?.usage?.input_tokens ?? data?.usage?.inputTokens ?? 0,
            outputTokens: data?.usage?.output_tokens ?? data?.usage?.outputTokens ?? 0,
          },
          requestId: data?.request_id ?? data?.requestId ?? "",
        };
        setLastAnswer(result);
        return result;
      } catch (err) {
        const fallbackMessage =
          err instanceof Error ? err.message : "Asistanla iletişim kurulamadı. Lütfen tekrar deneyin.";
        setError(fallbackMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, tenantId, userId, locale, token],
  );

  return {
    ask,
    isLoading,
    error,
    lastAnswer,
  };
}
