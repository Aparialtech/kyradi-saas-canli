import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './ModernInput.module.css';

export interface ModernInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
  inputSize?: 'sm' | 'md' | 'lg';
}

export const ModernInput = forwardRef<HTMLInputElement, ModernInputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      variant = 'default',
      inputSize = 'md',
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className={clsx(styles.container, { [styles.fullWidth]: fullWidth }, className)}>
        {label && (
          <label className={styles.label} htmlFor={props.id}>
            {label}
            {props.required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div
          className={clsx(
            styles.inputWrapper,
            styles[`inputWrapper--${variant}`],
            styles[`inputWrapper--${inputSize}`],
            {
              [styles['inputWrapper--error']]: !!error,
              [styles['inputWrapper--disabled']]: disabled,
              [styles['inputWrapper--withLeftIcon']]: !!leftIcon,
              [styles['inputWrapper--withRightIcon']]: !!rightIcon,
            }
          )}
        >
          {leftIcon && <div className={styles.leftIcon}>{leftIcon}</div>}

          <input
            ref={ref}
            className={styles.input}
            disabled={disabled}
            {...props}
          />

          {rightIcon && <div className={styles.rightIcon}>{rightIcon}</div>}
        </div>

        {(error || helperText) && (
          <motion.p
            className={clsx(styles.helperText, { [styles.errorText]: !!error })}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error || helperText}
          </motion.p>
        )}
      </div>
    );
  }
);

ModernInput.displayName = 'ModernInput';

