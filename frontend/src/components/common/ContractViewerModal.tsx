import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, CheckCircle2, ChevronDown } from "../../lib/lucide";

interface ContractViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  title: string;
  content: string | ReactNode;
  acceptButtonText?: string;
  closeButtonText?: string;
  requireScroll?: boolean;
  showAcceptButton?: boolean;
}

export function ContractViewerModal({
  isOpen,
  onClose,
  onAccept,
  title,
  content,
  acceptButtonText = "Okudum, Onaylıyorum",
  closeButtonText = "Kapat",
  requireScroll = true,
  showAcceptButton = true,
}: ContractViewerModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasReachedBottom, setHasReachedBottom] = useState(!requireScroll);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Reset scroll state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasReachedBottom(!requireScroll);
      setScrollProgress(0);
    }
  }, [isOpen, requireScroll]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleScroll = useCallback(() => {
    if (!contentRef.current || !requireScroll) return;

    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? Math.min(scrollTop / maxScroll, 1) : 1;
    setScrollProgress(progress);

    // Threshold: user has scrolled to within 8px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 8) {
      setHasReachedBottom(true);
    }
  }, [requireScroll]);

  const handleAccept = () => {
    if (onAccept) onAccept();
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 10000,
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              padding: isMobile ? 0 : "24px",
            }}
          >
            {/* Modal Container */}
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: isMobile ? "100%" : "min(720px, calc(100vw - 48px))",
                maxHeight: isMobile ? "90vh" : "min(80vh, 720px)",
                background: "#ffffff",
                borderRadius: isMobile ? "20px 20px 0 0" : "16px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Premium Header */}
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {/* Decorative top bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#3b82f6",
                    }}
                  >
                    <FileText style={{ width: "20px", height: "20px" }} />
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      fontWeight: 700,
                      color: "#0f172a",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {title}
                  </h3>
                </div>

                <button
                  onClick={onClose}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#f1f5f9",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.color = "#334155";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.color = "#64748b";
                  }}
                  aria-label="Kapat"
                >
                  <X style={{ width: "18px", height: "18px" }} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div
                ref={contentRef}
                onScroll={handleScroll}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                  fontSize: "14px",
                  lineHeight: "1.7",
                  color: "#334155",
                  minHeight: 0,
                }}
              >
                {typeof content === "string" ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: content }}
                    style={{
                      overflowWrap: "anywhere",
                      wordBreak: "normal",
                    }}
                  />
                ) : (
                  content
                )}
              </div>

              {/* Scroll Indicator (shows when not yet scrolled to bottom) */}
              {requireScroll && !hasReachedBottom && (
                <div
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                    borderTop: "1px solid #f59e0b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ChevronDown
                      style={{
                        width: "16px",
                        height: "16px",
                        color: "#92400e",
                        animation: "bounce 1s infinite",
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#92400e" }}>
                      Okumak için aşağı kaydırın
                    </span>
                  </div>
                  <div
                    style={{
                      width: "80px",
                      height: "4px",
                      background: "rgba(146, 64, 14, 0.2)",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${scrollProgress * 100}%`,
                        height: "100%",
                        background: "#d97706",
                        borderRadius: "2px",
                        transition: "width 0.1s ease",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Success Indicator (shows when scrolled to bottom) */}
              {requireScroll && hasReachedBottom && (
                <div
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                    borderTop: "1px solid #10b981",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle2 style={{ width: "16px", height: "16px", color: "#047857" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#047857" }}>
                    Sözleşme okundu ✓
                  </span>
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  gap: "12px",
                  flexDirection: isMobile ? "column" : "row",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={onClose}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "10px",
                    border: "1.5px solid #e2e8f0",
                    background: "#ffffff",
                    color: "#64748b",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    order: isMobile ? 2 : 1,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }}
                >
                  {closeButtonText}
                </button>

                {showAcceptButton && (
                  <button
                    onClick={handleAccept}
                    disabled={requireScroll && !hasReachedBottom}
                    style={{
                      padding: "12px 28px",
                      borderRadius: "10px",
                      border: "none",
                      background: hasReachedBottom || !requireScroll
                        ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                        : "#94a3b8",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: hasReachedBottom || !requireScroll ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      order: isMobile ? 1 : 2,
                      boxShadow: hasReachedBottom || !requireScroll
                        ? "0 4px 14px rgba(34, 197, 94, 0.3)"
                        : "none",
                    }}
                    onMouseOver={(e) => {
                      if (hasReachedBottom || !requireScroll) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(34, 197, 94, 0.4)";
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      if (hasReachedBottom || !requireScroll) {
                        e.currentTarget.style.boxShadow = "0 4px 14px rgba(34, 197, 94, 0.3)";
                      }
                    }}
                  >
                    {(hasReachedBottom || !requireScroll) && (
                      <CheckCircle2 style={{ width: "16px", height: "16px" }} />
                    )}
                    {acceptButtonText}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>

          {/* Bounce animation keyframes */}
          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(4px); }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
