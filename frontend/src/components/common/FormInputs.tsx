import { useState, useCallback, forwardRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Info } from "../../lib/lucide";

// ============================================
// Input Masks
// ============================================

/**
 * Format phone number as user types
 * Example: 5551234567 -> (555) 123-4567
 */
export function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  
  if (numbers.length === 0) return '';
  if (numbers.length <= 3) return `(${numbers}`;
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
}

/**
 * Format Turkish ID number (TCKN)
 * Only allows 11 digits
 */
export function formatTCKN(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/**
 * Format credit card number
 * Example: 1234567890123456 -> 1234 5678 9012 3456
 */
export function formatCreditCard(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 16);
  return numbers.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Format currency input
 * Example: 15000 -> 150,00 ₺
 */
export function formatCurrency(value: string | number, currency = "TRY"): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return '';
  
  const symbols: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;
  
  return `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

// ============================================
// Masked Input Component
// ============================================

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: 'phone' | 'tckn' | 'creditCard' | 'currency' | 'none';
  value: string;
  onChange: (value: string, rawValue: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  success?: boolean;
  showValidation?: boolean;
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(({
  mask,
  value,
  onChange,
  label,
  error,
  hint,
  success,
  showValidation = true,
  className = '',
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  const formatValue = useCallback((val: string): string => {
    switch (mask) {
      case 'phone': return formatPhoneNumber(val);
      case 'tckn': return formatTCKN(val);
      case 'creditCard': return formatCreditCard(val);
      case 'currency': return val; // Currency formatting handled differently
      default: return val;
    }
  }, [mask]);

  const getRawValue = useCallback((val: string): string => {
    return val.replace(/\D/g, '');
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatValue(e.target.value);
    const raw = getRawValue(e.target.value);
    onChange(formatted, raw);
  }, [formatValue, getRawValue, onChange]);

  const hasError = !!error;
  const isValid = success && !hasError;

  return (
    <div className={`form-field ${className}`} style={{ marginBottom: 'var(--space-4)' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 'var(--space-2)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          {label}
          {props.required && <span style={{ color: 'var(--danger-500)', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '10px 40px 10px 12px',
            borderRadius: 'var(--radius-lg)',
            border: `1.5px solid ${hasError ? 'var(--danger-500)' : isValid ? 'var(--success-500)' : isFocused ? 'var(--primary)' : 'var(--border-primary)'}`,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease',
            outline: 'none',
            boxShadow: isFocused ? `0 0 0 3px ${hasError ? 'var(--danger-100)' : isValid ? 'var(--success-100)' : 'var(--primary-100)'}` : 'none',
          }}
          {...props}
        />
        
        {showValidation && (hasError || isValid) && (
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}>
            {hasError ? (
              <AlertCircle className="h-4 w-4" style={{ color: 'var(--danger-500)' }} />
            ) : (
              <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success-500)' }} />
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(error || hint) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            style={{
              marginTop: 'var(--space-1)',
              fontSize: '0.75rem',
              color: hasError ? 'var(--danger-500)' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            {hasError ? <AlertCircle className="h-3 w-3" /> : hint && <Info className="h-3 w-3" />}
            {error || hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

MaskedInput.displayName = 'MaskedInput';

// ============================================
// Password Input with Strength
// ============================================

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  showStrength?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({
  value,
  onChange,
  label,
  error,
  showStrength = false,
  className = '',
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const strengthScore = useMemo(() => {
    if (!showStrength || !value) return 0;
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) score++;
    return score;
  }, [value, showStrength]);

  const strengthConfig = useMemo(() => {
    const configs = [
      { label: '', color: 'var(--bg-tertiary)', width: '0%' },
      { label: 'Çok Zayıf', color: 'var(--danger-500)', width: '20%' },
      { label: 'Zayıf', color: 'var(--warning-500)', width: '40%' },
      { label: 'Orta', color: 'var(--info-500)', width: '60%' },
      { label: 'Güçlü', color: 'var(--success-500)', width: '80%' },
      { label: 'Çok Güçlü', color: 'var(--success-600)', width: '100%' },
    ];
    return configs[strengthScore];
  }, [strengthScore]);

  const hasError = !!error;

  return (
    <div className={`form-field ${className}`} style={{ marginBottom: 'var(--space-4)' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 'var(--space-2)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          {label}
          {props.required && <span style={{ color: 'var(--danger-500)', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '10px 40px 10px 12px',
            borderRadius: 'var(--radius-lg)',
            border: `1.5px solid ${hasError ? 'var(--danger-500)' : isFocused ? 'var(--primary)' : 'var(--border-primary)'}`,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease',
            outline: 'none',
            boxShadow: isFocused ? `0 0 0 3px ${hasError ? 'var(--danger-100)' : 'var(--primary-100)'}` : 'none',
          }}
          {...props}
        />
        
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-tertiary)',
          }}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-1)',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Şifre Gücü:</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: strengthConfig.color }}>
              {strengthConfig.label}
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: strengthConfig.width }}
              style={{
                height: '100%',
                background: strengthConfig.color,
                borderRadius: 'var(--radius-full)',
              }}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            style={{
              marginTop: 'var(--space-1)',
              fontSize: '0.75rem',
              color: 'var(--danger-500)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <AlertCircle className="h-3 w-3" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

// Helper for useMemo
function useMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const [value, setValue] = useState<T>(factory);
  
  useEffect(() => {
    setValue(factory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  
  return value;
}

// ============================================
// Confirm Dialog
// ============================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Onayla',
  cancelText = 'İptal',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const variantColors = {
    danger: { bg: 'var(--danger-100)', color: 'var(--danger-600)', button: 'var(--danger-500)' },
    warning: { bg: 'var(--warning-100)', color: 'var(--warning-600)', button: 'var(--warning-500)' },
    info: { bg: 'var(--info-100)', color: 'var(--info-600)', button: 'var(--info-500)' },
  };

  const colors = variantColors[variant];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            maxWidth: '400px',
            width: '90%',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            background: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)',
          }}>
            <AlertCircle className="h-6 w-6" style={{ color: colors.color }} />
          </div>

          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)',
          }}>
            {title}
          </h3>

          <p style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-6)',
            lineHeight: 1.5,
          }}>
            {message}
          </p>

          <div style={{
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: colors.button,
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? 'İşleniyor...' : confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

