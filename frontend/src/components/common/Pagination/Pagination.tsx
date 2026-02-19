import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from '../../../lib/lucide';
import styles from './Pagination.module.css';

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showTotal?: boolean;
  showPageSizeSelector?: boolean;
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export const Pagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showTotal = true,
  showPageSizeSelector = true,
  className,
}) => {
  const { total, page, pageSize, totalPages } = meta;

  // Calculate visible page range
  const visiblePages = useMemo(() => {
    const delta = 2; // Pages around current page
    const range: number[] = [];
    const rangeWithDots: (number | 'dots')[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - delta && i <= page + delta)
      ) {
        range.push(i);
      }
    }

    let prev = 0;
    for (const i of range) {
      if (prev + 1 !== i) {
        rangeWithDots.push('dots');
      }
      rangeWithDots.push(i);
      prev = i;
    }

    return rangeWithDots;
  }, [page, totalPages]);

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(e.target.value, 10);
    onPageSizeChange(newPageSize);
    // Reset to first page when page size changes
    onPageChange(1);
  };

  if (totalPages <= 0) {
    return null;
  }

  return (
    <div className={`${styles.pagination} ${className || ''}`}>
      {/* Total Records Info */}
      {showTotal && (
        <div className={styles.info}>
          <span className={styles.totalText}>
            Toplam <strong>{total.toLocaleString('tr-TR')}</strong> kayıt
          </span>
          <span className={styles.rangeText}>
            ({startRecord}-{endRecord} arası gösteriliyor)
          </span>
        </div>
      )}

      {/* Page Size Selector */}
      {showPageSizeSelector && (
        <div className={styles.pageSizeSelector}>
          <label htmlFor="pageSize" className={styles.pageSizeLabel}>
            Sayfa başına:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={handlePageSizeChange}
            className={styles.pageSizeSelect}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Page Navigation */}
      <div className={styles.navigation}>
        {/* First Page */}
        <button
          className={styles.navButton}
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="İlk sayfa"
          title="İlk sayfa"
        >
          <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4" style={{ marginLeft: '-8px' }} />
        </button>

        {/* Previous Page */}
        <button
          className={styles.navButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Önceki sayfa"
          title="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page Numbers */}
        <div className={styles.pageNumbers}>
          {visiblePages.map((item, index) => {
            if (item === 'dots') {
              return (
                <span key={`dots-${index}`} className={styles.dots}>
                  ...
                </span>
              );
            }
            return (
              <button
                key={item}
                className={`${styles.pageButton} ${page === item ? styles.pageButtonActive : ''}`}
                onClick={() => onPageChange(item)}
                aria-label={`Sayfa ${item}`}
                aria-current={page === item ? 'page' : undefined}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          className={styles.navButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Sonraki sayfa"
          title="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last Page */}
        <button
          className={styles.navButton}
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Son sayfa"
          title="Son sayfa"
        >
          <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4" style={{ marginLeft: '-8px' }} />
        </button>
      </div>

      {/* Page Input (optional quick jump) */}
      <div className={styles.pageJump}>
        <span className={styles.pageJumpLabel}>Sayfa:</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={page}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (value >= 1 && value <= totalPages) {
              onPageChange(value);
            }
          }}
          className={styles.pageJumpInput}
          aria-label="Sayfa numarası"
        />
        <span className={styles.pageJumpTotal}>/ {totalPages}</span>
      </div>
    </div>
  );
};

// Hook for pagination state management
export function usePagination(initialPageSize = 10) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const reset = React.useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    reset,
  };
}

// Calculate pagination meta from total count
export function calculatePaginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export default Pagination;
