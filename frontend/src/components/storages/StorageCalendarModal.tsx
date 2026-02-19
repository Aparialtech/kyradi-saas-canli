import { useCallback, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../hooks/useTranslation";
import { http } from "../../lib/http";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, X, AlertCircle } from "../../lib/lucide";

type DayStatus = "free" | "occupied" | "partial";

interface StorageCalendarDay {
  date: string;
  status: DayStatus;
  reservation_ids: string[];
  availability_windows?: { start: string; end: string }[];
  occupied_slots?: { start: string; end: string; reservation_id?: string }[];
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
  
  // Selected day state for detail view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<StorageCalendarDay | null>(null);
  
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
    const grid: Array<{ day: number | null; date: string | null; status?: DayStatus; reservations?: string[] }> = [];
    
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
  
  // Count free/occupied/partial days
  const { freeDays, occupiedDays, partialDays } = useMemo(() => {
    let free = 0;
    let occupied = 0;
    let partial = 0;
    for (const day of calendarDays) {
      if (day.status === "free") free++;
      if (day.status === "occupied") occupied++;
      if (day.status === "partial") partial++;
    }
    return { freeDays: free, occupiedDays: occupied, partialDays: partial };
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
            gap: "0.75rem",
            marginBottom: "1rem",
            fontSize: "0.8rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "4px",
                backgroundColor: "#bbf7d0",
              }}
            />
            <span>{t("calendar.free")} ({freeDays})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "4px",
                backgroundColor: "#fef3c7",
              }}
            />
            <span>Kısmi ({partialDays})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "4px",
                backgroundColor: "#fecaca",
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
            {calendarDays.map((cell, index) => {
              const isSelected = cell.date === selectedDate;
              const isClickable = cell.day !== null;
              
              return (
                <motion.div
                  key={index}
                  whileHover={isClickable ? { scale: 1.05 } : undefined}
                  whileTap={isClickable ? { scale: 0.95 } : undefined}
                  onClick={() => {
                    if (isClickable && cell.date) {
                      setSelectedDate(cell.date);
                      // Find day data from calendar response
                      const dayData = calendarQuery.data?.days.find(d => d.date === cell.date);
                      setSelectedDayData(dayData ? {
                        ...dayData,
                        status: cell.status as "free" | "occupied" | "partial",
                      } : {
                        date: cell.date,
                        status: "free",
                        reservation_ids: [],
                        availability_windows: [],
                      });
                    }
                  }}
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
                        : isSelected
                          ? "var(--primary)"
                          : cell.status === "occupied"
                            ? "#fecaca"
                            : cell.status === "free"
                              ? "#bbf7d0"
                              : cell.status === "partial"
                                ? "#fef3c7"
                                : "#f3f4f6",
                    color:
                      isSelected
                        ? "white"
                        : cell.status === "occupied"
                          ? "#991b1b"
                          : cell.status === "free"
                            ? "#166534"
                            : cell.status === "partial"
                              ? "#92400e"
                              : "#374151",
                    cursor: isClickable ? "pointer" : "auto",
                    border: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                  title={
                    cell.reservations && cell.reservations.length > 0
                      ? `${t("calendar.reservations")}: ${cell.reservations.length}`
                      : isClickable ? "Detay için tıklayın" : undefined
                  }
                >
                  {cell.day}
                </motion.div>
              );
            })}
          </div>
        )}
        
        {/* Selected Day Detail */}
        <AnimatePresence mode="wait">
          {selectedDate && selectedDayData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "var(--bg-secondary, #f9fafb)",
                borderRadius: "12px",
                border: "1px solid var(--border-primary, #e5e7eb)",
              }}
            >
              {/* Day Detail Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Calendar style={{ width: "18px", height: "18px", color: "var(--primary)" }} />
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedDayData(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Kapat"
                >
                  <X style={{ width: "16px", height: "16px", color: "var(--text-tertiary)" }} />
                </button>
              </div>

              {/* Status Badge */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
                backgroundColor:
                  selectedDayData.status === "occupied"
                    ? "#fecaca"
                    : selectedDayData.status === "free"
                      ? "#bbf7d0"
                      : selectedDayData.status === "partial"
                        ? "#fef3c7"
                        : "#f3f4f6",
                color:
                  selectedDayData.status === "occupied"
                    ? "#991b1b"
                    : selectedDayData.status === "free"
                      ? "#166534"
                      : selectedDayData.status === "partial"
                        ? "#92400e"
                        : "#374151",
              }}>
                {selectedDayData.status === "free" && "Müsait"}
                {selectedDayData.status === "occupied" && "Dolu"}
                {selectedDayData.status === "partial" && "Kısmi Müsait"}
              </div>

              {/* Availability Windows */}
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}>
                  <Clock style={{ width: "14px", height: "14px" }} />
                  <span>Müsaitlik Saatleri</span>
                </div>

                {selectedDayData.availability_windows && selectedDayData.availability_windows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {selectedDayData.availability_windows.map((window, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          backgroundColor: "#dcfce7",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          color: "#166534",
                        }}
                      >
                        <Clock style={{ width: "14px", height: "14px" }} />
                        <span style={{ fontWeight: 500 }}>
                          {window.start} - {window.end}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "#6b7280",
                  }}>
                    <AlertCircle style={{ width: "14px", height: "14px" }} />
                    <span>Bu gün için saat tanımı yok</span>
                  </div>
                )}
              </div>

              {/* Occupied Slots (if any) */}
              {selectedDayData.occupied_slots && selectedDayData.occupied_slots.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                    <Clock style={{ width: "14px", height: "14px" }} />
                    <span>Dolu Saatler</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {selectedDayData.occupied_slots.map((slot, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          backgroundColor: "#fecaca",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          color: "#991b1b",
                        }}
                      >
                        <Clock style={{ width: "14px", height: "14px" }} />
                        <span style={{ fontWeight: 500 }}>
                          {slot.start} - {slot.end}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reservations Count */}
              {selectedDayData.reservation_ids && selectedDayData.reservation_ids.length > 0 && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "#dbeafe",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  color: "#1e40af",
                }}>
                  Bu gün için <strong>{selectedDayData.reservation_ids.length}</strong> rezervasyon mevcut
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary */}
        {calendarQuery.data && !selectedDate && (
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
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              💡 Bir güne tıklayarak saat detaylarını görüntüleyebilirsiniz.
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

