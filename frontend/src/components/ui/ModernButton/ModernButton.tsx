import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import styles from './ModernButton.module.css';

export interface ModernButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      className={clsx(
        styles.button,
        styles[`button--${variant}`],
        styles[`button--${size}`],
        {
          [styles['button--fullWidth']]: fullWidth,
          [styles['button--loading']]: isLoading,
          [styles['button--disabled']]: isDisabled,
        },
        className
      )}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02, y: -1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...props}
    >
      {isLoading ? (
        <>
          <span className={styles.spinner} />
          {loadingText && <span className={styles.loadingText}>{loadingText}</span>}
        </>
      ) : (
        <>
          {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
          {children && <span className={styles.content}>{children}</span>}
          {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
        </>
      )}
    </motion.button>
  );
};

