import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, BarChart3, Building2, FileText, AlertCircle, Loader2 } from "../../../lib/lucide";
import { useTranslation } from "../../../hooks/useTranslation";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";

interface RevenueSummary {
  total_revenue_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  transaction_count: number;
}

interface Settlement {
  id: string;
  tenant_id: string;
  payment_id: string;
  reservation_id: string;
  total_amount_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  currency: string;
  status: string;
  commission_rate: number;
  created_at: string;
  settled_at?: string;
}

export function AdminRevenuePage() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const revenueQuery = useQuery({
    queryKey: ["admin", "revenue", selectedTenantId, dateFrom, dateTo],
    queryFn: async (): Promise<RevenueSummary> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const response = await http.get<RevenueSummary>("/admin/revenue/summary", { params });
      return response.data;
    },
    enabled: true, // Always enabled
  });

  // Fetch settlement details for the list
  const settlementsQuery = useQuery({
    queryKey: ["admin", "settlements", selectedTenantId, dateFrom, dateTo],
    queryFn: async (): Promise<Settlement[]> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      params.status = "settled"; // Only show settled payments
      const response = await http.get<Settlement[]>("/admin/settlements", { params });
      return response.data;
    },
    enabled: true, // Always enabled
  });

  const tenantsById = new Map(
    tenantsQuery.data?.map((tenant) => [tenant.id, tenant]) ?? []
  );

  // Paginate settlements data
  const allSettlements = settlementsQuery.data ?? [];
  
  const paginatedSettlements = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return allSettlements.slice(start, end);
  }, [allSettlements, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(allSettlements.length, page, pageSize);
  }, [allSettlements.length, page, pageSize]);

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
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
          {t("nav.globalRevenue")}
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          {t("common.allHotels" as any)} gelir özeti ve detaylı hakediş kayıtları
        </p>
      </motion.div>

      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <BarChart3 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
              Filtreler
            </h3>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              {t("common.hotel")} Seç
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              <option value="">{t("common.allHotels" as any)}</option>
              {tenantsQuery.data?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <ModernInput
            type="date"
            label="Başlangıç Tarihi"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            leftIcon={<FileText className="h-4 w-4" />}
            fullWidth
          />
          <ModernInput
            type="date"
            label="Bitiş Tarihi"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            leftIcon={<FileText className="h-4 w-4" />}
            fullWidth
          />
        </div>
      </ModernCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)", marginBottom: 'var(--space-6)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  Toplam Ciro
                </p>
                <DollarSign className="h-5 w-5" style={{ color: '#16a34a' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: '0 0 var(--space-1) 0' }}>
                {revenueQuery.isLoading
                  ? "..."
                  : formatCurrency(revenueQuery.data?.total_revenue_minor ?? 0)}
              </p>
              {revenueQuery.data && revenueQuery.data.total_revenue_minor === 0 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0 0' }}>
                  Seçili filtreler için veri bulunamadı
                </p>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                Seçili filtreler için toplam gelir
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.1) 0%, rgba(29, 78, 216, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(29, 78, 216, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  Otel Hakedişi
                </p>
                <Building2 className="h-5 w-5" style={{ color: '#1d4ed8' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#1d4ed8', margin: '0 0 var(--space-1) 0' }}>
                {revenueQuery.isLoading
                  ? "..."
                  : formatCurrency(revenueQuery.data?.tenant_settlement_minor ?? 0)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                Tenant'lara ödenecek toplam tutar
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  Kyradi Komisyonu
                </p>
                <TrendingUp className="h-5 w-5" style={{ color: '#dc2626' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#dc2626', margin: '0 0 var(--space-1) 0' }}>
                {revenueQuery.isLoading
                  ? "..."
                  : formatCurrency(revenueQuery.data?.kyradi_commission_minor ?? 0)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                Platform komisyon geliri
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  İşlem Sayısı
                </p>
                <BarChart3 className="h-5 w-5" style={{ color: '#6366f1' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#6366f1', margin: '0 0 var(--space-1) 0' }}>
                {revenueQuery.data?.transaction_count ?? 0}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                Tamamlanan ödeme işlemi sayısı
              </p>
            </div>
          </ModernCard>
        </motion.div>
      </div>

      {revenueQuery.isError && (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
              Gelir verileri alınamadı
            </h3>
            <p style={{ margin: 0 }}>Lütfen daha sonra tekrar deneyin veya filtreleri değiştirin.</p>
          </div>
        </ModernCard>
      )}
      
      {!revenueQuery.isLoading && !revenueQuery.isError && revenueQuery.data && revenueQuery.data.transaction_count === 0 && (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <BarChart3 className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              Henüz gelir kaydı yok
            </h3>
            <p style={{ margin: 0 }}>Seçili tarih aralığında henüz ödeme işlemi gerçekleşmemiş.</p>
          </div>
        </ModernCard>
      )}

      {/* Detaylı İşlem Listesi */}
      {!revenueQuery.isLoading && !revenueQuery.isError && revenueQuery.data && revenueQuery.data.transaction_count > 0 && (
        <ModernCard variant="glass" padding="lg" style={{ marginTop: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              İşlem Detayları
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {settlementsQuery.data?.length ?? 0} işlem gösteriliyor
            </p>
          </div>
          {settlementsQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>İşlemler yükleniyor...</p>
            </div>
          ) : settlementsQuery.data && settlementsQuery.data.length > 0 ? (
            <ModernTable
              columns={[
                {
                  key: 'created_at',
                  label: 'Tarih',
                  render: (value) => new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
                },
                {
                  key: 'tenant_id',
                  label: t("common.hotel"),
                  render: (_, row) => {
                    const tenant = tenantsById.get(row.tenant_id);
                    return tenant?.name ?? `Bilinmeyen ${t("common.hotel")}`;
                  },
                },
                {
                  key: 'payment_id',
                  label: 'Payment ID',
                  render: (value) => (
                    <code style={{ fontSize: "var(--text-xs)", background: "var(--bg-tertiary)", padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)", fontFamily: 'monospace' }}>
                      {value.slice(0, 8)}...
                    </code>
                  ),
                },
                {
                  key: 'total_amount_minor',
                  label: 'Toplam Tutar',
                  render: (value) => <strong>{formatCurrency(value)}</strong>,
                  align: 'right',
                },
                {
                  key: 'tenant_settlement_minor',
                  label: 'Otel Payı',
                  render: (value) => <span style={{ color: "#1d4ed8", fontWeight: 'var(--font-semibold)' }}>{formatCurrency(value)}</span>,
                  align: 'right',
                },
                {
                  key: 'kyradi_commission_minor',
                  label: 'Kyradi Komisyonu',
                  render: (value) => <span style={{ color: "#dc2626", fontWeight: 'var(--font-semibold)' }}>{formatCurrency(value)}</span>,
                  align: 'right',
                },
              ] as ModernTableColumn<Settlement>[]}
              data={paginatedSettlements}
              loading={settlementsQuery.isLoading}
              striped
              hoverable
              stickyHeader
              showRowNumbers
              pagination={paginationMeta}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <FileText className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
                İşlem bulunamadı
              </h3>
              <p style={{ margin: 0 }}>Seçili filtrelerle eşleşen işlem bulunamadı.</p>
            </div>
          )}
        </ModernCard>
      )}
    </div>
  );
}
