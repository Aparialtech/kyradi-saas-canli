import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, FileText, FileSpreadsheet, FileJson, Calendar, Filter, TrendingUp, Users, Building2, DollarSign, Package } from "../../../lib/lucide";

import { adminReportService } from "../../../services/admin/reports";
import { adminTenantService } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ReservationTrendChart } from "../../../components/charts/ReservationTrendChart";
import { OccupancyBarChart } from "../../../components/charts/OccupancyBarChart";
import { http } from "../../../lib/http";

export function AdminReportsAnalyticsPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [reportFormat, setReportFormat] = useState<"csv" | "json">("csv");

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const summaryQuery = useQuery({
    queryKey: ["admin", "summary", selectedTenantId, dateFrom, dateTo],
    queryFn: () => adminReportService.summary(),
  });

  const trendsQuery = useQuery({
    queryKey: ["admin", "trends", selectedTenantId, dateFrom, dateTo],
    queryFn: () => adminReportService.getTrends({
      tenant_id: selectedTenantId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      granularity: "daily",
    }),
  });

  const storageUsageQuery = useQuery({
    queryKey: ["admin", "storage-usage", selectedTenantId, dateFrom, dateTo],
    queryFn: () => adminReportService.getStorageUsage({
      tenant_id: selectedTenantId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
  });

  // Transform trend data for chart
  const trendData = useMemo(() => {
    if (!trendsQuery.data || trendsQuery.data.length === 0) return [];
    return trendsQuery.data.map((point) => ({
      date: new Date(point.date).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }),
      reservations: point.reservations,
      revenue: point.revenue_minor / 100, // Convert to major currency
    }));
  }, [trendsQuery.data]);

  // Transform storage usage data for chart
  const occupancyData = useMemo(() => {
    if (!storageUsageQuery.data || storageUsageQuery.data.length === 0) return [];
    // Group by location or show top 10 storages
    return storageUsageQuery.data.slice(0, 10).map((storage) => ({
      label: `${storage.storage_code} (${storage.tenant_name})`,
      occupancy_rate: storage.occupancy_rate,
    }));
  }, [storageUsageQuery.data]);

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTenantId) params.append("tenant_id", selectedTenantId);
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      params.append("format", reportFormat === "pdf" ? "csv" : reportFormat); // PDF için şimdilik CSV kullan

      const response = await http.get(`/admin/reports/export?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: reportFormat === "csv" ? "text/csv" : reportFormat === "json" ? "application/json" : "text/csv",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = reportFormat === "excel" ? "csv" : reportFormat; // Excel için şimdilik CSV
      link.download = `kyradi-rapor-${new Date().toISOString().split("T")[0]}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      push({ title: "Rapor indirildi", type: "success" });
    } catch (error) {
      push({ title: "Rapor indirilemedi", description: String(error), type: "error" });
    }
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1800px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
              Raporlar ve Analiz
            </h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
              Detaylı raporlar, grafikler ve analitik veriler
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value as "csv" | "json")}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <ModernButton
              variant="primary"
              onClick={handleExport}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Rapor İndir
            </ModernButton>
          </div>
        </div>

        {/* Filtreler */}
        <ModernCard variant="glass" padding="md" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tenant Seç
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <option value="">Tüm Tenantlar</option>
                {tenantsQuery.data?.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              />
            </div>
          </div>
        </ModernCard>
      </motion.div>

      {/* Özet Kartlar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)", marginBottom: 'var(--space-6)' }}>
        <ModernCard variant="glass" padding="lg" hoverable>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-1) 0' }}>
                Toplam Tenant
              </p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>
                {summaryQuery.isLoading ? "..." : (summaryQuery.data?.total_tenants ?? 0)}
              </p>
            </div>
            <Building2 className="h-8 w-8" style={{ color: '#6366f1' }} />
          </div>
        </ModernCard>

        <ModernCard variant="glass" padding="lg" hoverable>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-1) 0' }}>
                Toplam Kullanıcı
              </p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>
                {summaryQuery.isLoading ? "..." : (summaryQuery.data?.total_users ?? 0)}
              </p>
            </div>
            <Users className="h-8 w-8" style={{ color: '#16a34a' }} />
          </div>
        </ModernCard>

        <ModernCard variant="glass" padding="lg" hoverable>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-1) 0' }}>
                Toplam Gelir
              </p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>
                {summaryQuery.isLoading ? "..." : formatCurrency(summaryQuery.data?.total_revenue_minor ?? 0)}
              </p>
            </div>
            <DollarSign className="h-8 w-8" style={{ color: '#f59e0b' }} />
          </div>
        </ModernCard>

        <ModernCard variant="glass" padding="lg" hoverable>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 600, margin: '0 0 var(--space-1) 0' }}>
                Toplam Rezervasyon
              </p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>
                {summaryQuery.isLoading ? "..." : (summaryQuery.data?.total_reservations ?? 0)}
              </p>
            </div>
            <Package className="h-8 w-8" style={{ color: '#ec4899' }} />
          </div>
        </ModernCard>
      </div>

      {/* Grafikler */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <ModernCard variant="glass" padding="lg">
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-4) 0' }}>
            Rezervasyon Trendi
          </h3>
          <div style={{ height: '300px' }}>
            {trendsQuery.isLoading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)' }}>Yükleniyor...</p>
              </div>
            ) : (
              <ReservationTrendChart data={trendData} />
            )}
          </div>
        </ModernCard>

        <ModernCard variant="glass" padding="lg">
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-4) 0' }}>
            Depo Doluluk Oranları
          </h3>
          <div style={{ height: '300px' }}>
            {storageUsageQuery.isLoading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)' }}>Yükleniyor...</p>
              </div>
            ) : (
              <OccupancyBarChart data={occupancyData} />
            )}
          </div>
        </ModernCard>
      </div>
    </div>
  );
}

