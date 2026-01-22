import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disableClose) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
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
