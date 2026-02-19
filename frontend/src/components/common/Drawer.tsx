import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DrawerProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string | number;
  disableClose?: boolean;
}

export function Drawer({
  isOpen,
  title,
  onClose,
  children,
  footer,
  width = "520px",
  disableClose = false,
}: DrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disableClose) {
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors));
        if (focusable.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(focusableSelectors);
      if (focusable) {
        focusable.focus();
      } else {
        panel.focus();
      }
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, disableClose]);

  if (!isOpen) {
    return null;
  }

  const content = (
    <div className="drawer-backdrop" role="presentation" onClick={() => !disableClose && onClose()}>
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        style={{ width }}
        tabIndex={-1}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || !disableClose) && (
          <header className="drawer-panel__header">
            {title && (
              <h3 className="drawer-panel__title" id="drawer-title">
                {title}
              </h3>
            )}
            {!disableClose && (
              <button className="drawer-panel__close" type="button" onClick={onClose} aria-label="Kapat">
                ×
              </button>
            )}
          </header>
        )}
        <div className="drawer-panel__body">{children}</div>
        {footer && <footer className="drawer-panel__footer">{footer}</footer>}
      </aside>
    </div>
  );

  return createPortal(content, document.body);
}
