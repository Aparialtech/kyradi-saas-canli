import React from 'react';
import clsx from 'clsx';
import styles from './AppLayout.module.css';

export interface AppLayoutProps {
  variant?: 'default' | 'partner' | 'admin';
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ variant = 'default', children }) => {
  return (
    <div
      className={clsx(
        styles['app-layout'],
        variant !== 'default' && styles[`app-layout--${variant}`]
      )}
    >
      {children}
    </div>
  );
};

export interface AppLayoutBodyProps {
  children: React.ReactNode;
}

export const AppLayoutBody: React.FC<AppLayoutBodyProps> = ({ children }) => {
  return <div className={styles['app-layout__body']}>{children}</div>;
};

export interface AppLayoutMainProps {
  children: React.ReactNode;
}

export const AppLayoutMain: React.FC<AppLayoutMainProps> = ({ children }) => {
  return <div className={styles['app-layout__main']}>{children}</div>;
};

