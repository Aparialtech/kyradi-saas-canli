import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  z-index: 99999 !important;
  display: flex !important;
  flex-direction: column-reverse !important;
  align-items: flex-end !important;
  user-select: none !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  max-height: none !important;
}
.kyradi-chat-widget__toggle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #00a389 0%, #0066ff 100%);
  color: white;
  cursor: grab;
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
  cursor: grabbing;
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
    left: auto !important;
    top: auto !important;
  }
  .kyradi-chat-widget__panel {
    width: calc(100vw - 32px);
    max-width: 380px;
    max-height: calc(100vh - 100px);
  }
}
@media (min-width: 641px) {
  .kyradi-chat-widget[style*="left: auto"] {
    right: 24px !important;
    bottom: 24px !important;
  }
}
`;

const STORAGE_KEY = "kyradi-chat-widget-position";

export function FloatingChatWidget() {
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const { user, isLoading } = useAuth();
  const { t, locale } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Load saved position from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate saved position - ensure it's within viewport
          if (parsed.x != null && parsed.y != null && parsed.x >= 0 && parsed.y >= 0) {
            const maxX = window.innerWidth - 80;
            const maxY = window.innerHeight - 80;
            // Constrain to viewport
            const constrainedX = Math.max(0, Math.min(parsed.x, maxX));
            const constrainedY = Math.max(0, Math.min(parsed.y, maxY));
            return { x: constrainedX, y: constrainedY };
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
      // Default to bottom-right corner
      const defaultX = Math.max(0, window.innerWidth - 80);
      const defaultY = Math.max(0, window.innerHeight - 80);
      return { x: defaultX, y: defaultY };
    }
    // Server-side rendering fallback
    return { x: -1, y: -1 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Save position to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && position.x > 0 && position.y > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [position]);

  // Inject CSS styles
  useEffect(() => {
    if (document.getElementById("kyradi-chat-widget-style")) return;
    const style = document.createElement("style");
    style.id = "kyradi-chat-widget-style";
    style.innerHTML = floatingStyles;
    document.head.appendChild(style);
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    e.preventDefault();
    setIsDragging(true);
    if (widgetRef.current) {
      const rect = widgetRef.current.getBoundingClientRect();
      dragStartPos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartPos.current) return;
      e.preventDefault();

      if (!dragStartPos.current || !widgetRef.current) return;
      
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;

      // Constrain to viewport
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: constrainedX, y: constrainedY });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartPos.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Compute derived values AFTER all hooks
  const tenantId = user?.tenant_id;
  const userId = user?.id;
  // TEMPORARY: Always show widget for debugging
  // TODO: Change back to: const isEligible = !isLoading && Boolean(userId);
  const isEligible = true; // TEMPORARY: Always visible for debugging

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

  // Debug: Log widget state
  useEffect(() => {
    console.log("[FloatingChatWidget] State:", {
      isLoading,
      userId,
      user,
      isEligible,
      position,
      willRender: isEligible,
    });
  }, [isLoading, userId, user, isEligible, position]);

  // Widget is always rendered now (isEligible = true for debugging)
  console.log("[FloatingChatWidget] Rendering widget!", { isEligible, isLoading, userId });

  // Calculate position: use saved position if valid, otherwise use default bottom-right
  // Constrain position to viewport to prevent widget from being off-screen
  const hasValidPosition = position.x >= 0 && position.y >= 0;
  
  let constrainedPosition = position;
  if (typeof window !== "undefined" && hasValidPosition) {
    const maxX = Math.max(0, window.innerWidth - 80);
    const maxY = Math.max(0, window.innerHeight - 80);
    constrainedPosition = {
      x: Math.max(0, Math.min(position.x, maxX)),
      y: Math.max(0, Math.min(position.y, maxY)),
    };
  }
  
  const widgetStyle: React.CSSProperties = hasValidPosition
    ? {
        left: `${constrainedPosition.x}px`,
        top: `${constrainedPosition.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : {
        right: "24px",
        bottom: "24px",
        left: "auto",
        top: "auto",
      };

  // Log when widget is rendering
  console.log("[FloatingChatWidget] Rendering widget with style:", widgetStyle);

  // Always render widget, control visibility with style
  const widgetDisplayStyle = isEligible ? {
    ...widgetStyle,
    position: "fixed" as const,
    zIndex: 99999,
    display: "flex",
    flexDirection: "column-reverse" as const,
    alignItems: "flex-end" as const,
    visibility: "visible" as const,
    opacity: 1,
    pointerEvents: "auto" as const,
    width: "auto",
    height: "auto",
  } : {
    display: "none",
  };

  console.log("[FloatingChatWidget] Rendering widget!", { isEligible, widgetDisplayStyle });

  return (
    <div 
      ref={widgetRef} 
      className="kyradi-chat-widget" 
      style={widgetDisplayStyle}
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
        onMouseDown={handleMouseDown}
        onClick={() => {
          // Only toggle if not dragging
          if (!isDragging && dragStartPos.current === null) {
            setOpen((prev) => !prev);
          }
        }}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #00a389 0%, #0066ff 100%)",
          color: "white",
          cursor: "grab",
          boxShadow: "0 8px 24px rgba(0, 163, 137, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 3,
          flexShrink: 0,
        }}
      >
        {open ? <X /> : <MessageSquare />}
      </button>
    </div>
  );
}
