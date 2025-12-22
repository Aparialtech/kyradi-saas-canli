import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Filter, Loader2, AlertCircle, CheckCircle2, XCircle, Clock, CreditCard } from "../../../lib/lucide";
import { useTranslation } from "../../../hooks/useTranslation";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { DateField } from "../../../components/ui/DateField";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";

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

export function AdminSettlementsPage() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const settlementsQuery = useQuery({
    queryKey: ["admin", "settlements", selectedTenantId, statusFilter, dateFrom, dateTo],
    queryFn: async (): Promise<Settlement[]> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const response = await http.get<Settlement[]>("/admin/settlements", { params });
      return response.data;
    },
  });

  const tenantsById = new Map(
    tenantsQuery.data?.map((tenant) => [tenant.id, tenant]) ?? []
  );

  // Filter settlements by search term
  const filteredSettlements = useMemo(() => {
    const settlements = settlementsQuery.data ?? [];
    if (!searchTerm.trim()) return settlements;
    
    const term = searchTerm.toLowerCase();
    return settlements.filter((settlement) => {
      const tenant = tenantsById.get(settlement.tenant_id);
      const tenantName = (tenant?.name ?? "").toLowerCase();
      const paymentId = settlement.payment_id.toLowerCase();
      const amount = (settlement.total_amount_minor / 100).toString();
      
      return tenantName.includes(term) || paymentId.includes(term) || amount.includes(term);
    });
  }, [settlementsQuery.data, searchTerm, tenantsById]);

  // Paginate filtered data
  const paginatedSettlements = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredSettlements.slice(start, end);
  }, [filteredSettlements, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredSettlements.length, page, pageSize);
  }, [filteredSettlements.length, page, pageSize]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, [setPage]);

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
          {t("nav.globalSettlements")}
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          {t("common.allHotels" as any)} hakediş kayıtları ve detayları
        </p>
      </motion.div>

      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Filter className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
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
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              Durum
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="">Tüm Durumlar</option>
              <option value="pending">Beklemede</option>
              <option value="settled">Ödendi</option>
              <option value="cancelled">İptal</option>
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

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              Hakediş Kayıtları
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {filteredSettlements.length} / {settlementsQuery.data?.length ?? 0} kayıt gösteriliyor
            </p>
          </div>
          <div style={{ minWidth: "250px", flex: '1', maxWidth: '400px' }}>
            <ModernInput
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Otel adı, payment ID veya tutar ile ara..."
              leftIcon={<Search className="h-4 w-4" />}
              fullWidth
            />
          </div>
        </div>
        {settlementsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Veriler yükleniyor...</p>
          </div>
        ) : filteredSettlements.length > 0 ? (
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
                  return (
                    <div>
                      <strong>{tenant?.name ?? `Bilinmeyen ${t("common.hotel")}`}</strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                        #{row.tenant_id.slice(0, 8)}
                      </div>
                    </div>
                  );
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
              {
                key: 'status',
                label: 'Durum',
                render: (value) => {
                  const statusConfig = {
                    settled: { icon: CheckCircle2, color: '#16a34a', bg: 'rgba(34, 197, 94, 0.1)' },
                    cancelled: { icon: XCircle, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
                    pending: { icon: Clock, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                  };
                  const config = statusConfig[value as keyof typeof statusConfig] || statusConfig.pending;
                  const Icon = config.icon;
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        background: config.bg,
                        color: config.color,
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--font-medium)',
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {value === "settled" ? "Ödendi" : value === "pending" ? "Beklemede" : "İptal"}
                    </span>
                  );
                },
                align: 'center',
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
            <CreditCard className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              Hakediş kaydı bulunamadı
            </h3>
            <p style={{ margin: 0 }}>Seçili filtrelerle eşleşen hakediş kaydı bulunamadı. Filtreleri değiştirerek tekrar deneyin.</p>
          </div>
        )}
      </ModernCard>

      {settlementsQuery.isError && (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
              Hakediş verileri alınamadı
            </h3>
            <p style={{ margin: 0 }}>Lütfen daha sonra tekrar deneyin veya filtreleri değiştirin.</p>
          </div>
        </ModernCard>
      )}
    </div>
  );
}

