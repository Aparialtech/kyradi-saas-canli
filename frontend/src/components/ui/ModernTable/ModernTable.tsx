import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './ModernTable.module.css';
import { Pagination, type PaginationMeta } from '../../common/Pagination';

export interface ModernTableColumn<T = any> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface ModernTableProps<T = any> {
  columns: ModernTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  striped?: boolean;
  hoverable?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T, index: number) => void;
  // Row numbering
  showRowNumbers?: boolean;
  rowNumberLabel?: string;
  // Pagination
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export const ModernTable = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyText = 'Veri bulunamadı',
  striped = true,
  hoverable = true,
  stickyHeader = true,
  onRowClick,
  showRowNumbers = false,
  rowNumberLabel = '#',
  pagination,
  onPageChange,
  onPageSizeChange,
}: ModernTableProps<T>) => {
  // Calculate row number based on pagination
  const getRowNumber = (index: number): number => {
    if (pagination) {
      return (pagination.page - 1) * pagination.pageSize + index + 1;
    }
    return index + 1;
  };

  if (loading) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.empty}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          <p>{emptyText}</p>
        </div>
      </div>
    );
  }

  // Build columns with optional row number column
  const tableColumns = showRowNumbers
    ? [{ key: '__rowNumber', label: rowNumberLabel, width: '60px', align: 'center' as const }, ...columns]
    : columns;

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={clsx(styles.thead, { [styles.stickyHeader]: stickyHeader })}>
            <tr>
              {tableColumns.map((column) => (
                <th
                  key={column.key}
                  className={styles.th}
                  style={{
                    width: column.width,
                    textAlign: column.align || 'left',
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {data.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                className={clsx(styles.tr, {
                  [styles.striped]: striped && rowIndex % 2 !== 0,
                  [styles.hoverable]: hoverable,
                  [styles.clickable]: !!onRowClick,
                })}
                onClick={() => onRowClick?.(row, rowIndex)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(rowIndex * 0.02, 0.5) }}
                whileHover={hoverable ? { backgroundColor: 'var(--bg-tertiary)' } : undefined}
              >
                {showRowNumbers && (
                  <td className={clsx(styles.td, styles.rowNumberCell)} style={{ textAlign: 'center' }}>
                    <span className={styles.rowNumber}>{getRowNumber(rowIndex)}</span>
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={styles.td}
                    style={{ textAlign: column.align || 'left' }}
                  >
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination && onPageChange && onPageSizeChange && (
        <Pagination
          meta={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
};

