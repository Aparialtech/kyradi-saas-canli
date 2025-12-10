import { useEffect, useMemo, useState, useRef, useCallback } from "react";

import { KyradiChat } from "./KyradiChat";
import { useAuth } from "../context/AuthContext";
import { env } from "../config/env";
import { useTranslation } from "../hooks/useTranslation";
import { MessageSquare, X } from "../lib/lucide";

const floatingStyles = `
.kyradi-chat-widget {
  position: fixed !important;
  z-index: 99999 !important;
  display: flex !important;
  flex-direction: column;
  align-items: flex-end;
  user-select: none;
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
  cursor: grab;
  box-shadow: 0 8px 24px rgba(0, 163, 137, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
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
  max-height: 600px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15);
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  transform-origin: bottom right;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
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
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Load saved position from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate saved position
          if (parsed.x != null && parsed.y != null && parsed.x >= 0 && parsed.y >= 0) {
            return { x: parsed.x, y: parsed.y };
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
      // Default to bottom-right corner
      return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
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
  // Show widget if user is logged in (admin users may not have tenant_id)
  const isEligible = Boolean(userId);

  const ariaLabel = useMemo(() => (open ? t("chat.close") : t("chat.open")), [open, t]);

  // Early return AFTER all hooks (this is safe)
  if (!isEligible) {
    return null;
  }

  // Use fixed positioning if position is valid (>= 0)
  // Otherwise use CSS defaults (right: 24px, bottom: 24px)
  const widgetStyle: React.CSSProperties = position.x >= 0 && position.y >= 0
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : {
        right: "24px",
        bottom: "24px",
        left: "auto",
        top: "auto",
      };

  return (
    <div ref={widgetRef} className="kyradi-chat-widget" style={widgetStyle}>
      <div className={`kyradi-chat-widget__panel ${open ? "" : "kyradi-chat-widget__panel--hidden"}`}>
        {open && (
          <KyradiChat
            apiBase={env.API_URL}
            tenantId={tenantId || undefined}
            userId={userId!}
            locale={locale}
            theme="light"
            useAssistantEndpoint={true}
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
      >
        {open ? <X /> : <MessageSquare />}
      </button>
    </div>
  );
}
