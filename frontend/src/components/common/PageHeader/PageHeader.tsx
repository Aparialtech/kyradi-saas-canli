import React from "react";
import clsx from "clsx";
import styles from "./PageHeader.module.css";

export interface PageHeaderAction {
  key: string;
  node: React.ReactNode;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: React.ReactNode;
  actions?: PageHeaderAction[];
  aside?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumb,
  actions,
  aside,
  className,
}) => {
  return (
    <div className={clsx(styles.header, className)}>
      <div className={styles.header__main}>
        {breadcrumb && <div className={styles.header__breadcrumb}>{breadcrumb}</div>}
        <div>
          <h1 className={styles.header__title}>{title}</h1>
          {subtitle && <p className={styles.header__subtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={styles.header__aside}>
        {actions && actions.length > 0 && (
          <div className={styles.header__actions}>
            {actions.map((action) => (
              <div key={action.key}>{action.node}</div>
            ))}
          </div>
        )}
        {aside}
      </div>
    </div>
  );
};
