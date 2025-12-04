import React from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

export interface CardProps {
  variant?: 'default' | 'elevated' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  children,
  className,
  style,
  onClick,
}) => {
  return (
    <div
      className={clsx(
        styles.card,
        styles[`card--${variant}`],
        styles[`card--p-${padding}`],
        interactive && styles['card--interactive'],
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <div className={clsx(styles.card__header, className)}>
      {children || (
        <>
          {title && <h3 className={styles.card__title}>{title}</h3>}
          {description && <p className={styles.card__description}>{description}</p>}
        </>
      )}
    </div>
  );
};

export interface CardBodyProps {
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({
  noPadding = false,
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        styles.card__body,
        noPadding && styles['card__body--no-padding'],
        className
      )}
    >
      {children}
    </div>
  );
};

export interface CardFooterProps {
  justify?: 'start' | 'end' | 'between';
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  justify = 'start',
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        styles.card__footer,
        justify === 'end' && styles['card__footer--end'],
        justify === 'between' && styles['card__footer--between'],
        className
      )}
    >
      {children}
    </div>
  );
};

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  icon,
  className,
}) => {
  return (
    <div className={clsx(styles['stat-card'], className)}>
      <div className={styles['stat-card__label']}>{label}</div>
      <div className={styles['stat-card__value']}>{value}</div>
      {change && (
        <div
          className={clsx(
            styles['stat-card__change'],
            change.isPositive
              ? styles['stat-card__change--positive']
              : styles['stat-card__change--negative']
          )}
        >
          <span>{change.isPositive ? '↑' : '↓'}</span>
          <span>{change.value}</span>
        </div>
      )}
      {icon && <div className={styles['stat-card__icon']}>{icon}</div>}
    </div>
  );
};

