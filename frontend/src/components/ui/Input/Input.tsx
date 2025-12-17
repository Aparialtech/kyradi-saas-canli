import React from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  isError?: boolean;
  isSuccess?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      inputSize = 'md',
      isError = false,
      isSuccess = false,
      required,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={styles['input-wrapper']}>
        {label && (
          <label
            className={clsx(
              styles['input-label'],
              required && styles['input-label--required']
            )}
          >
            {label}
          </label>
        )}
        
        <div style={{ position: 'relative' }}>
          {leftIcon && (
            <span className={clsx(styles['input-icon'], styles['input-icon--left'])}>
              {leftIcon}
            </span>
          )}
          
          <input
            ref={ref}
            className={clsx(
              styles.input,
              styles[`input--${inputSize}`],
              (error || isError) && styles['input--error'],
              isSuccess && styles['input--success'],
              leftIcon && styles['input--with-left-icon'],
              rightIcon && styles['input--with-right-icon'],
              className
            )}
            {...props}
          />
          
          {rightIcon && (
            <span className={clsx(styles['input-icon'], styles['input-icon--right'])}>
              {rightIcon}
            </span>
          )}
        </div>
        
        {error && <span className={styles['input-error']}>{error}</span>}
        {!error && helperText && <span className={styles['input-helper']}>{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      isError = false,
      required,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={styles['input-wrapper']}>
        {label && (
          <label
            className={clsx(
              styles['input-label'],
              required && styles['input-label--required']
            )}
          >
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          className={clsx(
            styles.input,
            styles.textarea,
            (error || isError) && styles['input--error'],
            className
          )}
          {...props}
        />
        
        {error && <span className={styles['input-error']}>{error}</span>}
        {!error && helperText && <span className={styles['input-helper']}>{helperText}</span>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

