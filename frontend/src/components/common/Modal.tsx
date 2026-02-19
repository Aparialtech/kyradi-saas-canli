import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string | number;
  disableClose?: boolean;
}

export function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
  width = "480px",
  disableClose = false,
}: ModalProps) {
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
  }, [isOpen, disableClose]); // onClose is stable from parent, no need to include in deps

  if (!isOpen) {
    return null;
  }

  const content = (
    <div className="modal-backdrop" role="presentation" onClick={() => !disableClose && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        style={{ maxWidth: width }}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || !disableClose) && (
          <header className="modal-card__header">
            {title && (
              <h3 className="modal-card__title" id="modal-title">
                {title}
              </h3>
            )}
            {!disableClose && (
              <button className="modal-card__close" type="button" onClick={onClose} aria-label="Kapat">
                ×
              </button>
            )}
          </header>
        )}
        <div className="modal-card__body">{children}</div>
        {footer && <footer className="modal-card__footer">{footer}</footer>}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
