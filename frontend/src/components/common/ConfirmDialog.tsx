import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Trash2, CheckCircle2, Info, HelpCircle } from "../../lib/lucide";

type DialogVariant = 'danger' | 'warning' | 'success' | 'info' | 'question';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  loading?: boolean;
  // Additional options
  showIcon?: boolean;
  icon?: React.ReactNode;
  confirmButtonVariant?: 'primary' | 'danger' | 'success' | 'warning';
  disableBackdropClose?: boolean;
  disableEscapeClose?: boolean;
  // For delete confirmations
  requireConfirmation?: boolean;
  confirmationText?: string;
  confirmationPlaceholder?: string;
}

const VARIANT_CONFIG: Record<DialogVariant, {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  confirmBg: string;
  confirmHover: string;
}> = {
  danger: {
    icon: <Trash2 className="h-6 w-6" />,
    iconBg: 'rgba(239, 68, 68, 0.1)',
    iconColor: 'var(--danger-500)',
    confirmBg: 'var(--danger-500)',
    confirmHover: 'var(--danger-600)',
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: 'var(--warning-500)',
    confirmBg: 'var(--warning-500)',
    confirmHover: 'var(--warning-600)',
  },
  success: {
    icon: <CheckCircle2 className="h-6 w-6" />,
    iconBg: 'rgba(34, 197, 94, 0.1)',
    iconColor: 'var(--success-500)',
    confirmBg: 'var(--success-500)',
    confirmHover: 'var(--success-600)',
  },
  info: {
    icon: <Info className="h-6 w-6" />,
    iconBg: 'rgba(59, 130, 246, 0.1)',
    iconColor: 'var(--info-500)',
    confirmBg: 'var(--primary)',
    confirmHover: 'var(--primary-dark)',
  },
  question: {
    icon: <HelpCircle className="h-6 w-6" />,
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconColor: '#8b5cf6',
    confirmBg: 'var(--primary)',
    confirmHover: 'var(--primary-dark)',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Onayla',
  cancelText = 'İptal',
  variant = 'question',
  loading = false,
  showIcon = true,
  icon,
  confirmButtonVariant,
  disableBackdropClose = false,
  disableEscapeClose = false,
  requireConfirmation = false,
  confirmationText = '',
  confirmationPlaceholder = 'Onaylamak için yazın...',
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const config = VARIANT_CONFIG[variant];

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && requireConfirmation) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen, requireConfirmation]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || disableEscapeClose) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, disableEscapeClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !disableBackdropClose) {
      onClose();
    }
  }, [onClose, disableBackdropClose]);

  const handleConfirm = useCallback(() => {
    if (requireConfirmation && inputValue !== confirmationText) return;
    onConfirm();
  }, [onConfirm, requireConfirmation, inputValue, confirmationText]);

  const isConfirmDisabled = loading || (requireConfirmation && inputValue !== confirmationText);

  const confirmBg = confirmButtonVariant 
    ? confirmButtonVariant === 'danger' ? 'var(--danger-500)' 
      : confirmButtonVariant === 'success' ? 'var(--success-500)'
      : confirmButtonVariant === 'warning' ? 'var(--warning-500)'
      : 'var(--primary)'
    : config.confirmBg;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 9999,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: '420px',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--text-tertiary)',
                borderRadius: 'var(--radius-md)',
                transition: 'background-color 0.2s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content */}
            <div style={{ padding: 'var(--space-6)' }}>
              {/* Icon */}
              {showIcon && (
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: config.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)',
                  color: config.iconColor,
                }}>
                  {icon || config.icon}
                </div>
              )}

              {/* Title */}
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                {title}
              </h3>

              {/* Message */}
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                {message}
              </div>

              {/* Confirmation input */}
              {requireConfirmation && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Devam etmek için <strong style={{ color: 'var(--text-primary)' }}>{confirmationText}</strong> yazın:
                  </p>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={confirmationPlaceholder}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isConfirmDisabled) {
                        handleConfirm();
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-6)',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-primary)',
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: isConfirmDisabled ? 'var(--text-tertiary)' : confirmBg,
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'white',
                  cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s ease, opacity 0.2s ease',
                  opacity: isConfirmDisabled ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                    }}
                  />
                )}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for using confirm dialog
import { useState, createContext, useContext } from 'react';

interface ConfirmOptions {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  requireConfirmation?: boolean;
  confirmationText?: string;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, options, resolve });
    });
  }, []);

  const handleClose = useCallback(() => {
    state.resolve?.(false);
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.options && (
        <ConfirmDialog
          isOpen={state.isOpen}
          onClose={handleClose}
          onConfirm={handleConfirm}
          {...state.options}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}

export default ConfirmDialog;

