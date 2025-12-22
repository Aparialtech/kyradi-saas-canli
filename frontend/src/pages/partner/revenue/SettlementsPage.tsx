import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Filter, DollarSign, CreditCard, TrendingUp, FileText, Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Download } from "../../../lib/lucide";
import { revenueService } from "../../../services/partner/revenue";
import { locationService } from "../../../services/partner/locations";
import { storageService } from "../../../services/partner/storages";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { DateField } from "../../../components/ui/DateField";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";

export function SettlementsPage() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [storageId, setStorageId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list(),
  });

  const storagesQuery = useQuery({
    queryKey: ["storages"],
    queryFn: () => storageService.list(),
  });
  
  // Filter storages by location
  const filteredStorages = useMemo(() => {
    if (!locationId) return storagesQuery.data || [];
    return (storagesQuery.data || []).filter(s => s.location_id === locationId);
  }, [storagesQuery.data, locationId]);

  const settlementsQuery = useQuery({
    queryKey: ["settlements", statusFilter, dateFrom, dateTo, locationId, storageId, searchTerm],
    queryFn: () => revenueService.listSettlements(statusFilter, dateFrom, dateTo, locationId, storageId, searchTerm),
  });

  // Get data from the new response format
  const settlements = useMemo(() => {
    return settlementsQuery.data?.items ?? [];
  }, [settlementsQuery.data]);

  const totals = useMemo(() => {
    return {
      count: settlementsQuery.data?.total_count ?? 0,
      income: settlementsQuery.data?.total_income ?? 0,
      commission: settlementsQuery.data?.total_commission ?? 0,
      payout: settlementsQuery.data?.total_payout ?? 0,
    };
  }, [settlementsQuery.data]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("tr-TR");
  };

  const statusLabels: Record<string, string> = {
    pending: "Beklemede",
    settled: "Mutabakat",
    cancelled: "İptal",
  };

  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  // Paginate data
  const paginatedSettlements = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return settlements.slice(start, end);
  }, [settlements, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(settlements.length, page, pageSize);
  }, [settlements.length, page, pageSize]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!settlements.length) return;

    const headers = ["Tarih", "Payment ID", "Toplam Tutar (TRY)", "Otel Hakedişi (TRY)", "Komisyon (TRY)", "Oran (%)", "Durum"];
    
    const rows = settlements.map((s) => [
      formatDate(s.settled_at || s.created_at),
      s.payment_id,
      (s.total_amount_minor / 100).toFixed(2),
      (s.tenant_settlement_minor / 100).toFixed(2),
      (s.kyradi_commission_minor / 100).toFixed(2),
      s.commission_rate.toString(),
      statusLabels[s.status] || s.status,
    ]);

    const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    
    // Add BOM for Excel UTF-8 support
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.download = `hakedis_raporu_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [settlements]);

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
            {t("nav.settlements")}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            Tüm hakediş kayıtlarını görüntüleyin ve filtreleyin.
          </p>
        </div>
        {settlements.length > 0 && (
          <ModernButton
            variant="outline"
            onClick={handleExportCSV}
            leftIcon={<Download className="h-4 w-4" />}
          >
            CSV İndir
          </ModernButton>
        )}
      </motion.div>

      {/* Summary Cards */}
      {!settlementsQuery.isLoading && !settlementsQuery.isError && settlements.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ModernCard variant="glass" padding="lg" hoverable>
              <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontWeight: 'var(--font-medium)', margin: 0 }}>
                    Toplam Gelir
                  </p>
                  <DollarSign className="h-5 w-5" style={{ color: '#16a34a' }} />
                </div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "#16a34a", marginBottom: 'var(--space-1)' }}>
                  {formatCurrency(totals.income)}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                  {totals.count} işlem
                </div>
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
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontWeight: 'var(--font-medium)', margin: 0 }}>
                    Otel Hakedişi
                  </p>
                  <CreditCard className="h-5 w-5" style={{ color: '#1d4ed8' }} />
                </div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "#1d4ed8", marginBottom: 'var(--space-1)' }}>
                  {formatCurrency(totals.payout)}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                  Net ödeme tutarı
                </div>
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
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontWeight: 'var(--font-medium)', margin: 0 }}>
                    Komisyon
                  </p>
                  <TrendingUp className="h-5 w-5" style={{ color: '#dc2626' }} />
                </div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "#dc2626", marginBottom: 'var(--space-1)' }}>
                  {formatCurrency(totals.commission)}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                  Platform komisyonu
                </div>
              </div>
            </ModernCard>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Filter className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
              Filtreler
            </h3>
          </div>
        </div>
        
        {/* Search Row */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ModernInput
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ID veya tutar ile ara..."
            leftIcon={<Search className="h-4 w-4" />}
            fullWidth
          />
        </div>

        {/* Filter Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
          gap: "var(--space-4)",
          alignItems: "end"
        }}>
          {/* Status Filter */}
          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "var(--space-2)", 
              fontWeight: 500, 
              fontSize: "var(--text-sm)", 
              color: 'var(--text-secondary)' 
            }}>
              {t("common.status")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                height: "42px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              <option value="">{t("common.all")}</option>
              <option value="pending">Beklemede</option>
              <option value="settled">Mutabakat</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "var(--space-2)", 
              fontWeight: 500, 
              fontSize: "var(--text-sm)", 
              color: 'var(--text-secondary)' 
            }}>
              Lokasyon
            </label>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setStorageId("");
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                height: "42px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
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

          {/* Storage Filter */}
          <div>
            <label style={{ 
              display: "block", 
              marginBottom: "var(--space-2)", 
              fontWeight: 500, 
              fontSize: "var(--text-sm)", 
              color: 'var(--text-secondary)' 
            }}>
              Depo
            </label>
            <select
              value={storageId}
              onChange={(e) => setStorageId(e.target.value)}
              disabled={!locationId}
              style={{
                width: "100%",
                padding: "10px 12px",
                height: "42px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: locationId ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                opacity: locationId ? 1 : 0.5,
                cursor: locationId ? "pointer" : "not-allowed",
              }}
            >
              <option value="">Tümü</option>
              {filteredStorages.map((storage) => (
                <option key={storage.id} value={storage.id}>
                  {storage.code}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <DateField
            label={t("common.from")}
            value={dateFrom}
            onChange={(value) => setDateFrom(value || "")}
            fullWidth
          />

          {/* Date To */}
          <DateField
            label={t("common.to")}
            value={dateTo}
            onChange={(value) => setDateTo(value || "")}
            fullWidth
          />
        </div>
      </ModernCard>

      {/* Settlements table */}
      {settlementsQuery.isLoading ? (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>{t("common.loading")}</h3>
            <p style={{ margin: 0 }}>Hakediş verileri yükleniyor...</p>
          </div>
        </ModernCard>
      ) : settlementsQuery.isError ? (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>{t("common.error")}</h3>
            <p style={{ color: "#dc2626", marginBottom: 'var(--space-4)' }}>Hakedişler yüklenemedi. Lütfen sayfayı yenileyin.</p>
            <ModernButton
              variant="primary"
              onClick={() => settlementsQuery.refetch()}
            >
              Tekrar Dene
            </ModernButton>
          </div>
        </ModernCard>
      ) : settlements.length > 0 ? (
        <ModernCard variant="glass" padding="lg">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              Hakediş Kayıtları
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {totals.count} kayıt bulundu
            </p>
          </div>
          <ModernTable
            columns={[
              {
                key: 'date',
                label: 'Tarih',
                render: (_, row) => formatDate(row.settled_at || row.created_at),
              },
              {
                key: 'payment_id',
                label: 'Payment ID',
                render: (_, row) => (
                  <code style={{ fontSize: "var(--text-xs)", background: "var(--bg-tertiary)", padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)", fontFamily: 'monospace' }}>
                    {row.payment_id.slice(0, 8)}...
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
                label: 'Otel Hakedişi',
                render: (value) => <span style={{ color: "#1d4ed8", fontWeight: 'var(--font-semibold)' }}>{formatCurrency(value)}</span>,
                align: 'right',
              },
              {
                key: 'kyradi_commission_minor',
                label: 'Komisyon',
                render: (value) => <span style={{ color: "#dc2626", fontWeight: 'var(--font-semibold)' }}>{formatCurrency(value)}</span>,
                align: 'right',
              },
              {
                key: 'commission_rate',
                label: 'Oran',
                render: (value) => `%${value}`,
                align: 'center',
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
                      {statusLabels[value] || value}
                    </span>
                  );
                },
                align: 'center',
              },
            ] as ModernTableColumn<typeof settlements[0]>[]}
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
        </ModernCard>
      ) : (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <FileText className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>{t("common.noData")}</h3>
            <p style={{ margin: 0 }}>Henüz hakediş kaydı bulunmuyor veya seçili filtrelerde sonuç yok.</p>
          </div>
        </ModernCard>
      )}
    </div>
  );
}

