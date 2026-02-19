import React from 'react';
import clsx from 'clsx';
import { X } from '../../../lib/lucide';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  children: React.ReactNode;
  /** Variant style */
  variant?: 'default' | 'compact' | 'inline';
  /** Additional class name */
  className?: string;
  /** Actions slot (right side) */
  actions?: React.ReactNode;
  /** Results count to display */
  resultsCount?: number;
  /** Total results count */
  totalCount?: number;
  /** Clear filters handler */
  onClearFilters?: () => void;
  /** Show clear button only when filters are active */
  hasActiveFilters?: boolean;
}

export interface FilterItemProps {
  children: React.ReactNode;
  /** Label for the filter */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'flex';
  /** Additional class name */
  className?: string;
}

export function FilterBar({
  children,
  variant = 'default',
  className,
  actions,
  resultsCount,
  totalCount,
  onClearFilters,
  hasActiveFilters = false,
}: FilterBarProps) {
  const showResultsCount = typeof resultsCount === 'number';
  const isFiltered = hasActiveFilters || (showResultsCount && totalCount && resultsCount !== totalCount);

  return (
    <div
      className={clsx(
        styles.filterBar,
        variant !== 'default' && styles[`filterBar--${variant}`],
        className
      )}
    >
      <div className={styles.filterGroup}>
        {children}
      </div>

      <div className={styles.filterActions}>
        {showResultsCount && (
          <span className={clsx(styles.filterResults, isFiltered && styles['filterResults--highlight'])}>
            {isFiltered ? `${resultsCount} / ${totalCount}` : resultsCount} sonuç
          </span>
        )}

        {hasActiveFilters && onClearFilters && (
          <button
            type="button"
            className={styles.clearFilters}
            onClick={onClearFilters}
          >
            <X className="h-4 w-4" />
            Temizle
          </button>
        )}

        {actions}
      </div>
    </div>
  );
}

export function FilterItem({
  children,
  label,
  size = 'md',
  className,
}: FilterItemProps) {
  return (
    <div className={clsx(styles.filterItem, styles[`filterItem--${size}`], className)}>
      {label && <span className={styles.filterLabel}>{label}</span>}
      {children}
    </div>
  );
}

export function FilterDivider() {
  return <div className={styles.filterDivider} />;
}

export default FilterBar;
