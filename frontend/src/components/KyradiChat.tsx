import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useKyradiAI } from "../lib/kyradi-ai";
import type { KyradiAISource } from "../lib/kyradi-ai";

type ChatTheme = "light" | "dark";

interface KyradiChatProps {
  apiBase: string;
  tenantId: string;
  userId: string;
  locale?: string;
  theme?: ChatTheme;
  useRag?: boolean;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: KyradiAISource[];
  requestId?: string;
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
  }
> = {
  "tr-TR": {
    placeholder: "Sorunuzu yazın...",
    send: "Gönder",
    typing: "KYRADİ asistanı yazıyor…",
    sources: "Dayanaklar",
    requestLabel: "İstek",
  },
  "en-US": {
    placeholder: "Type your question...",
    send: "Send",
    typing: "KYRADİ assistant is typing…",
    sources: "Sources",
    requestLabel: "Request",
  },
};

const baseStyles = `
.kyradi-chat {
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  width: 100%;
  max-width: 480px;
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background-color: #ffffff;
}
.kyradi-chat--dark {
  background-color: #101828;
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.89);
}
.kyradi-chat__messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}
.kyradi-chat__message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kyradi-chat__bubble {
  border-radius: 12px;
  padding: 10px 14px;
  line-height: 1.45;
  font-size: 0.95rem;
  background: rgba(16,24,40,0.05);
  color: #0f172a;
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
.kyradi-chat__form {
  display: flex;
  gap: 8px;
}
.kyradi-chat__input {
  flex: 1;
  border: 1px solid rgba(15,23,42,0.2);
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 0.95rem;
  outline: none;
}
.kyradi-chat--dark .kyradi-chat__input {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}
.kyradi-chat__button {
  border-radius: 999px;
  background: #0f66ff;
  color: #fff;
  border: none;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}
.kyradi-chat__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.kyradi-chat__typing {
  font-size: 0.85rem;
  color: rgba(15,23,42,0.6);
}
.kyradi-chat--dark .kyradi-chat__typing {
  color: rgba(255,255,255,0.7);
}
.kyradi-chat__error {
  color: #d92d20;
  font-size: 0.85rem;
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
`;

export function KyradiChat({
  apiBase,
  tenantId,
  userId,
  locale = "tr-TR",
  theme = "light",
  useRag = false,
}: KyradiChatProps) {
  const { ask, isLoading, error } = useKyradiAI({ apiBase, tenantId, userId, locale });
  const copy = chatCopy[locale] ?? chatCopy["tr-TR"];
  const historyKey = useMemo(() => `kyradi.chat.history.${tenantId}.${userId}`, [tenantId, userId]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>(() => readHistory(historyKey));
  const listRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const appendMessage = (entry: ConversationMessage) => {
    setMessages((prev) => trimHistory([...prev, entry]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    appendMessage({
      id: createMessageId(),
      role: "user",
      text: value,
    });
    setInput("");
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
      console.error("KyradiChat ask failed", chatError);
    }
  };

  return (
    <div className={`kyradi-chat kyradi-chat--${theme}`}>
      <div ref={listRef} className="kyradi-chat__messages" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`kyradi-chat__message kyradi-chat__message--${message.role}`}>
            <div className="kyradi-chat__bubble">{message.text}</div>
            {message.requestId && message.role === "assistant" ? (
              <span className="kyradi-chat__meta">
                {copy.requestLabel} #{message.requestId}
              </span>
            ) : null}
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
        {isLoading ? <div className="kyradi-chat__typing">{copy.typing}</div> : null}
      </div>

      {error ? <div className="kyradi-chat__error">{error}</div> : null}

      <form className="kyradi-chat__form" onSubmit={handleSubmit}>
        <input
          className="kyradi-chat__input"
          placeholder={copy.placeholder}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isLoading}
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
