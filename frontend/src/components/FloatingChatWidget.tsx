import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { KyradiChat } from "./KyradiChat";
import { useAuth } from "../context/AuthContext";
import { env } from "../config/env";
import { useTranslation } from "../hooks/useTranslation";
import { MessageSquare, X } from "../lib/lucide";

// Page context descriptions for AI assistant
const pageContextMap: Record<string, { page: string; description: string; entityType?: string }> = {
  "/app": { page: "dashboard", description: "Ana panel - genel istatistikler ve özet" },
  "/app/locations": { page: "locations", description: "Lokasyonlar listesi", entityType: "location" },
  "/app/lockers": { page: "warehouses", description: "Depolar/Dolaplar listesi", entityType: "warehouse" },
  "/app/reservations": { page: "reservations", description: "Rezervasyonlar listesi", entityType: "reservation" },
  "/app/qr-verification": { page: "qr-verification", description: "QR kod doğrulama sayfası" },
  "/app/revenue-report": { page: "reports", description: "Gelir raporları ve analizler" },
  "/app/settlements": { page: "settlements", description: "Hakedişler ve mutabakat" },
  "/app/users": { page: "users", description: "Kullanıcı yönetimi", entityType: "user" },
  "/app/staff": { page: "staff", description: "Çalışan yönetimi", entityType: "staff" },
  "/app/pricing": { page: "pricing", description: "Ücretlendirme kuralları", entityType: "pricing" },
  "/app/tickets": { page: "tickets", description: "Destek talepleri / İletişim", entityType: "ticket" },
  "/app/settings": { page: "settings", description: "Hesap ve sistem ayarları" },
};

const floatingStyles = `
.kyradi-chat-widget {
  position: fixed !important;
  right: 24px !important;
  bottom: 24px !important;
  left: auto !important;
  top: auto !important;
  z-index: 99999 !important;
  display: flex !important;
  flex-direction: column-reverse !important;
  align-items: flex-end !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
}
.kyradi-chat-widget__toggle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #00a389 0%, #0066ff 100%);
  color: white;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 163, 137, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  z-index: 3 !important;
  flex-shrink: 0;
  order: 1;
}
.kyradi-chat-widget__toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(0, 163, 137, 0.4);
}
.kyradi-chat-widget__toggle:active {
  transform: scale(0.95);
}
.kyradi-chat-widget__toggle svg {
  width: 24px;
  height: 24px;
  stroke-width: 2.5;
}
.kyradi-chat-widget__toggle--close svg {
  width: 20px;
  height: 20px;
}
.kyradi-chat-widget__panel {
  width: 380px;
  max-height: calc(100vh - 100px);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15);
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  transform-origin: bottom right;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  position: relative;
  z-index: 1;
  order: 2;
}
.kyradi-chat-widget__panel--hidden {
  transform: scale(0.85) translateY(10px);
  opacity: 0;
  pointer-events: none;
}
@media (max-width: 640px) {
  .kyradi-chat-widget {
    right: 16px !important;
    bottom: 16px !important;
  }
  .kyradi-chat-widget__panel {
    width: calc(100vw - 32px);
    max-width: 380px;
    max-height: calc(100vh - 100px);
  }
}
`;

export function FloatingChatWidget() {
  const { user, isLoading } = useAuth();
  const { t, locale } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Inject CSS styles
  useEffect(() => {
    if (document.getElementById("kyradi-chat-widget-style")) return;
    const style = document.createElement("style");
    style.id = "kyradi-chat-widget-style";
    style.innerHTML = floatingStyles;
    document.head.appendChild(style);
  }, []);

  const tenantId = user?.tenant_id;
  const userId = user?.id;
  const isEligible = !isLoading && Boolean(userId);

  const ariaLabel = useMemo(() => (open ? t("chat.close") : t("chat.open")), [open, t]);

  // Determine current page context for AI assistant
  const pageContext = useMemo(() => {
    const path = location.pathname;
    
    // Check for exact match first
    if (pageContextMap[path]) {
      return {
        currentPage: pageContextMap[path].page,
        entityType: pageContextMap[path].entityType,
        metadata: { description: pageContextMap[path].description },
      };
    }
    
    // Check for edit/detail pages with ID
    const editMatch = path.match(/^\/app\/(\w+)\/([^/]+)\/(edit|new)$/);
    if (editMatch) {
      const [, section, entityId, action] = editMatch;
      const baseContext = pageContextMap[`/app/${section}`];
      return {
        currentPage: `${section}-${action}`,
        entityId: action === "new" ? undefined : entityId,
        entityType: baseContext?.entityType,
        metadata: { 
          description: `${baseContext?.description || section} - ${action === "new" ? "yeni oluşturma" : "düzenleme"}`,
          action,
        },
      };
    }
    
    // Partial match for parent routes
    for (const [key, value] of Object.entries(pageContextMap)) {
      if (path.startsWith(key) && key !== "/app") {
        return {
          currentPage: value.page,
          entityType: value.entityType,
          metadata: { description: value.description },
        };
      }
    }
    
    return {
      currentPage: "unknown",
      metadata: { path },
    };
  }, [location.pathname]);

  // Don't render if not eligible
  if (!isEligible) {
    return null;
  }

  return (
    <div 
      className="kyradi-chat-widget" 
      data-testid="floating-chat-widget"
    >
      <div className={`kyradi-chat-widget__panel ${open ? "" : "kyradi-chat-widget__panel--hidden"}`}>
        {open && userId && (
          <KyradiChat
            apiBase={env.API_URL}
            tenantId={tenantId || undefined}
            userId={userId}
            locale={locale}
            theme="light"
            useAssistantEndpoint={true}
            context={pageContext}
          />
        )}
      </div>
      <button
        type="button"
        className={`kyradi-chat-widget__toggle ${open ? "kyradi-chat-widget__toggle--close" : ""}`}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? <X /> : <MessageSquare />}
      </button>
    </div>
  );
}
