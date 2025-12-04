import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import styles from './ModernCard.module.css';

export interface ModernCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: 'default' | 'glass' | 'elevated' | 'gradient' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  children?: React.ReactNode;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  children,
  className,
  ...props
}) => {
  return (
    <motion.div
      className={clsx(
        styles.card,
        styles[`card--${variant}`],
        styles[`card--padding-${padding}`],
        {
          [styles['card--hoverable']]: hoverable,
        },
        className
      )}
      {...(hoverable && {
        whileHover: { y: -4, scale: 1.01 },
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      })}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Stat Card Component
export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  variant = 'primary',
}) => {
  return (
    <motion.div
      className={clsx(styles.statCard, styles[`statCard--${variant}`])}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      {/* Background Gradient Orb */}
      <div className={styles.statCardOrb} />
      
      {/* Content */}
      <div className={styles.statCardContent}>
        <div className={styles.statCardHeader}>
          <span className={styles.statCardLabel}>{label}</span>
          {icon && <div className={styles.statCardIcon}>{icon}</div>}
        </div>
        
        <div className={styles.statCardValue}>{value}</div>
        
        {(subtitle || trend) && (
          <div className={styles.statCardFooter}>
            {trend && (
              <span
                className={clsx(styles.statCardTrend, {
                  [styles['statCardTrend--positive']]: trend.isPositive,
                  [styles['statCardTrend--negative']]: !trend.isPositive,
                })}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && <span className={styles.statCardSubtitle}>{subtitle}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
};

