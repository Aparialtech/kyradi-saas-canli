import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Filter, BarChart3, LineChart as LineChartIcon, PieChartIcon, TrendingUp } from "../../../lib/lucide";

import { partnerReportService, type PartnerOverviewResponse } from "../../../services/partner/reports";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";
import { ModernCard } from "../../../components/ui/ModernCard";
import { StatCard } from "../../../components/ui/ModernCard";
import { ReservationTrendChart } from "../../../components/charts/ReservationTrendChart";
import { RevenueDonutChart } from "../../../components/charts/RevenueDonutChart";
import { OccupancyBarChart } from "../../../components/charts/OccupancyBarChart";
import { ModernButton } from "../../../components/ui/ModernButton";
import { PiggyBank, FileText, Briefcase, LineChart } from "../../../lib/lucide";
import { locationService } from "../../../services/partner/locations";

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

  const occupancyData = useMemo(() => {
    if (!storageUsageQuery.data) return [];
    return storageUsageQuery.data.map((item) => ({
      label: `${item.location_name} / ${item.storage_code}`,
      occupancy_rate: item.occupancy_rate ?? 0,
    }));
  }, [storageUsageQuery.data]);

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
                console.error("Export failed:", error);
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
                console.error("Export failed:", error);
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
                console.error("Export failed:", error);
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
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
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
              <h3 style={{ margin: '0 0 var(--space-6) 0', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                Lokasyon Doluluk Oranları
              </h3>
              <div style={{ height: '350px', minHeight: '350px', minWidth: 0 }}>
                {storageUsageQuery.isLoading ? (
                  <div className="shimmer" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }} />
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

          {/* Location Revenue Table */}
          {overviewQuery.data.by_location.length > 0 && (
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ margin: '0 0 var(--space-6) 0', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                {t("reports.tables.byLocation.title")}
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>{t("reports.tables.byLocation.columns.location")}</th>
                      <th style={{ textAlign: "right" }}>{t("reports.tables.byLocation.columns.revenue")}</th>
                      <th style={{ textAlign: "right" }}>{t("reports.tables.byLocation.columns.reservations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.data.by_location.map((location, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{location.location_name}</strong>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {currencyFormatter.format(location.revenue_minor / 100)}
                        </td>
                        <td style={{ textAlign: "right" }}>{numberFormatter.format(location.reservations)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ModernCard>
          )}

          {/* Storage Usage Table */}
          {overviewQuery.data.by_storage.length > 0 && (
            <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ margin: '0 0 var(--space-6) 0', fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                {t("reports.tables.byStorage.title")}
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>{t("reports.tables.byStorage.columns.storage")}</th>
                      <th>{t("reports.tables.byStorage.columns.location")}</th>
                      <th style={{ textAlign: "right" }}>{t("reports.tables.byStorage.columns.reservations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.data.by_storage.map((storage, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{storage.storage_code}</strong>
                        </td>
                        <td>{storage.location_name}</td>
                        <td style={{ textAlign: "right" }}>{numberFormatter.format(storage.reservations)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
