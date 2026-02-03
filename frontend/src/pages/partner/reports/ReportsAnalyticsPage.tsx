import { useMemo, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "../../../lib/lucide";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Filter, BarChart3, LineChart as LineChartIcon, PieChartIcon, TrendingUp, Search, X, MapPin, Package } from "../../../lib/lucide";

import { partnerReportService, type PartnerOverviewResponse } from "../../../services/partner/reports";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";
import { errorLogger } from "../../../lib/errorLogger";
import { ModernCard } from "../../../components/ui/ModernCard";
import { StatCard } from "../../../components/ui/ModernCard";
import { ReservationTrendChart } from "../../../components/charts/ReservationTrendChart";
import { RevenueDonutChart } from "../../../components/charts/RevenueDonutChart";
import { OccupancyBarChart } from "../../../components/charts/OccupancyBarChart";
import { ModernButton } from "../../../components/ui/ModernButton";
import { DateField } from "../../../components/ui/DateField";
import { PiggyBank, FileText, Briefcase, LineChart } from "../../../lib/lucide";
import { locationService } from "../../../services/partner/locations";

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type ChartType = "area" | "line" | "bar";

export function ReportsAnalyticsPage() {
  const { t, locale } = useTranslation();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [anonymous, setAnonymous] = useState<boolean>(false);
  const [trendChartType, setTrendChartType] = useState<ChartType>("area");
  const [revenueChartType, setRevenueChartType] = useState<"donut" | "bar">("donut");

  // Fetch locations for filter
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list(),
  });

  const overviewQuery = useQuery<PartnerOverviewResponse, Error>({
    queryKey: ["partner", "overview", dateFrom, dateTo, locationId, status],
    queryFn: () => partnerReportService.getPartnerOverview({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      location_id: locationId || undefined,
      status: status || undefined,
    }),
  });

  const trendQuery = useQuery({
    queryKey: ["partner", "trends", dateFrom, dateTo],
    queryFn: () =>
      partnerReportService.getTrends({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        granularity: "daily",
      }),
  });

  const [occupancyLocationFilter, setOccupancyLocationFilter] = useState<string>("");
  
  // Location Revenue Table - Search & Filter State
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const debouncedLocationSearch = useDebounce(locationSearchTerm, 200);
  const [locationSortBy, setLocationSortBy] = useState<"name" | "revenue" | "reservations">("revenue");
  const [locationSortDir, setLocationSortDir] = useState<"asc" | "desc">("desc");
  
  // Storage Usage Table - Search & Filter State
  const [storageSearchTerm, setStorageSearchTerm] = useState("");
  const debouncedStorageSearch = useDebounce(storageSearchTerm, 200);
  const [storageLocationFilter, setStorageLocationFilter] = useState("");
  const [storageSortBy, setStorageSortBy] = useState<"code" | "location" | "reservations">("reservations");
  const [storageSortDir, setStorageSortDir] = useState<"asc" | "desc">("desc");
  
  // Pagination State
  const [locationPage, setLocationPage] = useState(1);
  const [locationPageSize, setLocationPageSize] = useState(10);
  const [storagePage, setStoragePage] = useState(1);
  const [storagePageSize, setStoragePageSize] = useState(10);
  
  const storageUsageQuery = useQuery({
    queryKey: ["partner", "storage-usage", dateFrom, dateTo],
    queryFn: () =>
      partnerReportService.getStorageUsage({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const trendData = useMemo(() => {
    if (!trendQuery.data) return [];
    return trendQuery.data.map((point) => {
      const dateLabel = new Date(point.date).toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
      });
      return {
        date: dateLabel,
        reservations: point.reservations ?? 0,
        revenue: Math.round((point.revenue_minor ?? 0) / 100),
      };
    });
  }, [trendQuery.data, locale]);

  // Get unique locations for filter dropdown
  const occupancyLocations = useMemo(() => {
    if (!storageUsageQuery.data) return [];
    const locations = new Set(storageUsageQuery.data.map(item => item.location_name));
    return Array.from(locations).sort();
  }, [storageUsageQuery.data]);

  const occupancyData = useMemo(() => {
    if (!storageUsageQuery.data) return [];
    let data = storageUsageQuery.data;
    
    // Filter by location if selected
    if (occupancyLocationFilter) {
      data = data.filter(item => item.location_name === occupancyLocationFilter);
    }
    
    return data.map((item) => ({
      label: item.storage_code,
      occupancy_rate: item.occupancy_rate ?? 0,
      location_name: item.location_name,
      reservations: item.reservations,
      storage_id: item.storage_id,
      total_revenue_minor: item.total_revenue_minor,
    }));
  }, [storageUsageQuery.data, occupancyLocationFilter]);

  // Filtered & Sorted Location Data (all items for counting)
  const allFilteredLocationData = useMemo(() => {
    if (!overviewQuery.data?.by_location) return [];
    
    let data = [...overviewQuery.data.by_location];
    
    // Search filter
    if (debouncedLocationSearch.trim()) {
      const term = debouncedLocationSearch.toLowerCase();
      data = data.filter(item => 
        item.location_name.toLowerCase().includes(term)
      );
    }
    
    // Sort
    data.sort((a, b) => {
      let comparison = 0;
      if (locationSortBy === "name") {
        comparison = a.location_name.localeCompare(b.location_name);
      } else if (locationSortBy === "revenue") {
        comparison = a.revenue_minor - b.revenue_minor;
      } else {
        comparison = a.reservations - b.reservations;
      }
      return locationSortDir === "asc" ? comparison : -comparison;
    });
    
    return data;
  }, [overviewQuery.data?.by_location, debouncedLocationSearch, locationSortBy, locationSortDir]);

  // Paginated Location Data
  const filteredLocationData = useMemo(() => {
    const startIndex = (locationPage - 1) * locationPageSize;
    return allFilteredLocationData.slice(startIndex, startIndex + locationPageSize);
  }, [allFilteredLocationData, locationPage, locationPageSize]);

  const locationTotalPages = useMemo(() => 
    Math.ceil(allFilteredLocationData.length / locationPageSize), 
    [allFilteredLocationData.length, locationPageSize]
  );

  // Get unique locations for storage filter
  const storageUniqueLocations = useMemo(() => {
    if (!overviewQuery.data?.by_storage) return [];
    const locations = new Set(overviewQuery.data.by_storage.map(item => item.location_name));
    return Array.from(locations).sort();
  }, [overviewQuery.data?.by_storage]);

  // Filtered & Sorted Storage Data (all items for counting)
  const allFilteredStorageData = useMemo(() => {
    if (!overviewQuery.data?.by_storage) return [];
    
    let data = [...overviewQuery.data.by_storage];
    
    // Search filter
    if (debouncedStorageSearch.trim()) {
      const term = debouncedStorageSearch.toLowerCase();
      data = data.filter(item => 
        item.storage_code.toLowerCase().includes(term) ||
        item.location_name.toLowerCase().includes(term)
      );
    }
    
    // Location filter
    if (storageLocationFilter) {
      data = data.filter(item => item.location_name === storageLocationFilter);
    }
    
    // Sort
    data.sort((a, b) => {
      let comparison = 0;
      if (storageSortBy === "code") {
        comparison = a.storage_code.localeCompare(b.storage_code);
      } else if (storageSortBy === "location") {
        comparison = a.location_name.localeCompare(b.location_name);
      } else {
        comparison = a.reservations - b.reservations;
      }
      return storageSortDir === "asc" ? comparison : -comparison;
    });
    
    return data;
  }, [overviewQuery.data?.by_storage, debouncedStorageSearch, storageLocationFilter, storageSortBy, storageSortDir]);

  // Paginated Storage Data
  const filteredStorageData = useMemo(() => {
    const startIndex = (storagePage - 1) * storagePageSize;
    return allFilteredStorageData.slice(startIndex, startIndex + storagePageSize);
  }, [allFilteredStorageData, storagePage, storagePageSize]);

  const storageTotalPages = useMemo(() => 
    Math.ceil(allFilteredStorageData.length / storagePageSize), 
    [allFilteredStorageData.length, storagePageSize]
  );

  // Clear filters helpers
  const clearLocationFilters = useCallback(() => {
    setLocationSearchTerm("");
    setLocationSortBy("revenue");
    setLocationSortDir("desc");
    setLocationPage(1);
  }, []);

  const clearStorageFilters = useCallback(() => {
    setStorageSearchTerm("");
    setStorageLocationFilter("");
    setStorageSortBy("reservations");
    setStorageSortDir("desc");
    setStoragePage(1);
  }, []);
  
  // Reset page when search/filter changes
  useEffect(() => {
    setLocationPage(1);
  }, [debouncedLocationSearch, locationSortBy, locationSortDir]);
  
  useEffect(() => {
    setStoragePage(1);
  }, [debouncedStorageSearch, storageLocationFilter, storageSortBy, storageSortDir]);

  // Toggle sort helper
  const toggleLocationSort = useCallback((column: "name" | "revenue" | "reservations") => {
    if (locationSortBy === column) {
      setLocationSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setLocationSortBy(column);
      setLocationSortDir("desc");
    }
  }, [locationSortBy]);

  const toggleStorageSort = useCallback((column: "code" | "location" | "reservations") => {
    if (storageSortBy === column) {
      setStorageSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setStorageSortBy(column);
      setStorageSortDir("desc");
    }
  }, [storageSortBy]);

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
            {t("reports.title")}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("reports.subtitle")}
          </p>
        </div>
        
        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <ModernButton
            variant="outline"
            size="md"
            onClick={async () => {
              try {
                const blob = await partnerReportService.exportReport("csv", {
                  date_from: dateFrom || undefined,
                  date_to: dateTo || undefined,
                  location_id: locationId || undefined,
                  status: status || undefined,
                  anonymous,
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `kyradi-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (error) {
                errorLogger.error(error, {
                  component: "ReportsAnalyticsPage",
                  action: "exportReport",
                  format: "csv",
                });
              }
            }}
            leftIcon={<Download className="h-4 w-4" />}
          >
            CSV
          </ModernButton>
          <ModernButton
            variant="outline"
            size="md"
            onClick={async () => {
              try {
                const blob = await partnerReportService.exportReport("xlsx", {
                  date_from: dateFrom || undefined,
                  date_to: dateTo || undefined,
                  location_id: locationId || undefined,
                  status: status || undefined,
                  anonymous,
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `kyradi-report-${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (error) {
                errorLogger.error(error, {
                  component: "ReportsAnalyticsPage",
                  action: "exportReport",
                  format: "csv",
                });
              }
            }}
            leftIcon={<Download className="h-4 w-4" />}
          >
            XLSX
          </ModernButton>
          <ModernButton
            variant="outline"
            size="md"
            onClick={async () => {
              try {
                const blob = await partnerReportService.exportReport("template", {
                  date_from: dateFrom || undefined,
                  date_to: dateTo || undefined,
                  location_id: locationId || undefined,
                  status: status || undefined,
                  anonymous,
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `kyradi-report-${new Date().toISOString().split('T')[0]}.html`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (error) {
                errorLogger.error(error, {
                  component: "ReportsAnalyticsPage",
                  action: "exportReport",
                  format: "csv",
                });
              }
            }}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Template
          </ModernButton>
        </div>
      </motion.div>

      {/* Filters */}
      <ModernCard variant="glass" padding="md" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Filter className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
            Filtreler
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <DateField
            label="Başlangıç Tarihi"
            value={dateFrom}
            onChange={(value) => setDateFrom(value || "")}
            fullWidth
          />
          <DateField
            label="Bitiş Tarihi"
            value={dateTo}
            onChange={(value) => setDateTo(value || "")}
            fullWidth
          />
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Lokasyon
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <option value="">Tümü</option>
              {locationsQuery.data?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Durum
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <option value="">Tümü</option>
              <option value="reserved">Rezerve</option>
              <option value="active">Aktif</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            type="checkbox"
            id="anonymous"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="anonymous" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Anonim rapor (misafir bilgileri gizli)
          </label>
        </div>
      </ModernCard>

      {/* Modern Summary Cards */}
      {overviewQuery.isLoading ? (
        <motion.div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-8)'
          }}
          initial="hidden"
          animate="visible"
        >
          {[1, 2, 3, 4].map((i) => (
            <ModernCard key={i} variant="glass" padding="lg">
              <div className="shimmer" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
            </ModernCard>
          ))}
        </motion.div>
      ) : overviewQuery.isError ? (
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--danger-500)' }}>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              {t("reports.state.error")}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {getErrorMessage(overviewQuery.error)}
            </p>
          </div>
        </ModernCard>
      ) : overviewQuery.data ? (
        <>
          {/* Modern Summary Stats */}
          <motion.div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: 'var(--space-6)',
              marginBottom: 'var(--space-8)'
            }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                label={t("reports.summary.totalRevenue")}
                value={currencyFormatter.format((overviewQuery.data.summary.total_revenue_minor ?? 0) / 100)}
                icon={<PiggyBank className="h-6 w-6" />}
                variant="success"
              />
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                label={t("reports.summary.totalReservations")}
                value={numberFormatter.format(overviewQuery.data.summary.total_reservations ?? 0)}
                icon={<FileText className="h-6 w-6" />}
                variant="primary"
              />
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                label={t("reports.summary.activeReservations")}
                value={numberFormatter.format(overviewQuery.data.summary.active_reservations ?? 0)}
                icon={<Briefcase className="h-6 w-6" />}
                variant="secondary"
              />
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                label={t("reports.summary.occupancyRate")}
                value={`${(overviewQuery.data.summary.occupancy_rate ?? 0).toFixed(1)}%`}
                icon={<LineChart className="h-6 w-6" />}
                variant="warning"
              />
            </motion.div>
          </motion.div>

          {/* Premium Charts Grid */}
          <motion.div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
              gap: 'var(--space-6)',
              marginBottom: 'var(--space-6)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <ModernCard variant="glass" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                  Rezervasyon Trendi
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--bg-tertiary)', padding: 'var(--space-1)', borderRadius: 'var(--radius-lg)' }}>
                  <button
                    onClick={() => setTrendChartType("area")}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      background: trendChartType === "area" ? 'var(--primary-500)' : 'transparent',
                      color: trendChartType === "area" ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      transition: 'all 0.2s ease',
                    }}
                    title="Alan Grafiği"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span style={{ display: 'none', '@media (minWidth: 640px)': { display: 'inline' } } as React.CSSProperties}>Alan</span>
                  </button>
                  <button
                    onClick={() => setTrendChartType("line")}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      background: trendChartType === "line" ? 'var(--primary-500)' : 'transparent',
                      color: trendChartType === "line" ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      transition: 'all 0.2s ease',
                    }}
                    title="Çizgi Grafiği"
                  >
                    <LineChartIcon className="h-4 w-4" />
                    <span style={{ display: 'none', '@media (minWidth: 640px)': { display: 'inline' } } as React.CSSProperties}>Çizgi</span>
                  </button>
                  <button
                    onClick={() => setTrendChartType("bar")}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      background: trendChartType === "bar" ? 'var(--primary-500)' : 'transparent',
                      color: trendChartType === "bar" ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      transition: 'all 0.2s ease',
                    }}
                    title="Sütun Grafiği"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span style={{ display: 'none', '@media (minWidth: 640px)': { display: 'inline' } } as React.CSSProperties}>Sütun</span>
                  </button>
                </div>
              </div>
              <div style={{ height: '350px', minHeight: '350px', minWidth: 0 }}>
                {trendQuery.isLoading ? (
                  <div className="shimmer" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }} />
                ) : (
                  <ReservationTrendChart data={trendData} chartType={trendChartType} />
                )}
              </div>
            </ModernCard>

            <ModernCard variant="glass" padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                  Gelir Dağılımı (Ödeme Yöntemi)
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--bg-tertiary)', padding: 'var(--space-1)', borderRadius: 'var(--radius-lg)' }}>
                  <button
                    onClick={() => setRevenueChartType("donut")}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      background: revenueChartType === "donut" ? 'var(--primary-500)' : 'transparent',
                      color: revenueChartType === "donut" ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      transition: 'all 0.2s ease',
                    }}
                    title="Pasta Grafiği"
                  >
                    <PieChartIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setRevenueChartType("bar")}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      background: revenueChartType === "bar" ? 'var(--primary-500)' : 'transparent',
                      color: revenueChartType === "bar" ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      transition: 'all 0.2s ease',
                    }}
                    title="Sütun Grafiği"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div style={{ height: '350px', minHeight: '350px', minWidth: 0 }}>
                {overviewQuery.data?.by_payment_method && overviewQuery.data.by_payment_method.length > 0 ? (
                  <RevenueDonutChart 
                    data={overviewQuery.data.by_payment_method.map((item, idx) => {
                      const methodColors: Record<string, string> = {
                        "GATEWAY_DEMO": "#6366f1",
                        "GATEWAY_LIVE": "#3B82F6",
                        "POS": "#0ea5e9",
                        "CASH": "#22c55e",
                        "BANK_TRANSFER": "#f59e0b",
                      };
                      return {
                        name: item.method_name || item.method,
                        value: Math.round(item.revenue_minor / 100),
                        color: methodColors[item.method] || ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"][idx % 5],
                      };
                    })}
                    chartType={revenueChartType}
                  />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    color: 'var(--text-tertiary)'
                  }}>
                    <PiggyBank className="h-12 w-12" style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                    <p style={{ fontSize: 'var(--text-sm)' }}>Henüz ödeme verisi yok</p>
                  </div>
                )}
              </div>
            </ModernCard>

            <ModernCard variant="glass" padding="lg" style={{ gridColumn: 'span 1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                  Depo Doluluk Oranları
                </h3>
                <select
                  value={occupancyLocationFilter}
                  onChange={(e) => setOccupancyLocationFilter(e.target.value)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    minWidth: '150px',
                  }}
                >
                  <option value="">Tüm Lokasyonlar</option>
                  {occupancyLocations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div style={{ height: '350px', minHeight: '350px', minWidth: 0 }}>
                {storageUsageQuery.isLoading ? (
                  <div className="shimmer" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }} />
                ) : occupancyData.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    color: 'var(--text-tertiary)'
                  }}>
                    <BarChart3 className="h-12 w-12" style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                    <p style={{ fontSize: 'var(--text-sm)' }}>Bu lokasyonda veri bulunamadı</p>
                  </div>
                ) : (
                  <OccupancyBarChart data={occupancyData} />
                )}
              </div>
            </ModernCard>
          </motion.div>

          {/* Daily Revenue Chart */}
          {overviewQuery.data.daily.length > 0 && (
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ margin: '0 0 var(--space-6) 0', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                {t("reports.chart.dailyRevenue")}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 'var(--space-4)' }}>
                {overviewQuery.data.daily.map((day, index) => {
                  const maxRevenue = Math.max(...overviewQuery.data!.daily.map((d) => d.revenue_minor), 1);
                  const heightPercent = (day.revenue_minor / maxRevenue) * 100;
                  const dateObj = new Date(day.date);
                  const formattedDate = new Intl.DateTimeFormat(locale, {
                    day: "2-digit",
                    month: "short",
                  }).format(dateObj);

                  return (
                    <motion.div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      whileHover={{ scale: 1.05 }}
                      title={`${formattedDate}: ${currencyFormatter.format(day.revenue_minor / 100)}`}
                    >
                      <div style={{ position: 'relative', width: '100%', height: '150px', display: 'flex', alignItems: 'flex-end' }}>
                        <motion.div
                          style={{
                            width: "100%",
                            background: 'linear-gradient(180deg, #3B82F6 0%, #8B5CF6 100%)',
                            borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
                            boxShadow: 'var(--shadow-primary)',
                          }}
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ delay: index * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "#64748b",
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                          }}
                        >
                          {formattedDate}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}>
                          {currencyFormatter.format(day.revenue_minor / 100)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ModernCard>
          )}

          {/* Payment Method Revenue Table */}
          {overviewQuery.data.by_payment_method && overviewQuery.data.by_payment_method.length > 0 && (
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ margin: '0 0 var(--space-6) 0', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                💳 Ödeme Yöntemi Dağılımı
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 'var(--space-3)', borderBottom: '2px solid var(--border-primary)' }}>Ödeme Yöntemi</th>
                      <th style={{ textAlign: "right", padding: 'var(--space-3)', borderBottom: '2px solid var(--border-primary)' }}>İşlem Sayısı</th>
                      <th style={{ textAlign: "right", padding: 'var(--space-3)', borderBottom: '2px solid var(--border-primary)' }}>Gelir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.data.by_payment_method.map((method, index) => {
                      const methodColors: Record<string, string> = {
                        "GATEWAY_DEMO": "#6366f1",
                        "GATEWAY_LIVE": "#3B82F6",
                        "POS": "#0ea5e9",
                        "CASH": "#22c55e",
                        "BANK_TRANSFER": "#f59e0b",
                      };
                      const color = methodColors[method.method] || "#6b7280";
                      return (
                        <tr key={index}>
                          <td style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '50%', 
                                backgroundColor: color 
                              }} />
                              <strong>{method.method_name}</strong>
                            </div>
                          </td>
                          <td style={{ textAlign: "right", padding: 'var(--space-3)', borderBottom: '1px solid var(--border-secondary)' }}>
                            {numberFormatter.format(method.count)}
                          </td>
                          <td style={{ textAlign: "right", padding: 'var(--space-3)', borderBottom: '1px solid var(--border-secondary)', fontWeight: 'var(--font-semibold)' }}>
                            {currencyFormatter.format(method.revenue_minor / 100)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ModernCard>
          )}

          {/* Location Revenue Table - Enhanced */}
          {overviewQuery.data.by_location.length > 0 && (
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              {/* Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
                gap: 'var(--space-3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <MapPin className="h-5 w-5" style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                      Lokasyon Bazlı Gelir
                    </h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {allFilteredLocationData.length} / {overviewQuery.data.by_location.length} lokasyon
                    </p>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div style={{ 
                display: 'flex', 
                gap: 'var(--space-3)', 
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {/* Search Input */}
                <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '200px', maxWidth: '350px' }}>
                  <Search className="h-4 w-4" style={{ 
                    position: 'absolute', 
                    left: 'var(--space-3)', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none'
                  }} />
                  <input
                    type="text"
                    placeholder="Lokasyon ara..."
                    value={locationSearchTerm}
                    onChange={(e) => setLocationSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-9)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                  {locationSearchTerm && (
                    <button
                      onClick={() => setLocationSearchTerm("")}
                      style={{
                        position: 'absolute',
                        right: 'var(--space-2)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        borderRadius: 'var(--radius-full)',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Clear Filters */}
                {(locationSearchTerm || locationSortBy !== "revenue" || locationSortDir !== "desc") && (
                  <ModernButton
                    variant="ghost"
                    size="sm"
                    onClick={clearLocationFilters}
                    leftIcon={<X className="h-4 w-4" />}
                  >
                    Temizle
                  </ModernButton>
                )}
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: 'var(--text-sm)'
                }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th 
                        onClick={() => toggleLocationSort("name")}
                        style={{ 
                          textAlign: 'left', 
                          padding: 'var(--space-3) var(--space-4)', 
                          fontWeight: 'var(--font-semibold)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Lokasyon {locationSortBy === "name" && (locationSortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th 
                        onClick={() => toggleLocationSort("revenue")}
                        style={{ 
                          textAlign: 'right', 
                          padding: 'var(--space-3) var(--space-4)', 
                          fontWeight: 'var(--font-semibold)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Toplam Ciro {locationSortBy === "revenue" && (locationSortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th 
                        onClick={() => toggleLocationSort("reservations")}
                        style={{ 
                          textAlign: 'right', 
                          padding: 'var(--space-3) var(--space-4)', 
                          fontWeight: 'var(--font-semibold)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Rezervasyon {locationSortBy === "reservations" && (locationSortDir === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocationData.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                          <div style={{ color: 'var(--text-tertiary)' }}>
                            <MapPin className="h-10 w-10" style={{ margin: '0 auto var(--space-3) auto', opacity: 0.4 }} />
                            <p style={{ margin: '0 0 var(--space-2) 0', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                              Sonuç bulunamadı
                            </p>
                            <p style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)' }}>
                              Arama kriterlerinize uygun lokasyon yok.
                            </p>
                            <ModernButton variant="outline" size="sm" onClick={clearLocationFilters}>
                              Filtreleri Temizle
                            </ModernButton>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredLocationData.map((location, index) => (
                        <tr 
                          key={index}
                          style={{ 
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ 
                            padding: 'var(--space-3) var(--space-4)', 
                            borderBottom: '1px solid var(--border-secondary)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <MapPin className="h-4 w-4" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                              <strong style={{ color: 'var(--text-primary)' }}>{location.location_name}</strong>
                            </div>
                          </td>
                          <td style={{ 
                            textAlign: 'right', 
                            padding: 'var(--space-3) var(--space-4)', 
                            borderBottom: '1px solid var(--border-secondary)',
                            fontWeight: 'var(--font-semibold)',
                            color: '#16a34a',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {currencyFormatter.format(location.revenue_minor / 100)}
                          </td>
                          <td style={{ 
                            textAlign: 'right', 
                            padding: 'var(--space-3) var(--space-4)', 
                            borderBottom: '1px solid var(--border-secondary)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            <span style={{
                              background: 'var(--primary-100)',
                              color: 'var(--primary-700)',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 'var(--font-semibold)',
                            }}>
                              {numberFormatter.format(location.reservations)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {locationTotalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      Sayfa başına:
                    </span>
                    <select
                      value={locationPageSize}
                      onChange={(e) => { setLocationPageSize(Number(e.target.value)); setLocationPage(1); }}
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {(locationPage - 1) * locationPageSize + 1} - {Math.min(locationPage * locationPageSize, allFilteredLocationData.length)} / {allFilteredLocationData.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => setLocationPage(p => Math.max(1, p - 1))}
                      disabled={locationPage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: locationPage === 1 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                        color: locationPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: locationPage === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span style={{ padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                      {locationPage} / {locationTotalPages}
                    </span>
                    <button
                      onClick={() => setLocationPage(p => Math.min(locationTotalPages, p + 1))}
                      disabled={locationPage === locationTotalPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: locationPage === locationTotalPages ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                        color: locationPage === locationTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: locationPage === locationTotalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </ModernCard>
          )}

          {/* Storage Usage Table - Enhanced */}
          {overviewQuery.data.by_storage.length > 0 && (
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              {/* Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
                gap: 'var(--space-3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Package className="h-5 w-5" style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                      Depo Kullanımı (En Çok Kullanılanlar)
                    </h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {allFilteredStorageData.length} / {overviewQuery.data.by_storage.length} depo
                    </p>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div style={{ 
                display: 'flex', 
                gap: 'var(--space-3)', 
                marginBottom: 'var(--space-4)',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {/* Search Input */}
                <div style={{ position: 'relative', flex: '1 1 250px', minWidth: '200px', maxWidth: '350px' }}>
                  <Search className="h-4 w-4" style={{ 
                    position: 'absolute', 
                    left: 'var(--space-3)', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none'
                  }} />
                  <input
                    type="text"
                    placeholder="Depo kodu veya lokasyon ara..."
                    value={storageSearchTerm}
                    onChange={(e) => setStorageSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-9)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                  {storageSearchTerm && (
                    <button
                      onClick={() => setStorageSearchTerm("")}
                      style={{
                        position: 'absolute',
                        right: 'var(--space-2)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        borderRadius: 'var(--radius-full)',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Location Filter Dropdown */}
                <select
                  value={storageLocationFilter}
                  onChange={(e) => setStorageLocationFilter(e.target.value)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    minWidth: '150px',
                  }}
                >
                  <option value="">Tüm Lokasyonlar</option>
                  {storageUniqueLocations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(storageSearchTerm || storageLocationFilter || storageSortBy !== "reservations" || storageSortDir !== "desc") && (
                  <ModernButton
                    variant="ghost"
                    size="sm"
                    onClick={clearStorageFilters}
                    leftIcon={<X className="h-4 w-4" />}
                  >
                    Temizle
                  </ModernButton>
                )}
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: 'var(--text-sm)'
                }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th 
                        onClick={() => toggleStorageSort("code")}
                        style={{ 
                          textAlign: 'left', 
                          padding: 'var(--space-3) var(--space-4)', 
                          fontWeight: 'var(--font-semibold)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Depo Kodu {storageSortBy === "code" && (storageSortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th 
                        onClick={() => toggleStorageSort("location")}
                        style={{ 
                          textAlign: 'left', 
                          padding: 'var(--space-3) var(--space-4)', 
                          fontWeight: 'var(--font-semibold)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Lokasyon {storageSortBy === "location" && (storageSortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th 
                        onClick={() => toggleStorageSort("reservations")}
                        style={{ 
                          textAlign: 'right', 
                          padding: 'var(--space-3) var(--space-4)', 
                          fontWeight: 'var(--font-semibold)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          borderBottom: '2px solid var(--border-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Rezervasyon {storageSortBy === "reservations" && (storageSortDir === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStorageData.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                          <div style={{ color: 'var(--text-tertiary)' }}>
                            <Package className="h-10 w-10" style={{ margin: '0 auto var(--space-3) auto', opacity: 0.4 }} />
                            <p style={{ margin: '0 0 var(--space-2) 0', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                              Sonuç bulunamadı
                            </p>
                            <p style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)' }}>
                              Arama kriterlerinize uygun depo yok.
                            </p>
                            <ModernButton variant="outline" size="sm" onClick={clearStorageFilters}>
                              Filtreleri Temizle
                            </ModernButton>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredStorageData.map((storage, index) => (
                        <tr 
                          key={index}
                          style={{ 
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ 
                            padding: 'var(--space-3) var(--space-4)', 
                            borderBottom: '1px solid var(--border-secondary)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <Package className="h-4 w-4" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                              <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{storage.storage_code}</strong>
                            </div>
                          </td>
                          <td style={{ 
                            padding: 'var(--space-3) var(--space-4)', 
                            borderBottom: '1px solid var(--border-secondary)',
                            color: 'var(--text-secondary)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <MapPin className="h-3 w-3" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              {storage.location_name}
                            </div>
                          </td>
                          <td style={{ 
                            textAlign: 'right', 
                            padding: 'var(--space-3) var(--space-4)', 
                            borderBottom: '1px solid var(--border-secondary)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            <span style={{
                              background: storage.reservations > 10 
                                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                                : storage.reservations > 5 
                                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                  : 'var(--bg-tertiary)',
                              color: storage.reservations > 5 ? 'white' : 'var(--text-primary)',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 'var(--font-semibold)',
                              display: 'inline-block',
                              minWidth: '32px',
                              textAlign: 'center',
                            }}>
                              {numberFormatter.format(storage.reservations)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {storageTotalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      Sayfa başına:
                    </span>
                    <select
                      value={storagePageSize}
                      onChange={(e) => { setStoragePageSize(Number(e.target.value)); setStoragePage(1); }}
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {(storagePage - 1) * storagePageSize + 1} - {Math.min(storagePage * storagePageSize, allFilteredStorageData.length)} / {allFilteredStorageData.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => setStoragePage(p => Math.max(1, p - 1))}
                      disabled={storagePage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: storagePage === 1 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                        color: storagePage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: storagePage === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span style={{ padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                      {storagePage} / {storageTotalPages}
                    </span>
                    <button
                      onClick={() => setStoragePage(p => Math.min(storageTotalPages, p + 1))}
                      disabled={storagePage === storageTotalPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        background: storagePage === storageTotalPages ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                        color: storagePage === storageTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: storagePage === storageTotalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </ModernCard>
          )}

          {/* Empty State if no data */}
          {overviewQuery.data.daily.length === 0 &&
            overviewQuery.data.by_location.length === 0 &&
            overviewQuery.data.by_storage.length === 0 && (
              <ModernCard variant="glass" padding="lg">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                  <LineChart className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>
                    {t("reports.state.empty")}
                  </p>
                </div>
              </ModernCard>
            )}
        </>
      ) : null}
    </div>
  );
}
