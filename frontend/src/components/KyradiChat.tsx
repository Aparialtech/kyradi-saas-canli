/**
 * Kyradi Chat Component - AI Assistant UI
 * 
 * Features:
 * - Loading state with animated indicator
 * - Error toast with retry button
 * - Auto-scroll to latest message
 * - Enter to send, Shift+Enter for newline
 * - Kyradi AI branding
 * - Chunk rendering for long responses
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { useKyradiAI } from "../lib/kyradi-ai";
import type { KyradiAISource } from "../lib/kyradi-ai";

type ChatTheme = "light" | "dark";

interface PageContext {
  /** Current page/route identifier */
  currentPage: string;
  /** Selected entity ID if any (e.g., location_id, reservation_id) */
  entityId?: string;
  /** Entity type (location, warehouse, reservation, etc.) */
  entityType?: "location" | "warehouse" | "reservation" | "user" | "staff" | "pricing" | "ticket" | string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

interface KyradiChatProps {
  apiBase: string;
  tenantId?: string;
  userId: string;
  userRole?: string;
  panelType?: "partner" | "admin";
  locale?: string;
  theme?: ChatTheme;
  useRag?: boolean;
  useAssistantEndpoint?: boolean;
  /** Page context for contextual assistance */
  context?: PageContext;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: KyradiAISource[];
  requestId?: string;
  isError?: boolean;
}

const STYLE_ID = "kyradi-chat-styles";
const MAX_HISTORY = 10;

const chatCopy: Record<
  string,
  {
    placeholder: string;
    send: string;
    typing: string;
    sources: string;
    requestLabel: string;
    retry: string;
    errorTitle: string;
    brandName: string;
    welcomeTitle: string;
    welcomeMessage: string;
    suggestionReservation: string;
    suggestionPayment: string;
    suggestionWidget: string;
  }
> = {
  "tr-TR": {
    placeholder: "Sorunuzu yazın...",
    send: "Gönder",
    typing: "Kyradi AI yazıyor…",
    sources: "Dayanaklar",
    requestLabel: "İstek",
    retry: "Tekrar Dene",
    errorTitle: "Hata",
    brandName: "Kyradi AI",
    welcomeTitle: "Merhaba!",
    welcomeMessage: "Ben Kyradi AI, rezervasyon, ödeme veya panel kullanımıyla ilgili sorularınızı yanıtlamak için buradayım.",
    suggestionReservation: "Rezervasyon nasıl onaylanır?",
    suggestionPayment: "Ödeme sistemi nasıl çalışır?",
    suggestionWidget: "Widget nasıl kurulur?",
  },
  "en-US": {
    placeholder: "Type your question...",
    send: "Send",
    typing: "Kyradi AI is typing…",
    sources: "Sources",
    requestLabel: "Request",
    retry: "Retry",
    errorTitle: "Error",
    brandName: "Kyradi AI",
    welcomeTitle: "Hello!",
    welcomeMessage: "I'm Kyradi AI, here to help with reservations, payments, and panel usage questions.",
    suggestionReservation: "How do I confirm a reservation?",
    suggestionPayment: "How does the payment system work?",
    suggestionWidget: "How do I set up the widget?",
  },
};

const baseStyles = `
.kyradi-chat {
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  width: 100%;
  max-width: 100%;
  min-height: 500px;
  max-height: calc(100vh - 200px);
  height: auto;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background-color: #ffffff;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
.kyradi-chat--dark {
  background-color: #101828;
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.89);
}
.kyradi-chat__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.kyradi-chat--dark .kyradi-chat__header {
  border-bottom-color: rgba(255,255,255,0.1);
}
.kyradi-chat__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00a389 0%, #0066ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}
.kyradi-chat__avatar svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.5;
}
.kyradi-chat__brand {
  font-weight: 600;
  font-size: 0.95rem;
  color: #0f172a;
}
.kyradi-chat--dark .kyradi-chat__brand {
  color: #fff;
}
.kyradi-chat__messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 300px;
  max-height: 450px;
  overflow-y: auto;
  padding-right: 4px;
  scroll-behavior: smooth;
}
.kyradi-chat__message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kyradi-chat__bubble {
  border-radius: 12px;
  padding: 10px 14px;
  line-height: 1.55;
  font-size: 0.95rem;
  background: rgba(16,24,40,0.05);
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}
.kyradi-chat--dark .kyradi-chat__bubble {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.92);
}
.kyradi-chat__message--user .kyradi-chat__bubble {
  align-self: flex-end;
  background: #00a389;
  color: #fff;
}
.kyradi-chat__message--assistant .kyradi-chat__bubble {
  align-self: flex-start;
}
.kyradi-chat__message--error .kyradi-chat__bubble {
  background: rgba(217, 45, 32, 0.1);
  color: #d92d20;
  border: 1px solid rgba(217, 45, 32, 0.2);
}
.kyradi-chat__form {
  display: flex;
  gap: 8px;
}
.kyradi-chat__input {
  flex: 1;
  border: 1px solid rgba(15,23,42,0.2);
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 0.95rem;
  outline: none;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  font-family: inherit;
}
.kyradi-chat--dark .kyradi-chat__input {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}
.kyradi-chat__input:focus {
  border-color: #00a389;
  box-shadow: 0 0 0 3px rgba(0, 163, 137, 0.1);
}
.kyradi-chat__button {
  border-radius: 12px;
  background: linear-gradient(135deg, #00a389 0%, #0066ff 100%);
  color: #fff;
  border: none;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.kyradi-chat__button:hover:not(:disabled) {
  opacity: 0.9;
}
.kyradi-chat__button:active:not(:disabled) {
  transform: scale(0.98);
}
.kyradi-chat__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.kyradi-chat__typing {
  font-size: 0.85rem;
  color: rgba(15,23,42,0.6);
  display: flex;
  align-items: center;
  gap: 8px;
}
.kyradi-chat--dark .kyradi-chat__typing {
  color: rgba(255,255,255,0.7);
}
.kyradi-chat__typing-dots {
  display: flex;
  gap: 4px;
}
.kyradi-chat__typing-dot {
  width: 6px;
  height: 6px;
  background: #00a389;
  border-radius: 50%;
  animation: kyradi-bounce 1.4s infinite ease-in-out both;
}
.kyradi-chat__typing-dot:nth-child(1) { animation-delay: -0.32s; }
.kyradi-chat__typing-dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes kyradi-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
.kyradi-chat__error {
  background: rgba(217, 45, 32, 0.1);
  border: 1px solid rgba(217, 45, 32, 0.2);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kyradi-chat__error-text {
  color: #d92d20;
  font-size: 0.85rem;
  flex: 1;
}
.kyradi-chat__error-retry {
  background: #d92d20;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.kyradi-chat__error-retry:hover {
  background: #b91c1c;
}
.kyradi-chat__sources {
  border-radius: 8px;
  background: rgba(15,23,42,0.03);
  padding: 8px 10px;
  font-size: 0.85rem;
}
.kyradi-chat--dark .kyradi-chat__sources {
  background: rgba(255,255,255,0.06);
}
.kyradi-chat__sources summary {
  cursor: pointer;
  font-weight: 600;
  list-style: none;
}
.kyradi-chat__sources ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.kyradi-chat__meta {
  font-size: 0.75rem;
  color: rgba(15,23,42,0.5);
}
.kyradi-chat--dark .kyradi-chat__meta {
  color: rgba(255,255,255,0.6);
}
.kyradi-chat__welcome {
  text-align: center;
  padding: 16px 8px;
}
.kyradi-chat__welcome-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #0f172a;
}
.kyradi-chat--dark .kyradi-chat__welcome-title {
  color: #fff;
}
.kyradi-chat__welcome-text {
  font-size: 0.9rem;
  color: rgba(15, 23, 42, 0.7);
  margin-bottom: 16px;
  line-height: 1.5;
}
.kyradi-chat--dark .kyradi-chat__welcome-text {
  color: rgba(255, 255, 255, 0.7);
}
.kyradi-chat__suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kyradi-chat__suggestion {
  background: rgba(0, 163, 137, 0.08);
  border: 1px solid rgba(0, 163, 137, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: #0f172a;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s, border-color 0.2s;
}
.kyradi-chat__suggestion:hover {
  background: rgba(0, 163, 137, 0.15);
  border-color: rgba(0, 163, 137, 0.4);
}
.kyradi-chat--dark .kyradi-chat__suggestion {
  background: rgba(0, 163, 137, 0.1);
  border-color: rgba(0, 163, 137, 0.3);
  color: #fff;
}
.kyradi-chat--dark .kyradi-chat__suggestion:hover {
  background: rgba(0, 163, 137, 0.2);
}
`;

export function KyradiChat({
  apiBase,
  tenantId,
  userId,
  userRole,
  panelType,
  locale = "tr-TR",
  theme = "light",
  useRag = false,
  useAssistantEndpoint = true,
}: KyradiChatProps) {
  const { ask, isLoading, error, clearError, retry } = useKyradiAI({
    apiBase,
    tenantId,
    userId,
    userRole,
    panelType,
    locale,
    useAssistantEndpoint,
  });
  const copy = chatCopy[locale] ?? chatCopy["tr-TR"];
  const historyKey = useMemo(() => `kyradi.chat.history.${tenantId || 'admin'}.${userId}`, [tenantId, userId]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>(() => readHistory(historyKey));
  const [cooldown, setCooldown] = useState<number>(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    setMessages(readHistory(historyKey));
  }, [historyKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(historyKey, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages, historyKey]);

  // Cooldown timer
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!listRef.current) return;
    const scrollToBottom = () => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    };
    // Use requestAnimationFrame for smooth scroll
    requestAnimationFrame(scrollToBottom);
  }, [messages, isLoading]);

  const appendMessage = useCallback((entry: ConversationMessage) => {
    setMessages((prev) => trimHistory([...prev, entry]));
  }, []);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = input.trim();
    if (!value || isLoading || cooldown > 0) return;

    appendMessage({
      id: createMessageId(),
      role: "user",
      text: value,
    });
    setInput("");
    clearError();

    try {
      const response = await ask(value, { useRag });
      appendMessage({
        id: response.requestId || createMessageId(),
        role: "assistant",
        text: response.answer,
        sources: response.sources,
        requestId: response.requestId,
      });
    } catch (chatError) {
      // Only log in development mode
      if (process.env.NODE_ENV === "development") {
        console.error("KyradiChat ask failed", chatError);
      }
      
      // Handle typed errors from backend
      let errorMessage = "Bir hata oluştu";
      let retryAfter = 0;
      
      if (chatError instanceof Error) {
        const aiError = chatError as Error & { code?: string; retryAfterSeconds?: number };
        
        if (aiError.code === "RATE_LIMIT") {
          errorMessage = "Asistan şu anda yoğun, lütfen daha sonra tekrar deneyin.";
          retryAfter = aiError.retryAfterSeconds || 10;
          setCooldown(retryAfter);
        } else if (aiError.code === "AI_DISABLED") {
          errorMessage = "AI servisi şu anda yapılandırılmamış. Lütfen sistem yöneticinize haber verin.";
        } else if (aiError.code === "AUTH_ERROR") {
          errorMessage = "OpenAI yapılandırmasında sorun var. Lütfen teknik ekiple iletişime geçin.";
        } else {
          errorMessage = aiError.message || "AI asistanı şu anda yanıt veremiyor.";
        }
      }
      
      // Add error message to chat (non-blocking)
      appendMessage({
        id: createMessageId(),
        role: "assistant",
        text: errorMessage,
        isError: true,
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleRetry = async () => {
    clearError();
    const result = await retry();
    if (result) {
      // Remove last error message if exists
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.isError) {
          return [
            ...prev.slice(0, -1),
            {
              id: result.requestId || createMessageId(),
              role: "assistant" as const,
              text: result.answer,
              sources: result.sources,
              requestId: result.requestId,
            },
          ];
        }
        return [
          ...prev,
          {
            id: result.requestId || createMessageId(),
            role: "assistant" as const,
            text: result.answer,
            sources: result.sources,
            requestId: result.requestId,
          },
        ];
      });
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Reset height to auto to get the correct scrollHeight
    e.target.style.height = "auto";
    // Set height to scrollHeight (capped at max-height via CSS)
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className={`kyradi-chat kyradi-chat--${theme}`}>
      {/* Header with branding */}
      <div className="kyradi-chat__header">
        <div className="kyradi-chat__avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span className="kyradi-chat__brand">{copy.brandName}</span>
      </div>

      {/* Messages */}
      <div ref={listRef} className="kyradi-chat__messages" aria-live="polite">
        {/* Welcome message when no messages */}
        {messages.length === 0 && !isLoading && (
          <div className="kyradi-chat__welcome">
            <div className="kyradi-chat__welcome-title">{copy.welcomeTitle}</div>
            <div className="kyradi-chat__welcome-text">{copy.welcomeMessage}</div>
            <div className="kyradi-chat__suggestions">
              <button
                type="button"
                className="kyradi-chat__suggestion"
                onClick={() => {
                  setInput(copy.suggestionReservation);
                  inputRef.current?.focus();
                }}
              >
                {copy.suggestionReservation}
              </button>
              <button
                type="button"
                className="kyradi-chat__suggestion"
                onClick={() => {
                  setInput(copy.suggestionPayment);
                  inputRef.current?.focus();
                }}
              >
                {copy.suggestionPayment}
              </button>
              <button
                type="button"
                className="kyradi-chat__suggestion"
                onClick={() => {
                  setInput(copy.suggestionWidget);
                  inputRef.current?.focus();
                }}
              >
                {copy.suggestionWidget}
              </button>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`kyradi-chat__message kyradi-chat__message--${message.role}${message.isError ? " kyradi-chat__message--error" : ""}`}
          >
            <div className="kyradi-chat__bubble">{message.text}</div>
            {message.sources && message.sources.length > 0 ? (
              <details className="kyradi-chat__sources">
                <summary>
                  {copy.sources} ({message.sources.length})
                </summary>
                <ul>
                  {message.sources.map((source, index) => (
                    <li key={`${message.id}-source-${index}`}>
                      <strong>{source.title}:</strong> {source.snippet}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ))}
        {isLoading ? (
          <div className="kyradi-chat__typing">
            <div className="kyradi-chat__typing-dots">
              <span className="kyradi-chat__typing-dot" />
              <span className="kyradi-chat__typing-dot" />
              <span className="kyradi-chat__typing-dot" />
            </div>
            {copy.typing}
          </div>
        ) : null}
      </div>

      {/* Error with retry */}
      {error && !isLoading ? (
        <div className="kyradi-chat__error">
          <span className="kyradi-chat__error-text">{error}</span>
          <button className="kyradi-chat__error-retry" onClick={handleRetry} type="button">
            {copy.retry}
          </button>
        </div>
      ) : null}

      {/* Input form */}
      <form className="kyradi-chat__form" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="kyradi-chat__input"
          placeholder={copy.placeholder}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
        />
        <button className="kyradi-chat__button" type="submit" disabled={!input.trim() || isLoading}>
          {copy.send}
        </button>
      </form>
    </div>
  );
}

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.innerHTML = baseStyles;
  document.head.appendChild(style);
}

function readHistory(key: string): ConversationMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(-MAX_HISTORY);
    }
    return [];
  } catch {
    return [];
  }
}

function trimHistory(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.slice(-MAX_HISTORY);
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
