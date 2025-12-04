import { useCallback, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../hooks/useTranslation";
import { http } from "../../lib/http";

interface StorageCalendarDay {
  date: string;
  status: "free" | "occupied";
  reservation_ids: string[];
}

interface StorageCalendarResponse {
  storage_id: string;
  storage_code: string;
  start_date: string;
  end_date: string;
  days: StorageCalendarDay[];
}

interface StorageCalendarModalProps {
  storageId: string;
  storageName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StorageCalendarModal({
  storageId,
  storageName,
  isOpen,
  onClose,
}: StorageCalendarModalProps) {
  const { t } = useTranslation();
  
  // Date range state (default: current month view)
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  
  // Calculate date range for the query
  const { startDate, endDate } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    return {
      startDate: firstDay.toISOString().split("T")[0],
      endDate: lastDay.toISOString().split("T")[0],
    };
  }, [currentMonth, currentYear]);
  
  // Fetch calendar data
  const calendarQuery = useQuery({
    queryKey: ["storage-calendar", storageId, startDate, endDate],
    queryFn: async () => {
      const response = await http.get<StorageCalendarResponse>(
        `/storages/${storageId}/calendar`,
        { params: { start_date: startDate, end_date: endDate } }
      );
      return response.data;
    },
    enabled: isOpen && !!storageId,
  });
  
  // Build calendar grid
  const calendarDays = useMemo(() => {
    if (!calendarQuery.data) return [];
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    
    // Map calendar data to a lookup
    const dayStatusMap = new Map<string, StorageCalendarDay>();
    for (const day of calendarQuery.data.days) {
      dayStatusMap.set(day.date, day);
    }
    
    // Build grid with empty cells for alignment
    const grid: Array<{ day: number | null; date: string | null; status?: "free" | "occupied"; reservations?: string[] }> = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      grid.push({ day: null, date: null });
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayData = dayStatusMap.get(dateStr);
      grid.push({
        day,
        date: dateStr,
        status: dayData?.status,
        reservations: dayData?.reservation_ids,
      });
    }
    
    return grid;
  }, [calendarQuery.data, currentMonth, currentYear]);
  
  const handlePrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }, [currentMonth, currentYear]);
  
  const handleNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }, [currentMonth, currentYear]);
  
  const monthNames = [
    t("calendar.months.january"),
    t("calendar.months.february"),
    t("calendar.months.march"),
    t("calendar.months.april"),
    t("calendar.months.may"),
    t("calendar.months.june"),
    t("calendar.months.july"),
    t("calendar.months.august"),
    t("calendar.months.september"),
    t("calendar.months.october"),
    t("calendar.months.november"),
    t("calendar.months.december"),
  ];
  
  const dayNames = [
    t("calendar.days.sun"),
    t("calendar.days.mon"),
    t("calendar.days.tue"),
    t("calendar.days.wed"),
    t("calendar.days.thu"),
    t("calendar.days.fri"),
    t("calendar.days.sat"),
  ];
  
  // Count free/occupied days
  const { freeDays, occupiedDays } = useMemo(() => {
    let free = 0;
    let occupied = 0;
    for (const day of calendarDays) {
      if (day.status === "free") free++;
      if (day.status === "occupied") occupied++;
    }
    return { freeDays: free, occupiedDays: occupied };
  }, [calendarDays]);
  
  if (!isOpen) return null;
  
  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: "var(--color-background, #fff)",
          borderRadius: "12px",
          padding: "1.5rem",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {t("calendar.storageCalendarTitle")}
            </h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--color-muted)", fontSize: "0.875rem" }}>
              📦 {storageName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.25rem",
              lineHeight: 1,
            }}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
        
        {/* Month Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <button
            type="button"
            className="btn btn--outline"
            onClick={handlePrevMonth}
            style={{ padding: "0.25rem 0.75rem" }}
          >
            ←
          </button>
          <span style={{ fontWeight: 600 }}>
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleNextMonth}
            style={{ padding: "0.25rem 0.75rem" }}
          >
            →
          </button>
        </div>
        
        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                backgroundColor: "#22c55e",
              }}
            />
            <span>{t("calendar.free")} ({freeDays})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                backgroundColor: "#ef4444",
              }}
            />
            <span>{t("calendar.occupied")} ({occupiedDays})</span>
          </div>
        </div>
        
        {/* Calendar Grid */}
        {calendarQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <span>{t("common.loading")}</span>
          </div>
        ) : calendarQuery.isError ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#ef4444" }}>
            <p>{t("calendar.loadError")}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => calendarQuery.refetch()}
              style={{ marginTop: "0.5rem" }}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
            }}
          >
            {/* Day names header */}
            {dayNames.map((dayName) => (
              <div
                key={dayName}
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  padding: "0.5rem 0",
                  color: "var(--color-muted)",
                }}
              >
                {dayName}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((cell, index) => (
              <div
                key={index}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  backgroundColor:
                    cell.day === null
                      ? "transparent"
                      : cell.status === "occupied"
                        ? "#fecaca"
                        : cell.status === "free"
                          ? "#bbf7d0"
                          : "#f3f4f6",
                  color:
                    cell.status === "occupied"
                      ? "#991b1b"
                      : cell.status === "free"
                        ? "#166534"
                        : "#374151",
                  cursor: cell.day !== null ? "default" : "auto",
                }}
                title={
                  cell.reservations && cell.reservations.length > 0
                    ? `${t("calendar.reservations")}: ${cell.reservations.length}`
                    : undefined
                }
              >
                {cell.day}
              </div>
            ))}
          </div>
        )}
        
        {/* Summary */}
        {calendarQuery.data && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              backgroundColor: "var(--color-background-muted, #f9fafb)",
              borderRadius: "8px",
              fontSize: "0.875rem",
            }}
          >
            <p style={{ margin: 0 }}>
              {t("calendar.summaryText", { free: freeDays, occupied: occupiedDays })}
            </p>
          </div>
        )}
        
        {/* Close Button */}
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

