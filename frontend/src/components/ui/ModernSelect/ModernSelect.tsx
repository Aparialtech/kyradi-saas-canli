import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from '../../../lib/lucide';
import styles from './ModernSelect.module.css';

export interface ModernSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ModernSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Field label */
  label?: string;
  /** Select options */
  options: ModernSelectOption[];
  /** Placeholder option (first empty option) */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Whether field is required */
  required?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Custom class name for container */
  containerClassName?: string;
}

export const ModernSelect = React.forwardRef<HTMLSelectElement, ModernSelectProps>(
  (
    {
      label,
      options,
      placeholder,
      error,
      helperText,
      required,
      fullWidth,
      size = 'md',
      leftIcon,
      containerClassName,
      className,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div
        className={clsx(
          styles.container,
          fullWidth && styles.fullWidth,
          containerClassName
        )}
      >
        {label && (
          <label htmlFor={selectId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div
          className={clsx(
            styles.selectWrapper,
            styles[`selectWrapper--${size}`],
            error && styles['selectWrapper--error'],
            disabled && styles['selectWrapper--disabled']
          )}
        >
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}

          <select
            ref={ref}
            id={selectId}
            className={clsx(
              styles.select,
              styles[`select--${size}`],
              leftIcon && styles.selectWithLeftIcon,
              className
            )}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled={required}>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          <span className={styles.chevronIcon}>
            <ChevronDown />
          </span>
        </div>

        {(error || helperText) && (
          <p
            id={error ? `${selectId}-error` : `${selectId}-helper`}
            className={clsx(styles.helperText, error && styles.errorText)}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

ModernSelect.displayName = 'ModernSelect';
