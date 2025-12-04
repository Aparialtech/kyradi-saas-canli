import React from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

export interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  solid?: boolean;
  pill?: boolean;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  solid = false,
  pill = false,
  dot = false,
  children,
  className,
}) => {
  return (
    <span
      className={clsx(
        styles.badge,
        styles[`badge--${variant}`],
        styles[`badge--${size}`],
        solid && styles['badge--solid'],
        pill && styles['badge--pill'],
        dot && styles['badge--with-dot'],
        className
      )}
    >
      {dot && <span className={styles.badge__dot} />}
      {children}
    </span>
  );
};

