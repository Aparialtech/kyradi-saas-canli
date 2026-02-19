import React from 'react';
import clsx from 'clsx';
import styles from './DashboardShell.module.css';

export interface DashboardShellProps {
  variant?: 'partner' | 'admin';
  children: React.ReactNode;
  className?: string;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  variant = 'partner',
  children,
  className,
}) => {
  return (
    <div
      className={clsx(
        styles.dashboardShell,
        styles[`dashboardShell--${variant}`],
        className
      )}
    >
      {children}
    </div>
  );
};

