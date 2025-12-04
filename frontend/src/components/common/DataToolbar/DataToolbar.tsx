import React from "react";
import { Search } from "../../../lib/lucide";
import clsx from "clsx";
import styles from "./DataToolbar.module.css";

export interface DataToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export const DataToolbar: React.FC<DataToolbarProps> = ({
  searchValue,
  onSearchChange,
  actions,
  filters,
  placeholder = "Search...",
  className,
}) => {
  return (
    <div className={clsx(styles.toolbar, className)}>
      <div className={styles.toolbar__search}>
        <Search className="h-4 w-4" />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div className={styles.toolbar__side}>
        {filters && <div className={styles.toolbar__filters}>{filters}</div>}
        {actions && <div className={styles.toolbar__actions}>{actions}</div>}
      </div>
    </div>
  );
};
