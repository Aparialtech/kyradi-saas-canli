import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './Table.module.css';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  variant?: 'default' | 'compact' | 'spacious';
  className?: string;
  animateRows?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyState,
  onRowClick,
  variant = 'default',
  className,
  animateRows = true,
}: TableProps<T>) {
  const handleRowClick = (row: T, index: number) => {
    if (onRowClick) {
      onRowClick(row, index);
    }
  };

  return (
    <div className={styles['table-container']}>
      <table className={clsx(styles.table, styles[`table--${variant}`], className)}>
        <thead className={styles.table__thead}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={clsx(
                  styles.table__th,
                  column.sortable && styles['table__th--sortable']
                )}
                style={{
                  textAlign: column.align || 'left',
                  width: column.width,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={styles.table__tbody}>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length}>
                <div className={styles.table__loading}>
                  <div className={styles.table__spinner} />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Loading...</p>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className={styles.table__empty}>
                  {emptyState || (
                    <>
                      <div className={styles['table__empty-icon']}>
                        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="8" y="12" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="2"/>
                          <line x1="8" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <p className={styles['table__empty-title']}>No data available</p>
                      <p className={styles['table__empty-description']}>
                        There are no records to display at this time.
                      </p>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const RowComponent = animateRows ? motion.tr : 'tr';
              const rowProps = animateRows
                ? {
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: rowIndex * 0.03, duration: 0.2 },
                  }
                : {};

              return (
                <RowComponent
                  key={keyExtractor(row, rowIndex)}
                  className={clsx(
                    styles.table__tr,
                    onRowClick && styles['table__tr--clickable']
                  )}
                  onClick={() => handleRowClick(row, rowIndex)}
                  {...rowProps}
                >
                  {columns.map((column) => {
                    const value = (row as any)[column.key];
                    return (
                      <td
                        key={column.key}
                        className={styles.table__td}
                        style={{ textAlign: column.align || 'left' }}
                      >
                        {column.render ? column.render(value, row, rowIndex) : value}
                      </td>
                    );
                  })}
                </RowComponent>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface TableToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({ children, className }) => {
  return <div className={clsx(styles['table-toolbar'], className)}>{children}</div>;
};

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={clsx(styles['table-pagination'], className)}>
      <div className={styles['table-pagination__info']}>
        Showing {startItem} to {endItem} of {totalItems} results
      </div>
      <div className={styles['table-pagination__controls']}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-border-strong)',
            background: 'transparent',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          Previous
        </button>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-border-strong)',
            background: 'transparent',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

