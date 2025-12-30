import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Users, Building2, DollarSign, Package, Receipt } from "../../../lib/lucide";
import { useTranslation } from "../../../hooks/useTranslation";

import { adminReportService } from "../../../services/admin/reports";
import type { AdminStorageUsage } from "../../../services/admin/reports";
import { adminTenantService } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { DateField } from "../../../components/ui/DateField";
import { ReservationTrendChart } from "../../../components/charts/ReservationTrendChart";
import { OccupancyBarChart } from "../../../components/charts/OccupancyBarChart";
import { http } from "../../../lib/http";
import { errorLogger } from "../../../lib/errorLogger";
import { Modal } from "../../../components/common/Modal";

export function AdminReportsAnalyticsPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [reportFormat, setReportFormat] = useState<"csv" | "json" | "pdf" | "excel">("csv");
  const [selectedStorage, setSelectedStorage] = useState<AdminStorageUsage | null>(null);

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const summaryQuery = useQuery({
    queryKey: ["admin", "summary", selectedTenantId, dateFrom, dateTo],
    queryFn: () => adminReportService.summary({
      tenant_id: selectedTenantId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    enabled: true, // Always enabled, but will use filters if provided
  });

  const trendsQuery = useQuery({
    queryKey: ["admin", "trends", selectedTenantId, dateFrom, dateTo],
    queryFn: () => adminReportService.getTrends({
      tenant_id: selectedTenantId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      granularity: "daily",
    }),
    enabled: true, // Always enabled
  });

  const storageUsageQuery = useQuery({
    queryKey: ["admin", "storage-usage", selectedTenantId, dateFrom, dateTo],
    queryFn: () => adminReportService.getStorageUsage({
      tenant_id: selectedTenantId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    enabled: true, // Always enabled
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
      storage_id: storage.storage_id,
      storage_code: storage.storage_code,
      location_name: storage.location_name,
      tenant_name: storage.tenant_name,
      reservations: storage.reservations,
      total_revenue_minor: storage.total_revenue_minor,
    }));
  }, [storageUsageQuery.data]);

  // Calculate totals from trends data
  const totals = useMemo(() => {
    if (!trendsQuery.data || trendsQuery.data.length === 0) {
      return { totalRevenue: 0, totalCommission: 0 };
    }
    const totalRevenue = trendsQuery.data.reduce((sum, point) => sum + point.revenue_minor, 0);
    const totalCommission = trendsQuery.data.reduce((sum, point) => sum + point.commission_minor, 0);
    return { totalRevenue, totalCommission };
  }, [trendsQuery.data]);

  const formatCurrency = (minor: number | null | undefined) => {
    const safeValue = Number(minor) || 0;
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(safeValue / 100);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTenantId) params.append("tenant_id", selectedTenantId);
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      // PDF ve Excel için şimdilik CSV kullan
      const exportFormat = reportFormat === "pdf" || reportFormat === "excel" ? "csv" : reportFormat;
      params.append("format", exportFormat);

      const response = await http.get(`/admin/reports/export?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: exportFormat === "csv" ? "text/csv" : exportFormat === "json" ? "application/json" : "text/csv",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = reportFormat === "excel" || reportFormat === "pdf" ? "csv" : reportFormat;
      link.download = `kyradi-rapor-${new Date().toISOString().split("T")[0]}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      push({ title: "Rapor indirildi", type: "success" });
    } catch (error) {
      errorLogger.error(error, {
        component: "AdminReportsAnalyticsPage",
        action: "exportReport",
        format: reportFormat,
      });
      push({ title: "Rapor indirilemedi", description: String(error), type: "error" });
    }
  };

  const handleGenerateCommissionInvoice = async () => {
    if (!selectedTenantId) {
      push({ title: "Lütfen bir tenant seçin", type: "error" });
      return;
    }
    if (!dateFrom || !dateTo) {
      push({ title: "Lütfen tarih aralığı seçin", type: "error" });
      return;
    }

    try {
      const invoiceNumber = `KYRADI-KOM-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${selectedTenantId.slice(0, 8).toUpperCase()}`;
      const payload = {
        tenant_id: selectedTenantId,
        invoice_number: invoiceNumber,
        invoice_date: dateFrom,
        due_date: dateTo,
        items: [{
          description: `Kyradi Komisyon Ücreti (${dateFrom} - ${dateTo})`,
          quantity: 1,
          unit_price_minor: totals.totalCommission,
          total_minor: totals.totalCommission,
        }],
        subtotal_minor: totals.totalCommission,
        tax_rate: 0.20,
        tax_amount_minor: Math.round(totals.totalCommission * 0.20),
        total_minor: Math.round(totals.totalCommission * 1.20),
        notes: `Seçilen tarih aralığı için Kyradi komisyon ücreti`,
      };

      let response;
      try {
        response = await http.post(`/admin/invoices/generate?format=pdf`, payload, {
          responseType: "blob",
        });
      } catch (error: any) {
        errorLogger.error(error, {
          component: "AdminReportsAnalyticsPage",
          action: "generateCommissionInvoice",
          step: "httpRequest",
        });
        // If axios throws an error, check if it's a blob response with error
        if (error?.response?.data instanceof Blob) {
          try {
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(error.response.data);
            });
            const errorData = JSON.parse(text);
            throw new Error(errorData.detail || `HTTP ${error.response.status}: Fatura oluşturulamadı`);
          } catch (parseError) {
            errorLogger.error(parseError, {
              component: "AdminReportsAnalyticsPage",
              action: "generateCommissionInvoice",
              step: "parseError",
            });
            throw new Error(`HTTP ${error.response?.status || 500}: Fatura oluşturulamadı`);
          }
        }
        throw error;
      }

      // Check content type - if JSON, it's an error
      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        // Response is JSON error
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(response.data);
        });
        const errorData = JSON.parse(text);
        throw new Error(errorData.detail || "Fatura oluşturulamadı");
      }

      // Determine file extension and MIME type based on content type
      let extension = "pdf";
      let mimeType = "application/pdf";
      if (contentType.includes("vnd.openxmlformats-officedocument.wordprocessingml.document") || contentType.includes("application/msword")) {
        extension = "docx";
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (contentType.includes("text/html") || contentType.includes("html")) {
        extension = "html";
        mimeType = "text/html";
      }

      const blob = new Blob([response.data], {
        type: mimeType,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const formatName = extension === "docx" ? "Word" : extension === "html" ? "HTML" : "PDF";
      push({ 
        title: `Komisyon faturası ${formatName} olarak oluşturuldu`, 
        type: "success" 
      });
    } catch (error: any) {
      let errorMessage = "Fatura oluşturulamadı";
      
      if (error?.response?.data) {
        // Try to read blob as text if it's an error
        if (error.response.data instanceof Blob) {
          try {
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(error.response.data);
            });
            const errorData = JSON.parse(text);
            errorMessage = errorData.detail || errorMessage;
          } catch {
            // Ignore parsing errors
          }
        } else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.detail || errorMessage;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      errorLogger.error(error, {
        component: "AdminReportsAnalyticsPage",
        action: "generateCommissionInvoice",
        errorMessage,
      });
      
      push({ 
        title: "Fatura oluşturulamadı", 
        description: errorMessage,
        type: "error" 
      });
    }
  };

  const handleGenerateRevenueInvoice = async () => {
    if (!selectedTenantId) {
      push({ title: "Lütfen bir tenant seçin", type: "error" });
      return;
    }
    if (!dateFrom || !dateTo) {
      push({ title: "Lütfen tarih aralığı seçin", type: "error" });
      return;
    }

    try {
      const invoiceNumber = `KYRADI-GEL-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${selectedTenantId.slice(0, 8).toUpperCase()}`;
      const payload = {
        tenant_id: selectedTenantId,
        invoice_number: invoiceNumber,
        invoice_date: dateFrom,
        due_date: dateTo,
        items: [{
          description: `Genel Gelir Faturası (${dateFrom} - ${dateTo})`,
          quantity: 1,
          unit_price_minor: totals.totalRevenue,
          total_minor: totals.totalRevenue,
        }],
        subtotal_minor: totals.totalRevenue,
        tax_rate: 0.20,
        tax_amount_minor: Math.round(totals.totalRevenue * 0.20),
        total_minor: Math.round(totals.totalRevenue * 1.20),
        notes: `Seçilen tarih aralığı için genel gelir faturası`,
      };

      let response;
      try {
        response = await http.post(`/admin/invoices/generate?format=pdf`, payload, {
          responseType: "blob",
        });
      } catch (error: any) {
        // If axios throws an error, check if it's a blob response with error
        if (error?.response?.data instanceof Blob) {
          try {
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(error.response.data);
            });
            const errorData = JSON.parse(text);
            throw new Error(errorData.detail || `HTTP ${error.response.status}: Fatura oluşturulamadı`);
          } catch (parseError) {
            errorLogger.error(parseError, {
              component: "AdminReportsAnalyticsPage",
              action: "parseInvoiceError",
            });
            throw new Error(`HTTP ${error.response?.status || 500}: Fatura oluşturulamadı`);
          }
        }
        throw error;
      }

      // Check content type - if JSON, it's an error
      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        // Response is JSON error
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(response.data);
        });
        const errorData = JSON.parse(text);
        throw new Error(errorData.detail || "Fatura oluşturulamadı");
      }

      // Determine file extension and MIME type based on content type
      let extension = "pdf";
      let mimeType = "application/pdf";
      if (contentType.includes("vnd.openxmlformats-officedocument.wordprocessingml.document") || contentType.includes("application/msword")) {
        extension = "docx";
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (contentType.includes("text/html") || contentType.includes("html")) {
        extension = "html";
        mimeType = "text/html";
      }

      const blob = new Blob([response.data], {
        type: mimeType,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const formatName = extension === "docx" ? "Word" : extension === "html" ? "HTML" : "PDF";
      push({ 
        title: `Gelir faturası ${formatName} olarak oluşturuldu`, 
        type: "success" 
      });
    } catch (error: any) {
      let errorMessage = "Fatura oluşturulamadı";
      
      if (error?.response?.data) {
        // Try to read blob as text if it's an error
        if (error.response.data instanceof Blob) {
          try {
            const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(error.response.data);
            });
            const errorData = JSON.parse(text);
            errorMessage = errorData.detail || errorMessage;
          } catch {
            // Ignore parsing errors
          }
        } else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.detail || errorMessage;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      errorLogger.error(error, {
        component: "AdminReportsAnalyticsPage",
        action: "generateRevenueInvoice",
        errorMessage,
      });
      
      push({ 
        title: "Fatura oluşturulamadı", 
        description: errorMessage,
        type: "error" 
      });
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
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedTenantId && dateFrom && dateTo && (
              <>
                <ModernButton
                  variant="primary"
                  onClick={handleGenerateCommissionInvoice}
                  leftIcon={<Receipt className="h-4 w-4" />}
                >
                  Komisyon Faturası
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={handleGenerateRevenueInvoice}
                  leftIcon={<Receipt className="h-4 w-4" />}
                >
                  Gelir Faturası
                </ModernButton>
              </>
            )}
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value as "csv" | "json" | "pdf" | "excel")}
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
                {t("revenue.totalRevenue")}
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
          <div style={{ height: '300px', minHeight: '300px', minWidth: 0 }}>
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
          <div style={{ height: '300px', minHeight: '300px', minWidth: 0 }}>
            {storageUsageQuery.isLoading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)' }}>Yükleniyor...</p>
              </div>
            ) : (
              <OccupancyBarChart 
                data={occupancyData} 
                onBarClick={(data) => {
                  const storage = storageUsageQuery.data?.find(s => s.storage_id === data.storage_id);
                  if (storage) {
                    setSelectedStorage(storage);
                  }
                }}
              />
            )}
          </div>
        </ModernCard>
      </div>

      {/* Depo Detay Modal */}
      {selectedStorage && (
        <Modal
          isOpen={!!selectedStorage}
          onClose={() => setSelectedStorage(null)}
          title="Depo Detayları"
        >
          <div style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0' }}>Depo Kodu</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>{selectedStorage.storage_code}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0' }}>Lokasyon</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>{selectedStorage.location_name}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0' }}>Tenant</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>{selectedStorage.tenant_name}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0' }}>Doluluk Oranı</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0, color: selectedStorage.occupancy_rate >= 50 ? '#EF4444' : '#10B981' }}>
                  %{selectedStorage.occupancy_rate.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0' }}>Rezervasyon Sayısı</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>{selectedStorage.reservations}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-1) 0' }}>{t("revenue.totalRevenue")}</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>{formatCurrency(selectedStorage.total_revenue_minor)}</p>
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
              <ModernButton
                variant="secondary"
                onClick={() => setSelectedStorage(null)}
              >
                Kapat
              </ModernButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

