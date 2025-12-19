import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TrendingUp, DollarSign, CreditCard, Loader2, AlertCircle, BarChart3, Download, Calendar, LineChart as LineChartIcon } from "../../../lib/lucide";
import { revenueService, type PaymentModeRevenue } from "../../../services/partner/revenue";
import { locationService } from "../../../services/partner/locations";
import { storageService } from "../../../services/partner/storages";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";

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
  const [chartType, setChartType] = useState<ChartType>('line');

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

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  // Prepare chart data
  const prepareChartData = (data: PaymentModeRevenue[] | undefined) => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      name: item.label,
      value: item.total_revenue_minor / 100,
      count: item.transaction_count,
      color: COLORS[index % COLORS.length],
    }));
  };

  const chartData = prepareChartData(paymentModeQuery.data);
  const totalTransactions = paymentModeQuery.data?.reduce((sum, item) => sum + item.transaction_count, 0) || 0;

  // Export payment mode data to CSV
  const handleExportPaymentModeCSV = () => {
    if (!paymentModeQuery.data || paymentModeQuery.data.length === 0) return;

    const headers = ["Ödeme Yöntemi", "Toplam Gelir (TRY)", "Otel Hakedişi (TRY)", "Komisyon (TRY)", "İşlem Sayısı"];
    
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
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-1) 0' }}>
            Filtreler
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            Tarih, lokasyon ve depo bazlı filtreleme yapın
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
          <ModernInput
            type="date"
            label="Başlangıç Tarihi"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            leftIcon={<Calendar className="h-4 w-4" />}
            fullWidth
          />
          <ModernInput
            type="date"
            label="Bitiş Tarihi"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            leftIcon={<Calendar className="h-4 w-4" />}
            fullWidth
          />
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Lokasyon
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Tüm Lokasyonlar</option>
              {locationsQuery.data?.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Depo
            </label>
            <select
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Tüm Depolar</option>
              {storagesQuery.data?.map((storage) => (
                <option key={storage.id} value={storage.id}>{storage.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Grafik Türü
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <ModernButton
                variant={chartType === 'line' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setChartType('line')}
                leftIcon={<LineChartIcon className="h-4 w-4" />}
              >
                Çizgi
              </ModernButton>
              <ModernButton
                variant={chartType === 'bar' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setChartType('bar')}
                leftIcon={<BarChart3 className="h-4 w-4" />}
              >
                Sütun
              </ModernButton>
              <ModernButton
                variant={chartType === 'area' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setChartType('area')}
              >
                Alan
              </ModernButton>
            </div>
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
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>Toplam Gelir</p>
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
            {/* Pie Chart */}
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
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
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
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
              </ResponsiveContainer>
            </div>
            
            {/* Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {paymentModeQuery.data?.map((item, index) => (
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
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>Toplam Gelir</p>
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
    </div>
  );
}
