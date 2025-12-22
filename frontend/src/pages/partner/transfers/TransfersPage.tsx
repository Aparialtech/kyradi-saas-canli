import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Send,
  Clock,
  Loader2,
  CreditCard,
  RefreshCw,
  Zap,
  Info,
  ArrowRight,
  CheckCircle,
  Eye,
  XCircle,
  User,
  Search,
  Filter,
  X,
  Download,
} from "../../../lib/lucide";

import {
  paymentScheduleService,
  type PaymentTransfer,
  type TransferStatus,
} from "../../../services/partner/paymentSchedules";
import { useToast } from "../../../hooks/useToast";
import { usePagination, Pagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { getErrorMessage } from "../../../lib/httpError";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { ModernInput } from "../../../components/ui/ModernInput";
import { Badge } from "../../../components/ui/Badge";
import { DateField } from "../../../components/ui/DateField";

import styles from "./TransfersPage.module.css";

const statusConfig: Record<string, { label: string; color: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending: { label: "Beklemede", color: "warning" },
  processing: { label: "İşleniyor", color: "info" },
  completed: { label: "Onaylandı", color: "success" },
  failed: { label: "Başarısız", color: "danger" },
  cancelled: { label: "İptal Edildi", color: "neutral" },
};

export function TransfersPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<PaymentTransfer | null>(null);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

  // Queries
  const commissionQuery = useQuery({
    queryKey: ["commission-summary"],
    queryFn: () => paymentScheduleService.getCommissionSummary(),
  });

  const transfersQuery = useQuery({
    queryKey: ["payment-transfers", statusFilter, page, pageSize],
    queryFn: () =>
      paymentScheduleService.listMyTransfers({
        status: statusFilter || undefined,
        page,
        pageSize,
      }),
  });

  // Mutations
  const requestMutation = useMutation({
    mutationFn: (payload: { gross_amount: number; notes?: string }) =>
      paymentScheduleService.requestTransfer(payload),
    onSuccess: () => {
      push({ type: "success", title: "Başarılı", description: "Komisyon ödeme talebi oluşturuldu." });
      queryClient.invalidateQueries({ queryKey: ["payment-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["payment-balance"] });
      queryClient.invalidateQueries({ queryKey: ["commission-summary"] });
      setShowRequestModal(false);
      setRequestAmount("");
      setRequestNotes("");
    },
    onError: (error) => {
      push({ type: "error", title: "Hata", description: getErrorMessage(error) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (transferId: string) =>
      paymentScheduleService.cancelTransfer(transferId),
    onSuccess: () => {
      push({ type: "success", title: "Başarılı", description: "Transfer iptal edildi." });
      queryClient.invalidateQueries({ queryKey: ["payment-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["commission-summary"] });
      setShowDetailModal(false);
      setSelectedTransfer(null);
    },
    onError: (error) => {
      push({ type: "error", title: "Hata", description: getErrorMessage(error) });
    },
  });

  const handleRequestTransfer = useCallback(() => {
    const normalizedAmount = requestAmount.replace(",", ".");
    const amount = parseFloat(normalizedAmount);
    if (isNaN(amount) || amount <= 0) {
      push({ type: "error", title: "Hata", description: "Geçerli bir tutar girin." });
      return;
    }
    requestMutation.mutate({
      gross_amount: amount,
      notes: requestNotes || undefined,
    });
  }, [requestAmount, requestNotes, requestMutation, push]);

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null || isNaN(amount)) return "₺0,00";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const rawTransfers = transfersQuery.data?.data || [];
  
  // Filter transfers by search term and date range
  const transfers = useMemo(() => {
    let filtered = rawTransfers;
    
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((t) => {
        if (!t) return false;
        const amount = (t.gross_amount || 0).toString();
        const notes = (t.notes || "").toLowerCase();
        const refId = (t.reference_id || "").toLowerCase();
        const id = (t.id || "").toLowerCase();
        return amount.includes(term) || notes.includes(term) || refId.includes(term) || id.includes(term);
      });
    }
    
    // Date from filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((t) => {
        if (!t?.created_at) return false;
        return new Date(t.created_at) >= fromDate;
      });
    }
    
    // Date to filter
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => {
        if (!t?.created_at) return false;
        return new Date(t.created_at) <= toDate;
      });
    }
    
    return filtered;
  }, [rawTransfers, searchTerm, dateFrom, dateTo]);
  
  const paginationMeta = useMemo(() => {
    if (!transfersQuery.data?.meta) return calculatePaginationMeta(transfers.length, page, pageSize);
    return {
      total: transfers.length,
      page: transfersQuery.data.meta.page || 1,
      pageSize: transfersQuery.data.meta.pageSize || 10,
      totalPages: Math.ceil(transfers.length / pageSize) || 1,
    };
  }, [transfersQuery.data?.meta, transfers.length, page, pageSize]);

  // Stats
  const stats = useMemo(() => {
    const validTransfers = transfers.filter((t) => t != null);
    return {
      totalSent: validTransfers.reduce((sum, t) => sum + (t?.gross_amount || 0), 0),
      pending: validTransfers.filter((t) => t?.status === "pending").reduce((sum, t) => sum + (t?.gross_amount || 0), 0),
      completed: validTransfers.filter((t) => t?.status === "completed").reduce((sum, t) => sum + (t?.gross_amount || 0), 0),
      count: validTransfers.length,
    };
  }, [transfers]);

  const columns: ModernTableColumn<PaymentTransfer>[] = [
    {
      key: "created_at",
      label: "Tarih",
      render: (_value: unknown, row: PaymentTransfer) => (
        <span style={{ fontSize: "0.875rem" }}>{row ? formatDate(row.created_at) : "-"}</span>
      ),
    },
    {
      key: "gross_amount",
      label: "Tutar",
      render: (_value: unknown, row: PaymentTransfer) => (
        <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>
          {row ? formatCurrency(row.gross_amount) : "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      render: (_value: unknown, row: PaymentTransfer) => {
        if (!row) return <Badge variant="neutral">-</Badge>;
        const config = statusConfig[row.status] || { label: row.status || "Bilinmiyor", color: "neutral" as const };
        return <Badge variant={config.color}>{config.label}</Badge>;
      },
    },
    {
      key: "notes",
      label: "Not",
      render: (_value: unknown, row: PaymentTransfer) => (
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          {row?.notes || "-"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "İşlemler",
      render: (_value: unknown, row: PaymentTransfer) => {
        if (!row) return null;
        const isPending = row.status === "pending";
        return (
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTransfer(row);
                setShowDetailModal(true);
              }}
              leftIcon={<Eye className="h-4 w-4" />}
            >
              Detay
            </ModernButton>
            {isPending && (
              <ModernButton
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelMutation.mutate(row.id);
                }}
                leftIcon={<XCircle className="h-4 w-4" />}
              >
                İptal
              </ModernButton>
            )}
          </div>
        );
      },
    },
  ];

  const commission = commissionQuery.data;

  return (
    <div className={styles.container}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.header}
      >
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>Komisyon Ödemeleri</h1>
            <p className={styles.subtitle}>Kyradi'ye borçlu olduğunuz komisyonları ödeyin ve takip edin</p>
          </div>
          <div className={styles.headerActions}>
            <Badge variant="info">
              <Zap className="h-3 w-3" style={{ marginRight: 4 }} />
              MagicPay Demo
            </Badge>
            <ModernButton
              variant="primary"
              size="lg"
              onClick={() => setShowRequestModal(true)}
              leftIcon={<Send className="h-5 w-5" />}
            >
              Komisyon Öde
            </ModernButton>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={styles.statsGrid}
      >
        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}>
              <DollarSign className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Kalan Borç</p>
              <p className={styles.statValue} style={{ color: "#dc2626" }}>
                {formatCurrency(commission?.available_commission || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <Clock className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Onay Bekleyen</p>
              <p className={styles.statValue} style={{ color: "#d97706" }}>
                {formatCurrency(stats.pending)}
              </p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
              <CheckCircle className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Onaylanan</p>
              <p className={styles.statValue} style={{ color: "#059669" }}>
                {formatCurrency(stats.completed)}
              </p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
              <CreditCard className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Toplam Gönderim</p>
              <p className={styles.statValue} style={{ color: "#4f46e5" }}>
                {stats.count} işlem
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Demo Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={styles.infoBox}
      >
        <Info className="h-5 w-5" style={{ color: "#6366f1", flexShrink: 0 }} />
        <p>
          <strong style={{ color: "#6366f1" }}>Demo Modu:</strong> Komisyon ödemeleri şu anda demo modunda çalışmaktadır. 
          Gönderdiğiniz ödemeler admin panelde görünecek ve onaylanması gerekecektir.
        </p>
      </motion.div>

      {/* Transfers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className={styles.tableHeader}>
              <div>
                <h2 className={styles.tableTitle}>Ödeme Geçmişi</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  {transfers.length} / {rawTransfers.length} kayıt gösteriliyor
                </p>
              </div>
              <div className={styles.tableActions}>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  leftIcon={<Filter className="h-4 w-4" />}
                >
                  {showFilters ? "Filtreleri Gizle" : "Filtreler"}
                </ModernButton>
                {transfers.length > 0 && (
                  <ModernButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!transfers.length) return;
                      const headers = ["Tarih", "Tutar (TL)", "Durum", "Not", "Referans No"];
                      const rows = transfers.filter(t => t).map((t) => [
                        formatDate(t.created_at),
                        (t.gross_amount || 0).toFixed(2),
                        statusConfig[t.status]?.label || t.status,
                        t.notes || "-",
                        t.reference_id || "-",
                      ]);
                      const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
                      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `komisyon_odemeleri_${new Date().toISOString().split("T")[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    leftIcon={<Download className="h-4 w-4" />}
                  >
                    CSV
                  </ModernButton>
                )}
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => transfersQuery.refetch()}
                  leftIcon={<RefreshCw className={`h-4 w-4 ${transfersQuery.isFetching ? "animate-spin" : ""}`} />}
                >
                  Yenile
                </ModernButton>
              </div>
            </div>
            
            {/* Search and Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ 
                    marginTop: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-4)'
                  }}>
                    {/* Search Row */}
                    <div style={{ position: 'relative' }}>
                      <Search 
                        className="h-4 w-4" 
                        style={{ 
                          position: 'absolute', 
                          left: '12px', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          color: 'var(--text-tertiary)'
                        }} 
                      />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tutar, not veya referans no ile ara..."
                        style={{
                          width: '100%',
                          padding: '10px 36px 10px 40px',
                          borderRadius: 'var(--radius-lg)',
                          border: '1.5px solid var(--border-primary)',
                          background: 'var(--bg-primary)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Filter Grid */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                      gap: 'var(--space-4)',
                      alignItems: 'end'
                    }}>
                      {/* Status Filter */}
                      <div>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: 'var(--space-2)', 
                          fontSize: 'var(--text-sm)', 
                          fontWeight: 500,
                          color: 'var(--text-secondary)'
                        }}>
                          Durum
                        </label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as TransferStatus | "")}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            height: '42px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1.5px solid var(--border-primary)',
                            background: 'var(--bg-primary)',
                            fontSize: 'var(--text-sm)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">Tüm Durumlar</option>
                          <option value="pending">Beklemede</option>
                          <option value="processing">İşleniyor</option>
                          <option value="completed">Onaylandı</option>
                          <option value="failed">Başarısız</option>
                          <option value="cancelled">İptal Edildi</option>
                        </select>
                      </div>
                      
                      {/* Date From */}
                      <DateField
                        label="Başlangıç Tarihi"
                        value={dateFrom}
                        onChange={(value) => setDateFrom(value || "")}
                        fullWidth
                      />
                      
                      {/* Date To */}
                      <DateField
                        label="Bitiş Tarihi"
                        value={dateTo}
                        onChange={(value) => setDateTo(value || "")}
                        fullWidth
                      />
                      
                      {/* Clear Filters */}
                      {(searchTerm || statusFilter || dateFrom || dateTo) && (
                        <ModernButton
                          variant="ghost"
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("");
                            setDateFrom("");
                            setDateTo("");
                          }}
                          leftIcon={<X className="h-4 w-4" />}
                          style={{ height: '42px' }}
                        >
                          Temizle
                        </ModernButton>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
          <CardBody noPadding>
            {transfersQuery.isLoading ? (
              <div className={styles.emptyState}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--color-primary)" }} />
                <p>Yükleniyor...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className={styles.emptyState}>
                <Send className="h-12 w-12" style={{ color: "var(--text-tertiary)" }} />
                <p>Henüz komisyon ödemesi bulunmuyor</p>
                <ModernButton
                  variant="primary"
                  onClick={() => setShowRequestModal(true)}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  İlk Ödemenizi Yapın
                </ModernButton>
              </div>
            ) : (
              <>
                <ModernTable
                  columns={columns}
                  data={transfers.filter(t => t != null)}
                  showRowNumbers
                  pagination={paginationMeta}
                  onRowClick={(row) => {
                    setSelectedTransfer(row);
                    setShowDetailModal(true);
                  }}
                  hoverable
                />
                <div className={styles.paginationWrapper}>
                  <Pagination
                    meta={paginationMeta}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
            onClick={() => setShowRequestModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={styles.modal}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalIcon} style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" }}>
                  <Send className="h-6 w-6" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 className={styles.modalTitle}>Komisyon Öde</h3>
                  <p className={styles.modalSubtitle}>Kyradi'ye komisyon ödemesi yapın</p>
                </div>
              </div>

              {/* Remaining Balance */}
              <div className={styles.balanceBox}>
                <p className={styles.balanceLabel}>Kalan Borç</p>
                <p className={styles.balanceValue}>
                  {formatCurrency(commission?.available_commission || 0)}
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Ödeme Tutarı (TL) *</label>
                <ModernInput
                  type="text"
                  placeholder="Örn: 100,00"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Not (Opsiyonel)</label>
                <textarea
                  placeholder="Ödeme ile ilgili notunuz..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className={styles.textarea}
                />
              </div>

              {/* Demo Info */}
              <div className={styles.demoInfo}>
                <Zap className="h-4 w-4" style={{ color: "#6366f1" }} />
                <span>Demo modunda ödeme simüle edilecektir</span>
              </div>

              <div className={styles.modalActions}>
                <ModernButton variant="ghost" onClick={() => setShowRequestModal(false)}>
                  İptal
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={handleRequestTransfer}
                  isLoading={requestMutation.isPending}
                  disabled={!requestAmount || parseFloat(requestAmount.replace(",", ".")) <= 0}
                  leftIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Ödemeyi Gönder
                </ModernButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={styles.modal}
            >
              <div className={styles.detailHeader}>
                <h3 className={styles.modalTitle}>Ödeme Detayı</h3>
                <Badge variant={statusConfig[selectedTransfer.status]?.color || "neutral"}>
                  {statusConfig[selectedTransfer.status]?.label || selectedTransfer.status}
                </Badge>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Tutar</span>
                  <span className={styles.detailValue} style={{ color: "#dc2626", fontWeight: 600 }}>
                    {formatCurrency(selectedTransfer.gross_amount)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Gönderim Tarihi</span>
                  <span>{formatDate(selectedTransfer.created_at)}</span>
                </div>
                {selectedTransfer.requested_by_id && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>
                      <User className="h-3 w-3" style={{ display: "inline", marginRight: 4 }} />
                      Gönderen
                    </span>
                    <span>{selectedTransfer.requested_by_id.substring(0, 8)}...</span>
                  </div>
                )}
                {selectedTransfer.transfer_date && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Onay Tarihi</span>
                    <span>{formatDate(selectedTransfer.transfer_date)}</span>
                  </div>
                )}
                {selectedTransfer.reference_id && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Referans No</span>
                    <span style={{ fontFamily: "monospace" }}>{selectedTransfer.reference_id}</span>
                  </div>
                )}
                {selectedTransfer.notes && (
                  <div className={styles.detailRowFull}>
                    <span className={styles.detailLabel}>Not</span>
                    <span>{selectedTransfer.notes}</span>
                  </div>
                )}
                {selectedTransfer.error_message && (
                  <div className={styles.detailRowFull} style={{ background: "#fef2f2", padding: "0.75rem", borderRadius: "0.5rem" }}>
                    <span className={styles.detailLabel} style={{ color: "#dc2626" }}>İptal/Red Sebebi</span>
                    <span style={{ color: "#dc2626" }}>{selectedTransfer.error_message}</span>
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                {selectedTransfer.status === "pending" && (
                  <ModernButton
                    variant="danger"
                    onClick={() => cancelMutation.mutate(selectedTransfer.id)}
                    isLoading={cancelMutation.isPending}
                    leftIcon={<XCircle className="h-4 w-4" />}
                  >
                    İptal Et
                  </ModernButton>
                )}
                <ModernButton variant="ghost" onClick={() => setShowDetailModal(false)}>
                  Kapat
                </ModernButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
