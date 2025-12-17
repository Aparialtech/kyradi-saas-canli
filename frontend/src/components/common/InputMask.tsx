import { useState, useCallback, forwardRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertCircle } from "../../lib/lucide";

type MaskType = 'phone' | 'tc' | 'credit-card' | 'currency' | 'date' | 'time' | 'custom';

interface InputMaskProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  maskType: MaskType;
  customMask?: string; // e.g., "###-###-####" for phone
  value: string;
  onChange: (value: string, rawValue: string) => void;
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  showValidation?: boolean;
  validateOnBlur?: boolean;
  validator?: (value: string) => string | null;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// Mask patterns
const MASKS: Record<MaskType, { pattern: string; placeholder: string; validator?: RegExp }> = {
  'phone': { 
    pattern: '(###) ### ## ##', 
    placeholder: '(5XX) XXX XX XX',
    validator: /^\(\d{3}\) \d{3} \d{2} \d{2}$/,
  },
  'tc': { 
    pattern: '###########', 
    placeholder: 'TC Kimlik No (11 haneli)',
    validator: /^\d{11}$/,
  },
  'credit-card': { 
    pattern: '#### #### #### ####', 
    placeholder: 'Kart Numarası',
    validator: /^\d{4} \d{4} \d{4} \d{4}$/,
  },
  'currency': { 
    pattern: '', // Special handling
    placeholder: '0,00 ₺',
  },
  'date': { 
    pattern: '##/##/####', 
    placeholder: 'GG/AA/YYYY',
    validator: /^\d{2}\/\d{2}\/\d{4}$/,
  },
  'time': { 
    pattern: '##:##', 
    placeholder: 'SS:DD',
    validator: /^\d{2}:\d{2}$/,
  },
  'custom': { 
    pattern: '', 
    placeholder: '',
  },
};

// Apply mask to value
function applyMask(value: string, pattern: string): string {
  if (!pattern) return value;
  
  const digits = value.replace(/\D/g, '');
  let result = '';
  let digitIndex = 0;
  
  for (let i = 0; i < pattern.length && digitIndex < digits.length; i++) {
    if (pattern[i] === '#') {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += pattern[i];
    }
  }
  
  return result;
}

// Format currency
function formatCurrency(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  
  const cents = parseInt(num, 10);
  const formatted = (cents / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatted + ' ₺';
}

// TC Kimlik No validator (Luhn algorithm)
function validateTCKN(tc: string): boolean {
  if (tc.length !== 11) return false;
  if (tc[0] === '0') return false;
  
  const digits = tc.split('').map(Number);
  const sum1 = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const sum2 = digits[1] + digits[3] + digits[5] + digits[7];
  const check1 = ((sum1 * 7) - sum2) % 10;
  const check2 = (digits.slice(0, 10).reduce((a, b) => a + b, 0)) % 10;
  
  return digits[9] === check1 && digits[10] === check2;
}

export const InputMask = forwardRef<HTMLInputElement, InputMaskProps>(({
  maskType,
  customMask,
  value,
  onChange,
  label,
  error,
  success,
  hint,
  showValidation = true,
  validateOnBlur = true,
  validator,
  required = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const mask = maskType === 'custom' ? { pattern: customMask || '', placeholder: '' } : MASKS[maskType];

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    let maskedValue: string;
    let rawValue: string;

    if (maskType === 'currency') {
      rawValue = inputValue.replace(/\D/g, '');
      maskedValue = formatCurrency(inputValue);
    } else {
      rawValue = inputValue.replace(/\D/g, '');
      maskedValue = applyMask(inputValue, mask.pattern);
    }

    onChange(maskedValue, rawValue);
    
    // Clear error on change
    if (internalError) setInternalError(null);
  }, [maskType, mask.pattern, onChange, internalError]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsTouched(true);

    if (!validateOnBlur) return;

    const rawValue = value.replace(/\D/g, '');

    // Required validation
    if (required && !rawValue) {
      setInternalError('Bu alan zorunludur');
      return;
    }

    // Custom validator
    if (validator) {
      const customError = validator(rawValue);
      if (customError) {
        setInternalError(customError);
        return;
      }
    }

    // Built-in validators
    if (maskType === 'tc' && rawValue) {
      if (!validateTCKN(rawValue)) {
        setInternalError('Geçersiz TC Kimlik No');
        return;
      }
    }

    if (maskType === 'phone' && rawValue && rawValue.length < 10) {
      setInternalError('Telefon numarası 10 haneli olmalıdır');
      return;
    }

    setInternalError(null);
  }, [value, required, validator, validateOnBlur, maskType]);

  const displayError = error || internalError;
  const showError = showValidation && displayError && isTouched;
  const showSuccess = showValidation && success && isTouched && !displayError;

  const borderColor = showError 
    ? 'var(--danger-500)' 
    : showSuccess 
      ? 'var(--success-500)' 
      : isFocused 
        ? 'var(--primary)' 
        : 'var(--border-primary)';

  return (
    <div className={`input-mask-wrapper ${className}`} style={{ marginBottom: 'var(--space-4)' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 'var(--space-2)',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}>
          {label}
          {required && <span style={{ color: 'var(--danger-500)', marginLeft: '2px' }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}>
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={mask.placeholder}
          style={{
            width: '100%',
            padding: `10px ${rightIcon || showError || showSuccess ? '40px' : '12px'} 10px ${leftIcon ? '40px' : '12px'}`,
            border: `2px solid ${borderColor}`,
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9rem',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isFocused ? `0 0 0 3px ${showError ? 'rgba(239, 68, 68, 0.1)' : showSuccess ? 'rgba(34, 197, 94, 0.1)' : 'var(--primary-100)'}` : 'none',
            backgroundColor: disabled ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          {...props}
        />

        {/* Validation icon */}
        {(rightIcon || showError || showSuccess) && (
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}>
            {showError ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <XCircle className="h-5 w-5" style={{ color: 'var(--danger-500)' }} />
              </motion.div>
            ) : showSuccess ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success-500)' }} />
              </motion.div>
            ) : rightIcon}
          </div>
        )}
      </div>

      {/* Error/Success/Hint message */}
      {(showError || showSuccess || hint) && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 'var(--space-1)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: showError ? 'var(--danger-500)' : showSuccess ? 'var(--success-500)' : 'var(--text-tertiary)',
          }}
        >
          {showError && <AlertCircle className="h-3 w-3" />}
          {showError ? displayError : showSuccess ? success : hint}
        </motion.div>
      )}
    </div>
  );
});

InputMask.displayName = 'InputMask';

export default InputMask;

