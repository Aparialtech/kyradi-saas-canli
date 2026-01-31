import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { TrendingUp, DollarSign, CreditCard, Loader2, AlertCircle, BarChart3, Download, LineChart as LineChartIcon, Calendar, Clock, ChevronLeft, ChevronRight, Search, X, Eye, MapPin, Package, User, Receipt } from "../../../lib/lucide";
import { revenueService, type PaymentModeRevenue, type RevenueHistoryResponse, type Settlement, type DailyRevenueItem } from "../../../services/partner/revenue";
import { reservationService } from "../../../services/partner/reservations";
import { ModernModal } from "../../../components/ui/ModernModal";
import { locationService } from "../../../services/partner/locations";
import { storageService } from "../../../services/partner/storages";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { DateField } from "../../../components/ui/DateField";

// Colors for charts
const COLORS = ["#00a389", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

type ChartType = 'line' | 'bar' | 'area' | 'pie';

export function RevenueDashboard() {
  const { messages } = useToast();
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [storageFilter, setStorageFilter] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  
  // Pagination state for history table
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  
  // Search state for history table
  const [historySearch, setHistorySearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  
  // Detail modal state
  const [selectedPeriod, setSelectedPeriod] = useState<DailyRevenueItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [periodSettlements, setPeriodSettlements] = useState<Settlement[]>([]);
  const [reservationDetails, setReservationDetails] = useState<Record<string, { customer_name?: string; location_name?: string; storage_code?: string }>>({});

  // Fetch locations for filter
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: locationService.list,
  });

  // Fetch storages for filter
  const storagesQuery = useQuery({
    queryKey: ["storages"],
    queryFn: () => storageService.list(),
  });

  const revenueQuery = useQuery({
    queryKey: ["revenue", "summary", dateFrom, dateTo],
    queryFn: () => revenueService.getSummary(dateFrom, dateTo),
  });

  const dailyQuery = useQuery({
    queryKey: ["revenue", "daily"],
    queryFn: () => revenueService.getDaily(),
  });

  const paymentModeQuery = useQuery({
    queryKey: ["revenue", "by-payment-mode", dateFrom, dateTo],
    queryFn: () => revenueService.getByPaymentMode(dateFrom, dateTo),
  });

  const historyQuery = useQuery<RevenueHistoryResponse>({
    queryKey: ["revenue", "history", dateFrom, dateTo, granularity],
    queryFn: () => revenueService.getHistory(dateFrom, dateTo, granularity),
  });
  const historyItems: DailyRevenueItem[] = Array.isArray((historyQuery.data as any)?.items)
    ? (historyQuery.data as any).items
    : [];

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  // Prepare chart data
  const prepareChartData = (data: PaymentModeRevenue[] | unknown) => {
    const list: PaymentModeRevenue[] = Array.isArray(data) ? data : [];
    if (!list.length) return [];
    return list.map((item, index) => ({
      name: item.label,
      value: item.total_revenue_minor / 100,
      count: item.transaction_count,
      color: COLORS[index % COLORS.length],
    }));
  };

  const chartData = prepareChartData(paymentModeQuery.data);
  const paymentModeList: PaymentModeRevenue[] = Array.isArray(paymentModeQuery.data)
    ? paymentModeQuery.data
    : [];
  const totalTransactions = paymentModeList.reduce((sum, item) => sum + item.transaction_count, 0);

  // Filter and paginate history data
  const filteredHistoryItems = useMemo(() => {
    const rawItems = (historyQuery.data as any)?.items;
    let items: DailyRevenueItem[] = Array.isArray(rawItems) ? rawItems : [];
    
    // Apply search filter (date)
    if (historySearch.trim()) {
      const searchLower = historySearch.toLowerCase().trim();
      items = items.filter(item => 
        item.date.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply amount filters
    if (minAmount) {
      const min = parseFloat(minAmount) * 100; // Convert to minor
      items = items.filter(item => item.total_revenue_minor >= min);
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount) * 100; // Convert to minor
      items = items.filter(item => item.total_revenue_minor <= max);
    }
    
    return items;
  }, [historyItems, historySearch, minAmount, maxAmount]);
  
  const paginatedHistoryItems = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    const end = start + historyPageSize;
    return filteredHistoryItems.slice(start, end);
  }, [filteredHistoryItems, historyPage, historyPageSize]);

  const historyTotalPages = useMemo(() => {
    return Math.ceil(filteredHistoryItems.length / historyPageSize);
  }, [filteredHistoryItems.length, historyPageSize]);
  
  // Reset page when filters change
  const handleHistorySearchChange = (value: string) => {
    setHistorySearch(value);
    setHistoryPage(1);
  };
  
  const handleMinAmountChange = (value: string) => {
    setMinAmount(value);
    setHistoryPage(1);
  };
  
  const handleMaxAmountChange = (value: string) => {
    setMaxAmount(value);
    setHistoryPage(1);
  };
  
  const clearHistoryFilters = () => {
    setHistorySearch("");
    setMinAmount("");
    setMaxAmount("");
    setHistoryPage(1);
  };
  
  const hasActiveHistoryFilters = historySearch || minAmount || maxAmount;
  
  // Open detail modal and fetch settlements for the selected period
  const handleRowClick = async (item: DailyRevenueItem) => {
    setSelectedPeriod(item);
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    setPeriodSettlements([]);
    setReservationDetails({});
    
    try {
      // Calculate date range based on granularity
      let dateFromStr = item.date;
      let dateToStr = item.date;
      
      if (granularity === "daily") {
        dateToStr = item.date + "T23:59:59";
        dateFromStr = item.date + "T00:00:00";
      } else if (granularity === "weekly") {
        // Item date format: "2024-W01"
        // We'll just use the date as-is for now
        dateFromStr = item.date;
        dateToStr = item.date;
      } else if (granularity === "monthly") {
        // Item date format: "2024-01"
        dateFromStr = item.date + "-01";
        const [year, month] = item.date.split("-");
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        dateToStr = `${item.date}-${lastDay}`;
      }
      
      // Fetch settlements for this period
      const response = await revenueService.listSettlements(
        undefined, // status
        dateFromStr,
        dateToStr,
        locationFilter || undefined,
        storageFilter || undefined
      );
      
      setPeriodSettlements(response.items);
      
      // Fetch reservation details for each settlement (limit to avoid too many requests)
      const reservationIds = [...new Set(response.items.map(s => s.reservation_id).filter(Boolean))].slice(0, 20);
      const details: Record<string, { customer_name?: string; location_name?: string; storage_code?: string }> = {};
      
      // Fetch reservations in parallel (up to 5 at a time)
      const batchSize = 5;
      for (let i = 0; i < reservationIds.length; i += batchSize) {
        const batch = reservationIds.slice(i, i + batchSize);
        const promises = batch.map(async (resId) => {
          try {
            const res = await reservationService.getById(resId);
            details[resId] = {
              customer_name: res.customer_name || res.full_name || "—",
              location_name: res.location_name || "—",
              storage_code: res.storage_code || "—",
            };
          } catch {
            details[resId] = { customer_name: "—", location_name: "—", storage_code: "—" };
          }
        });
        await Promise.all(promises);
      }
      
      setReservationDetails(details);
    } catch (error) {
      console.error("Failed to fetch period details:", error);
    } finally {
      setDetailLoading(false);
    }
  };
  
  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedPeriod(null);
    setPeriodSettlements([]);
    setReservationDetails({});
  };

  // Export payment mode data to CSV
  const handleExportPaymentModeCSV = () => {
    if (!paymentModeQuery.data || paymentModeQuery.data.length === 0) return;

    const headers = [
      t("revenue.paymentMethod"),
      `${t("revenue.totalRevenue")} (TRY)`,
      `${t("revenue.hotelSettlement")} (TRY)`,
      `${t("revenue.kyradiCommission")} (TRY)`,
      t("revenue.transactionCount")
    ];
    
    const rows = paymentModeQuery.data.map((item) => [
      item.label,
      (item.total_revenue_minor / 100).toFixed(2),
      (item.tenant_settlement_minor / 100).toFixed(2),
      (item.kyradi_commission_minor / 100).toFixed(2),
      item.transaction_count.toString(),
    ]);

    // Add totals row
    const totalRevenue = paymentModeQuery.data.reduce((sum, item) => sum + item.total_revenue_minor, 0);
    const totalSettlement = paymentModeQuery.data.reduce((sum, item) => sum + item.tenant_settlement_minor, 0);
    const totalCommission = paymentModeQuery.data.reduce((sum, item) => sum + item.kyradi_commission_minor, 0);
    
    rows.push([
      "TOPLAM",
      (totalRevenue / 100).toFixed(2),
      (totalSettlement / 100).toFixed(2),
      (totalCommission / 100).toFixed(2),
      totalTransactions.toString(),
    ]);

    const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    
    // Add BOM for Excel UTF-8 support
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.download = `odeme_yontemleri_raporu_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; count: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <p style={{ fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-1) 0', color: 'var(--text-primary)' }}>
            {data.name}
          </p>
          <p style={{ margin: '0 0 var(--space-1) 0', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Gelir: {formatCurrency(data.value * 100)}
          </p>
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            İşlem: {data.count} adet
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
          {t("nav.revenue")}
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          Gelir özetleri ve hakediş detaylarını görüntüleyin
        </p>
      </motion.div>

      {/* Enhanced Filters */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-1) 0', color: 'var(--text-primary)' }}>
            Filtreler
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            Tarih, lokasyon ve depo bazlı filtreleme yapın
          </p>
        </div>
        
        {/* Filter Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(4, 1fr)", 
          gap: "var(--space-4)",
          marginBottom: 'var(--space-5)'
        }}>
          {/* Başlangıç Tarihi */}
          <DateField
            label="Başlangıç Tarihi"
            value={dateFrom}
            onChange={(value) => setDateFrom(value || "")}
            fullWidth
          />

          {/* Bitiş Tarihi */}
          <DateField
            label="Bitiş Tarihi"
            value={dateTo}
            onChange={(value) => setDateTo(value || "")}
            fullWidth
          />

          {/* Lokasyon */}
          <div>
            <label style={{ 
              fontSize: 'var(--text-sm)', 
              fontWeight: 'var(--font-medium)', 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--space-2)', 
              display: 'block' 
            }}>
              Lokasyon
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: 'var(--space-8)',
              }}
            >
              <option value="">Tüm Lokasyonlar</option>
              {Array.isArray(locationsQuery.data) && locationsQuery.data.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Depo */}
          <div>
            <label style={{ 
              fontSize: 'var(--text-sm)', 
              fontWeight: 'var(--font-medium)', 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--space-2)', 
              display: 'block' 
            }}>
              Depo
            </label>
            <select
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: 'var(--space-8)',
              }}
            >
              <option value="">Tüm Depolar</option>
              {Array.isArray(storagesQuery.data) && storagesQuery.data.map((storage) => (
                <option key={storage.id} value={storage.id}>{storage.code}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grafik Türü */}
        <div>
          <label style={{ 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-medium)', 
            color: 'var(--text-secondary)', 
            marginBottom: 'var(--space-2)', 
            display: 'block' 
          }}>
            Grafik Türü
          </label>
          <div style={{ 
            display: 'inline-flex', 
            gap: 'var(--space-1)', 
            background: 'var(--bg-tertiary)', 
            padding: 'var(--space-1)', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)'
          }}>
            <button
              onClick={() => setChartType('line')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: chartType === 'line' ? 'var(--primary-500)' : 'transparent',
                color: chartType === 'line' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              <LineChartIcon className="h-4 w-4" />
              Çizgi
            </button>
            <button
              onClick={() => setChartType('bar')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: chartType === 'bar' ? 'var(--primary-500)' : 'transparent',
                color: chartType === 'bar' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              <BarChart3 className="h-4 w-4" />
              Sütun
            </button>
            <button
              onClick={() => setChartType('area')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: chartType === 'area' ? 'var(--primary-500)' : 'transparent',
                color: chartType === 'area' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              <TrendingUp className="h-4 w-4" />
              Alan
            </button>
            <button
              onClick={() => setChartType('pie')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: chartType === 'pie' ? 'var(--primary-500)' : 'transparent',
                color: chartType === 'pie' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              <DollarSign className="h-4 w-4" />
              Pasta
            </button>
          </div>
        </div>
      </ModernCard>

      {/* Today's summary */}
      {dailyQuery.data && (
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              Bugünkü Özet
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Günlük gelir ve hakediş özeti
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>{t("revenue.totalRevenue")}</p>
                  <DollarSign className="h-5 w-5" style={{ color: '#16a34a' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: 0 }}>
                  {formatCurrency(dailyQuery.data.total_revenue_minor ?? 0)}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.1) 0%, rgba(29, 78, 216, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(29, 78, 216, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>Otel Hakedişi</p>
                  <CreditCard className="h-5 w-5" style={{ color: '#1d4ed8' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#1d4ed8', margin: 0 }}>
                  {formatCurrency(dailyQuery.data.tenant_settlement_minor ?? 0)}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>Kyradi Komisyonu</p>
                  <TrendingUp className="h-5 w-5" style={{ color: '#dc2626' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#dc2626', margin: 0 }}>
                  {formatCurrency(dailyQuery.data.kyradi_commission_minor ?? 0)}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>İşlem Sayısı</p>
                  <BarChart3 className="h-5 w-5" style={{ color: '#6366f1' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#6366f1', margin: 0 }}>
                  {dailyQuery.data.transaction_count}
                </p>
              </div>
            </motion.div>
          </div>
        </ModernCard>
      )}

      {/* Payment Method Distribution Chart */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              Ödeme Yöntemleri Dağılımı
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {dateFrom || dateTo 
                ? `Seçili dönem için ödeme yöntemlerine göre gelir dağılımı`
                : `Tüm zamanlar için ödeme yöntemlerine göre gelir dağılımı`}
            </p>
          </div>
          {chartData.length > 0 && (
            <ModernButton
              variant="outline"
              size="sm"
              onClick={handleExportPaymentModeCSV}
              leftIcon={<Download className="h-4 w-4" />}
            >
              CSV İndir
            </ModernButton>
          )}
        </div>
        
        {paymentModeQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Veriler yükleniyor...</p>
          </div>
        ) : paymentModeQuery.isError ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: "0.5rem", fontSize: 'var(--text-lg)' }}>
              Veriler yüklenemedi
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <BarChart3 className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem", fontSize: 'var(--text-lg)' }}>
              Henüz ödeme kaydı bulunmuyor
            </p>
            <p style={{ margin: 0 }}>Ödemeler tamamlandıkça ödeme yöntemi dağılımı burada görüntülenecektir.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'center' }}>
            {/* Dynamic Chart based on chartType */}
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartData[index].color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value: string) => (
                        <span style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <defs>
                      {chartData.map((entry, index) => (
                        <linearGradient key={`gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₺${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#barGradient-${index})`} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₺${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#00a389" 
                      strokeWidth={3}
                      dot={{ fill: '#00a389', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#00a389' }}
                    />
                  </LineChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00a389" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#00a389" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `₺${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#00a389" 
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#areaGradient)"
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
            
            {/* Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {paymentModeList.map((item, index) => (
                <motion.div
                  key={item.mode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${COLORS[index % COLORS.length]}`,
                  }}
                >
                  <div>
                    <p style={{ 
                      fontWeight: 'var(--font-semibold)', 
                      color: 'var(--text-primary)', 
                      margin: '0 0 var(--space-1) 0',
                      fontSize: 'var(--text-sm)'
                    }}>
                      {item.label}
                    </p>
                    <p style={{ 
                      color: 'var(--text-tertiary)', 
                      margin: 0,
                      fontSize: 'var(--text-xs)'
                    }}>
                      {item.transaction_count} işlem ({totalTransactions > 0 ? Math.round((item.transaction_count / totalTransactions) * 100) : 0}%)
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ 
                      fontWeight: 'var(--font-bold)', 
                      color: COLORS[index % COLORS.length], 
                      margin: '0 0 var(--space-1) 0',
                      fontSize: 'var(--text-base)'
                    }}>
                      {formatCurrency(item.total_revenue_minor)}
                    </p>
                    <p style={{ 
                      color: 'var(--text-tertiary)', 
                      margin: 0,
                      fontSize: 'var(--text-xs)'
                    }}>
                      Hakediş: {formatCurrency(item.tenant_settlement_minor)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </ModernCard>

      {/* Revenue History Table */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Clock className="h-5 w-5" style={{ color: 'var(--primary-500)' }} />
              Dönemsel Gelir Listesi
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {historyQuery.data?.period_start && historyQuery.data?.period_end 
                ? `${historyQuery.data.period_start} - ${historyQuery.data.period_end} tarihleri arası`
                : 'Son 30 günlük gelir geçmişi'}
            </p>
          </div>
          
          {/* Granularity Selector */}
          <div style={{ 
            display: 'inline-flex', 
            gap: 'var(--space-1)', 
            background: 'var(--bg-tertiary)', 
            padding: 'var(--space-1)', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)'
          }}>
            <button
              onClick={() => setGranularity('daily')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: granularity === 'daily' ? 'var(--primary-500)' : 'transparent',
                color: granularity === 'daily' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              Günlük
            </button>
            <button
              onClick={() => setGranularity('weekly')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: granularity === 'weekly' ? 'var(--primary-500)' : 'transparent',
                color: granularity === 'weekly' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              Haftalık
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: granularity === 'monthly' ? 'var(--primary-500)' : 'transparent',
                color: granularity === 'monthly' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                transition: 'all 0.2s ease',
              }}
            >
              Aylık
            </button>
          </div>
        </div>
        
        {/* Search and Filter Bar */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-3)', 
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          {/* Search by date */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ 
              fontSize: 'var(--text-xs)', 
              fontWeight: 'var(--font-medium)', 
              color: 'var(--text-tertiary)', 
              marginBottom: 'var(--space-1)', 
              display: 'block' 
            }}>
              Tarih Ara
            </label>
            <div style={{ position: 'relative' }}>
              <Search className="h-4 w-4" style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-tertiary)' 
              }} />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => handleHistorySearchChange(e.target.value)}
                placeholder="Tarih ara (örn: 2024-01)"
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 var(--space-3) 0 36px',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
            </div>
          </div>
          
          {/* Min Amount */}
          <div style={{ width: '140px' }}>
            <label style={{ 
              fontSize: 'var(--text-xs)', 
              fontWeight: 'var(--font-medium)', 
              color: 'var(--text-tertiary)', 
              marginBottom: 'var(--space-1)', 
              display: 'block' 
            }}>
              Min Tutar (₺)
            </label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => handleMinAmountChange(e.target.value)}
              placeholder="0"
              min="0"
              step="100"
              style={{
                width: '100%',
                height: '40px',
                padding: '0 var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          
          {/* Max Amount */}
          <div style={{ width: '140px' }}>
            <label style={{ 
              fontSize: 'var(--text-xs)', 
              fontWeight: 'var(--font-medium)', 
              color: 'var(--text-tertiary)', 
              marginBottom: 'var(--space-1)', 
              display: 'block' 
            }}>
              Max Tutar (₺)
            </label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => handleMaxAmountChange(e.target.value)}
              placeholder="∞"
              min="0"
              step="100"
              style={{
                width: '100%',
                height: '40px',
                padding: '0 var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          
          {/* Clear Filters Button */}
          {hasActiveHistoryFilters && (
            <button
              onClick={clearHistoryFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                height: '40px',
                padding: '0 var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <X className="h-4 w-4" />
              Temizle
            </button>
          )}
        </div>
        
        {/* Active Filters Info */}
        {hasActiveHistoryFilters && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--primary-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--primary-200)',
            fontSize: 'var(--text-sm)',
            color: 'var(--primary-700)'
          }}>
            <Search className="h-4 w-4" />
            <span>
              <strong>{filteredHistoryItems.length}</strong> kayıt filtrelendi
              {historyItems.length > 0 && ` (toplam ${historyItems.length} kayıttan)`}
            </span>
          </div>
        )}

        {historyQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-10 w-10" style={{ margin: '0 auto var(--space-3) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-base)', margin: 0 }}>Gelir geçmişi yükleniyor...</p>
          </div>
        ) : historyQuery.isError ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-10 w-10" style={{ margin: '0 auto var(--space-3) auto', color: '#dc2626' }} />
            <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>Gelir geçmişi yüklenemedi</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Calendar className="h-12 w-12" style={{ margin: '0 auto var(--space-3) auto', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Bu dönemde gelir kaydı yok</p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Seçili tarih aralığında işlem bulunmuyor.</p>
          </div>
        ) : (
          <>
            {/* Summary Row */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: 'var(--space-4)', 
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-4)',
              background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--primary-200)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t("revenue.totalRevenue")}</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: 0 }}>{formatCurrency(historyQuery.data?.total_revenue_minor ?? 0)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Otel Hakedişi</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: '#1d4ed8', margin: 0 }}>{formatCurrency(historyQuery.data?.total_tenant_settlement_minor ?? 0)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Komisyon</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: '#dc2626', margin: 0 }}>{formatCurrency(historyQuery.data?.total_kyradi_commission_minor ?? 0)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>İşlem Sayısı</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: '#6366f1', margin: 0 }}>{historyQuery.data?.total_transaction_count ?? 0}</p>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>
                      {granularity === 'daily' ? 'Tarih' : granularity === 'weekly' ? 'Hafta' : 'Ay'}
                    </th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>{t("revenue.totalRevenue")}</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Otel Hakedişi</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Komisyon</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>İşlem</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistoryItems.map((item, index) => (
                    <motion.tr
                      key={item.date}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleRowClick(item)}
                      style={{ 
                        borderBottom: '1px solid var(--border-secondary)',
                        background: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-50)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'}
                    >
                      <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <Calendar className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                          {item.date}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: '#16a34a' }}>
                        {formatCurrency(item.total_revenue_minor)}
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: '#1d4ed8' }}>
                        {formatCurrency(item.tenant_settlement_minor)}
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: '#dc2626' }}>
                        {formatCurrency(item.kyradi_commission_minor)}
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                        <span style={{ 
                          background: 'var(--primary-100)', 
                          color: 'var(--primary-700)', 
                          padding: 'var(--space-1) var(--space-2)', 
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--font-semibold)'
                        }}>
                          {item.transaction_count}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                            padding: 'var(--space-1) var(--space-2)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-xs)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          Detay
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyTotalPages > 1 && (
              <div style={{ 
                marginTop: 'var(--space-4)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: 'var(--space-3)',
                borderTop: '1px solid var(--border-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                    Sayfa başına:
                  </span>
                  <select
                    value={historyPageSize}
                    onChange={(e) => {
                      setHistoryPageSize(Number(e.target.value));
                      setHistoryPage(1);
                    }}
                    style={{
                      padding: 'var(--space-1) var(--space-2)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                    {hasActiveHistoryFilters 
                      ? `${filteredHistoryItems.length} / ${historyItems.length} kayıt`
                      : `Toplam ${historyItems.length} kayıt`
                    }
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      background: historyPage === 1 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                      color: historyPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  <span style={{ 
                    padding: '0 var(--space-3)', 
                    fontSize: 'var(--text-sm)', 
                    color: 'var(--text-primary)',
                    fontWeight: 'var(--font-medium)'
                  }}>
                    {historyPage} / {historyTotalPages}
                  </span>
                  
                  <button
                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                    disabled={historyPage === historyTotalPages}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      background: historyPage === historyTotalPages ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                      color: historyPage === historyTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: historyPage === historyTotalPages ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </ModernCard>

      {/* Period summary */}
      {revenueQuery.data && (dateFrom || dateTo) && (
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              Dönem Özeti {dateFrom && dateTo && `(${dateFrom} - ${dateTo})`}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Seçili tarih aralığındaki gelir ve hakediş özeti
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>{t("revenue.totalRevenue")}</p>
                  <DollarSign className="h-5 w-5" style={{ color: '#16a34a' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: 0 }}>
                  {formatCurrency(revenueQuery.data.total_revenue_minor ?? 0)}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.1) 0%, rgba(29, 78, 216, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(29, 78, 216, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>Otel Hakedişi</p>
                  <CreditCard className="h-5 w-5" style={{ color: '#1d4ed8' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#1d4ed8', margin: 0 }}>
                  {formatCurrency(revenueQuery.data.tenant_settlement_minor ?? 0)}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>Kyradi Komisyonu</p>
                  <TrendingUp className="h-5 w-5" style={{ color: '#dc2626' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#dc2626', margin: 0 }}>
                  {formatCurrency(revenueQuery.data.kyradi_commission_minor ?? 0)}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>İşlem Sayısı</p>
                  <BarChart3 className="h-5 w-5" style={{ color: '#6366f1' }} />
                </div>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#6366f1', margin: 0 }}>
                  {revenueQuery.data.transaction_count}
                </p>
              </div>
            </motion.div>
          </div>
        </ModernCard>
      )}

      {/* Loading State */}
      {(revenueQuery.isLoading || dailyQuery.isLoading) && !dailyQuery.data && !revenueQuery.data && (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Gelir verileri yükleniyor...</p>
          </div>
        </ModernCard>
      )}

      {/* Error State */}
      {(revenueQuery.isError || dailyQuery.isError) && (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: "0.5rem", fontSize: 'var(--text-lg)' }}>
              Gelir verileri yüklenemedi
            </p>
            <p style={{ color: "#991b1b", fontSize: "0.875rem", marginBottom: 'var(--space-4)' }}>
              Lütfen sayfayı yenileyerek tekrar deneyin.
            </p>
          </div>
        </ModernCard>
      )}

      {/* Period Detail Modal */}
      <ModernModal
        isOpen={isDetailModalOpen}
        onClose={closeDetailModal}
        title={`${selectedPeriod?.date || ''} Dönem Detayı`}
        size="xl"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          {/* Period Summary */}
          {selectedPeriod && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: 'var(--space-3)', 
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-4)',
              background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--primary-200)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase' }}>Toplam Gelir</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: 0 }}>{formatCurrency(selectedPeriod.total_revenue_minor)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase' }}>Otel Hakedişi</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: '#1d4ed8', margin: 0 }}>{formatCurrency(selectedPeriod.tenant_settlement_minor)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase' }}>Komisyon</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: '#dc2626', margin: 0 }}>{formatCurrency(selectedPeriod.kyradi_commission_minor)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0', textTransform: 'uppercase' }}>İşlem Sayısı</p>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: '#6366f1', margin: 0 }}>{selectedPeriod.transaction_count}</p>
              </div>
            </div>
          )}

          {/* Settlements List */}
          <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Receipt className="h-4 w-4" style={{ color: 'var(--primary-500)' }} />
            İşlem Detayları ({periodSettlements.length} kayıt)
          </h4>

          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-8 w-8" style={{ margin: '0 auto var(--space-3) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <p style={{ margin: 0 }}>Detaylar yükleniyor...</p>
            </div>
          ) : periodSettlements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <AlertCircle className="h-8 w-8" style={{ margin: '0 auto var(--space-3) auto', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>Bu dönemde işlem bulunamadı.</p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10 }}>
                  <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <User className="h-3 w-3" />
                        Müşteri
                      </div>
                    </th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <MapPin className="h-3 w-3" />
                        Lokasyon
                      </div>
                    </th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <Package className="h-3 w-3" />
                        Depo
                      </div>
                    </th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Gelir</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Hakediş</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Komisyon</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'center', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {periodSettlements.map((settlement, idx) => {
                    const details = reservationDetails[settlement.reservation_id] || {};
                    return (
                      <tr 
                        key={settlement.id}
                        style={{ 
                          borderBottom: '1px solid var(--border-secondary)',
                          background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                        }}
                      >
                        <td style={{ padding: 'var(--space-2)', color: 'var(--text-primary)', fontWeight: 'var(--font-medium)' }}>
                          {details.customer_name || '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                          {details.location_name || '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                          <span style={{ 
                            background: 'var(--bg-tertiary)', 
                            padding: 'var(--space-1) var(--space-2)', 
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'monospace'
                          }}>
                            {details.storage_code || '—'}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 'var(--font-semibold)', color: '#16a34a' }}>
                          {formatCurrency(settlement.total_amount_minor)}
                        </td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'right', color: '#1d4ed8' }}>
                          {formatCurrency(settlement.tenant_settlement_minor)}
                        </td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'right', color: '#dc2626' }}>
                          {formatCurrency(settlement.kyradi_commission_minor)}
                        </td>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                          <span style={{ 
                            background: settlement.status === 'settled' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                            color: settlement.status === 'settled' ? '#16a34a' : '#ca8a04',
                            padding: 'var(--space-1) var(--space-2)', 
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--font-medium)'
                          }}>
                            {settlement.status === 'settled' ? 'Tamamlandı' : settlement.status === 'pending' ? 'Bekliyor' : settlement.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Commission Rate Info */}
          {periodSettlements.length > 0 && (
            <div style={{ 
              marginTop: 'var(--space-4)', 
              padding: 'var(--space-3)', 
              background: 'var(--bg-secondary)', 
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                Komisyon Oranı: %{((periodSettlements[0]?.commission_rate || 0) * 100).toFixed(1)}
              </span>
              <span>
                Toplam {periodSettlements.length} işlem
              </span>
            </div>
          )}
        </div>
      </ModernModal>
    </div>
  );
}
