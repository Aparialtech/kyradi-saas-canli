import { useEffect, useMemo, useState } from "react";

import { KyradiChat } from "./KyradiChat";
import { useAuth } from "../context/AuthContext";
import { env } from "../config/env";
import { useTranslation } from "../hooks/useTranslation";

const floatingStyles = `
.kyradi-chat-widget {
  position: fixed;
  z-index: 999;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.kyradi-chat-widget__toggle {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 12px 25px rgba(37, 99, 235, 0.4);
  animation: kyradi-bounce 2.5s infinite;
}
.kyradi-chat-widget__panel {
  width: 340px;
  max-height: 540px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 40px 60px rgba(15, 23, 42, 0.3);
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.1);
  transform-origin: bottom right;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.kyradi-chat-widget__panel--hidden {
  transform: scale(0.8);
  opacity: 0;
  pointer-events: none;
}
@keyframes kyradi-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@media (max-width: 640px) {
  .kyradi-chat-widget {
    right: 16px;
    bottom: 16px;
  }
  .kyradi-chat-widget__panel {
    width: calc(100vw - 32px);
  }
}
`;

export function FloatingChatWidget() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (document.getElementById("kyradi-chat-widget-style")) return;
    const style = document.createElement("style");
    style.id = "kyradi-chat-widget-style";
    style.innerHTML = floatingStyles;
    document.head.appendChild(style);
  }, []);

  const tenantId = user?.tenant_id;
  const userId = user?.id;
  const isEligible = Boolean(tenantId && userId);

  const toggleLabel = useMemo(() => (open ? "×" : "💬"), [open]);

  if (!isEligible) {
    return null;
  }

  const ariaLabel = open ? t("chat.close") : t("chat.open");

  return (
    <div className="kyradi-chat-widget">
      <div className={`kyradi-chat-widget__panel ${open ? "" : "kyradi-chat-widget__panel--hidden"}`}>
        {open && (
          <KyradiChat
            apiBase={env.API_URL}
            tenantId={tenantId!}
            userId={userId!}
            locale={locale}
            theme="light"
            useAssistantEndpoint={true}
          />
        )}
      </div>
      <button
        type="button"
        className="kyradi-chat-widget__toggle"
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        {toggleLabel}
      </button>
    </div>
  );
}
