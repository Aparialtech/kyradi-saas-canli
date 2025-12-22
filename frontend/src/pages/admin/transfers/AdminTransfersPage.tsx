import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Send,
  Clock,
  Loader2,
  AlertCircle,
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap,
  Info,
  Eye,
  Play,
  Ban,
} from "../../../lib/lucide";

import {
  paymentScheduleService,
  type PaymentTransfer,
  type TransferStatus,
} from "../../../services/partner/paymentSchedules";
import { useToast } from "../../../hooks/useToast";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { getErrorMessage } from "../../../lib/httpError";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { Badge } from "../../../components/ui/Badge";

const statusConfig: Record<TransferStatus, { label: string; color: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending: { label: "Beklemede", color: "warning" },
  processing: { label: "İşleniyor", color: "info" },
  completed: { label: "Tamamlandı", color: "success" },
  failed: { label: "Başarısız", color: "danger" },
  cancelled: { label: "İptal", color: "neutral" },
};

export function AdminTransfersPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [selectedTransfer, setSelectedTransfer] = useState<PaymentTransfer | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Queries
  const transfersQuery = useQuery({
    queryKey: ["admin-payment-transfers", statusFilter, page, pageSize],
    queryFn: () =>
      paymentScheduleService.adminListAllTransfers({
        status: statusFilter || undefined,
        page,
        pageSize,
      }),
  });

  const magicPayStatusQuery = useQuery({
    queryKey: ["magicpay-status"],
    queryFn: () => paymentScheduleService.getMagicPayStatus(),
  });

  // Mutations
  const processMutation = useMutation({
    mutationFn: (transferId: string) =>
      paymentScheduleService.processTransferWithMagicPay(transferId),
    onSuccess: (data) => {
      push({
        type: "success",
        title: "Transfer İşlendi",
        description: `İşlem No: ${data.transaction_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-transfers"] });
      setShowProcessModal(false);
      setSelectedTransfer(null);
    },
    onError: (error) => {
      push({ type: "error", title: "Hata", description: getErrorMessage(error) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transferId, reason }: { transferId: string; reason?: string }) =>
      paymentScheduleService.rejectTransfer(transferId, reason),
    onSuccess: () => {
      push({ type: "success", title: "Başarılı", description: "Transfer reddedildi." });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-transfers"] });
      setShowRejectModal(false);
      setSelectedTransfer(null);
      setRejectReason("");
    },
    onError: (error) => {
      push({ type: "error", title: "Hata", description: getErrorMessage(error) });
    },
  });

  const handleProcess = useCallback(() => {
    if (selectedTransfer) {
      processMutation.mutate(selectedTransfer.id);
    }
  }, [selectedTransfer, processMutation]);

  const handleReject = useCallback(() => {
    if (selectedTransfer) {
      rejectMutation.mutate({
        transferId: selectedTransfer.id,
        reason: rejectReason || undefined,
      });
    }
  }, [selectedTransfer, rejectReason, rejectMutation]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const transfers = transfersQuery.data?.data || [];
  const paginationMeta = useMemo(() => {
    if (!transfersQuery.data?.meta) return calculatePaginationMeta(0, page, pageSize);
    return {
      total: transfersQuery.data.meta.total,
      page: transfersQuery.data.meta.page,
      pageSize: transfersQuery.data.meta.pageSize,
      totalPages: transfersQuery.data.meta.totalPages,
    };
  }, [transfersQuery.data?.meta, page, pageSize]);

  // Stats
  const stats = useMemo(() => {
    const allTransfers = transfers.filter((t) => t != null);
    return {
      pending: allTransfers.filter((t) => t?.status === "pending").length,
      total: allTransfers.reduce((sum, t) => sum + (t?.net_amount || 0), 0),
      completed: allTransfers.filter((t) => t?.status === "completed").reduce((sum, t) => sum + (t?.net_amount || 0), 0),
    };
  }, [transfers]);

  const columns: ModernTableColumn<PaymentTransfer>[] = [
    {
      key: "created_at",
      label: "Tarih",
      render: (row: PaymentTransfer) => (
        <span style={{ fontSize: "0.875rem" }}>{row ? formatDate(row.created_at) : "-"}</span>
      ),
    },
    {
      key: "tenant_id",
      label: "Tenant",
      render: (row: PaymentTransfer) => (
        <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
          {row?.tenant_id ? `${row.tenant_id.substring(0, 8)}...` : "-"}
        </span>
      ),
    },
    {
      key: "gross_amount",
      label: "Brüt Tutar",
      render: (row: PaymentTransfer) => row ? formatCurrency(row.gross_amount || 0) : "-",
    },
    {
      key: "commission_amount",
      label: "Komisyon",
      render: (row: PaymentTransfer) => (
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
          {row ? formatCurrency(row.commission_amount || 0) : "-"}
        </span>
      ),
    },
    {
      key: "net_amount",
      label: "Net Tutar",
      render: (row: PaymentTransfer) => (
        <span style={{ fontWeight: 600, color: "var(--color-success)" }}>
          {row ? formatCurrency(row.net_amount || 0) : "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      render: (row: PaymentTransfer) => {
        if (!row) return <Badge variant="neutral">-</Badge>;
        const config = statusConfig[row.status as keyof typeof statusConfig] || { label: row.status || "Bilinmiyor", color: "neutral" as const };
        return <Badge variant={config.color}>{config.label}</Badge>;
      },
    },
    {
      key: "bank_iban",
      label: "IBAN",
      render: (row: PaymentTransfer) => (
        <span style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
          {row?.bank_iban ? `${row.bank_iban.substring(0, 10)}...` : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "İşlemler",
      render: (row: PaymentTransfer) => {
        if (!row) return null;
        return (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {row.status === "pending" && (
              <>
                <ModernButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedTransfer(row);
                    setShowProcessModal(true);
                  }}
                  leftIcon={<Play className="h-3 w-3" />}
                >
                  İşle
                </ModernButton>
                <ModernButton
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setSelectedTransfer(row);
                    setShowRejectModal(true);
                  }}
                  leftIcon={<Ban className="h-3 w-3" />}
                >
                  Reddet
                </ModernButton>
              </>
            )}
            {row.status !== "pending" && (
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransfer(row)}
                leftIcon={<Eye className="h-3 w-3" />}
              >
                Detay
              </ModernButton>
            )}
          </div>
        );
      },
    },
  ];

  const magicPayStatus = magicPayStatusQuery.data;

  return (
    <div style={{ padding: "var(--space-6)" }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.2); }
          50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); }
        }
        .magicpay-header {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          position: relative;
          overflow: hidden;
        }
        .magicpay-header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        }
        .stat-card {
          transition: all 0.2s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Transfer Yönetimi
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
              Partner komisyon transferlerini MagicPay ile yönetin
            </p>
          </div>
        </div>
      </motion.div>

      {/* MagicPay Status */}
      {magicPayStatus && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="magicpay-header"
          style={{ marginBottom: "var(--space-6)" }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                    {magicPayStatus.gateway_name}
                  </h2>
                  <p style={{ margin: "var(--space-1) 0 0", opacity: 0.9, fontSize: "0.875rem" }}>
                    Ödeme Gateway Entegrasyonu
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: "0.75rem" }}>Durum</p>
                  <Badge variant={magicPayStatus.is_demo_mode ? "warning" : "success"}>
                    {magicPayStatus.is_demo_mode ? "Demo Mod" : "Aktif"}
                  </Badge>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: "0.75rem" }}>API Key</p>
                  <Badge variant={magicPayStatus.api_key_configured ? "success" : "neutral"}>
                    {magicPayStatus.api_key_configured ? "Yapılandırıldı" : "Yapılandırılmadı"}
                  </Badge>
                </div>
              </div>
            </div>
            
            {magicPayStatus.is_demo_mode && (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  padding: "var(--space-3)",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <Info className="h-4 w-4" />
                <span style={{ fontSize: "0.875rem" }}>
                  Demo modunda tüm transferler simüle edilir. Gerçek para transferi yapılmaz.
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="stat-card">
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <Clock
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-warning)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Bekleyen Transfer
                </p>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {stats.pending}
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="stat-card">
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <DollarSign
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-primary)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Bu Sayfa Toplamı
                </p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(stats.total)}
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="stat-card">
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <CheckCircle
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-success)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Tamamlanan
                </p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-success)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(stats.completed)}
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Transfers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CreditCard className="h-5 w-5" />
                <span>Tüm Transferler</span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as TransferStatus | "");
                    setPage(1);
                  }}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-primary)",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="pending">Beklemede</option>
                  <option value="processing">İşleniyor</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="failed">Başarısız</option>
                  <option value="cancelled">İptal</option>
                </select>
                <ModernButton
                  variant="ghost"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-payment-transfers"] })}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Yenile
                </ModernButton>
              </div>
            </div>
          </CardHeader>
          <CardBody noPadding>
            {transfersQuery.isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-8)" }}>
                <Loader2 className="h-8 w-8" style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : transfersQuery.isError ? (
              <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--color-danger)" }}>
                <AlertCircle className="h-8 w-8" style={{ margin: "0 auto var(--space-2)" }} />
                <p>Veriler yüklenirken hata oluştu.</p>
              </div>
            ) : transfers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-muted)" }}>
                <CreditCard className="h-12 w-12" style={{ margin: "0 auto var(--space-4)", opacity: 0.5 }} />
                <p style={{ margin: 0 }}>Henüz transfer talebi bulunmuyor.</p>
              </div>
            ) : (
              <ModernTable
                columns={columns}
                data={transfers}
                loading={transfersQuery.isLoading}
                striped
                hoverable
                stickyHeader
                showRowNumbers
                pagination={paginationMeta}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Process Modal */}
      <AnimatePresence>
        {showProcessModal && selectedTransfer && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "var(--space-4)",
            }}
            onClick={() => setShowProcessModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                background: "var(--bg-primary)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-6)",
                width: "100%",
                maxWidth: "450px",
                boxShadow: "var(--shadow-xl)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "var(--radius-lg)",
                    background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Zap className="h-6 w-6" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                    MagicPay ile İşle
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Transfer işlemini başlat
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <h4 style={{ margin: "0 0 var(--space-3)", fontSize: "0.875rem", fontWeight: 600 }}>
                  Transfer Detayları
                </h4>
                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Brüt Tutar:</span>
                    <span style={{ fontSize: "0.875rem" }}>{formatCurrency(selectedTransfer.gross_amount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Komisyon:</span>
                    <span style={{ fontSize: "0.875rem", color: "var(--color-danger)" }}>
                      -{formatCurrency(selectedTransfer.commission_amount)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: "var(--space-2)",
                      borderTop: "1px solid var(--border-color)",
                      fontWeight: 600,
                    }}
                  >
                    <span>Net Tutar:</span>
                    <span style={{ color: "var(--color-success)" }}>
                      {formatCurrency(selectedTransfer.net_amount)}
                    </span>
                  </div>
                </div>
                
                {selectedTransfer.bank_iban && (
                  <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-color)" }}>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>Hedef IBAN:</p>
                    <p style={{ margin: "var(--space-1) 0 0", fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {selectedTransfer.bank_iban}
                    </p>
                  </div>
                )}
              </div>

              {/* Demo Warning */}
              {magicPayStatus?.is_demo_mode && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-3)",
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "var(--space-4)",
                  }}
                >
                  <AlertCircle className="h-4 w-4" style={{ color: "#f59e0b", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.8rem", color: "#d97706" }}>
                    Demo modunda gerçek para transferi yapılmaz. İşlem simüle edilecektir.
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                <ModernButton variant="ghost" onClick={() => setShowProcessModal(false)}>
                  İptal
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={handleProcess}
                  isLoading={processMutation.isPending}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Transferi İşle
                </ModernButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedTransfer && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "var(--space-4)",
            }}
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                background: "var(--bg-primary)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-6)",
                width: "100%",
                maxWidth: "400px",
                boxShadow: "var(--shadow-xl)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-danger)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <XCircle className="h-6 w-6" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                    Transfer Reddet
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    {formatCurrency(selectedTransfer.net_amount)} tutarındaki transfer
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: "var(--space-4)" }}>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 500 }}>
                  Red Gerekçesi (Opsiyonel)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reddetme nedeninizi yazın..."
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    resize: "vertical",
                    minHeight: "80px",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                <ModernButton variant="ghost" onClick={() => setShowRejectModal(false)}>
                  İptal
                </ModernButton>
                <ModernButton
                  variant="danger"
                  onClick={handleReject}
                  isLoading={rejectMutation.isPending}
                  leftIcon={<Ban className="h-4 w-4" />}
                >
                  Reddet
                </ModernButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Detail Modal */}
      <AnimatePresence>
        {selectedTransfer && !showProcessModal && !showRejectModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "var(--space-4)",
            }}
            onClick={() => setSelectedTransfer(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                background: "var(--bg-primary)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-6)",
                width: "100%",
                maxWidth: "500px",
                boxShadow: "var(--shadow-xl)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                  Transfer Detayları
                </h3>
                <Badge variant={statusConfig[selectedTransfer.status].color}>
                  {statusConfig[selectedTransfer.status].label}
                </Badge>
              </div>

              <div
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                }}
              >
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Transfer ID:</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{selectedTransfer.id}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Oluşturulma:</span>
                    <span>{formatDate(selectedTransfer.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Brüt Tutar:</span>
                    <span>{formatCurrency(selectedTransfer.gross_amount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Komisyon:</span>
                    <span style={{ color: "var(--color-primary)" }}>
                      {formatCurrency(selectedTransfer.commission_amount)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                    <span>Net Tutar:</span>
                    <span style={{ color: "var(--color-success)" }}>
                      {formatCurrency(selectedTransfer.net_amount)}
                    </span>
                  </div>
                  {selectedTransfer.bank_iban && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>IBAN:</span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {selectedTransfer.bank_iban}
                      </span>
                    </div>
                  )}
                  {selectedTransfer.reference_id && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Referans:</span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {selectedTransfer.reference_id}
                      </span>
                    </div>
                  )}
                  {selectedTransfer.transfer_date && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Transfer Tarihi:</span>
                      <span>{formatDate(selectedTransfer.transfer_date)}</span>
                    </div>
                  )}
                  {selectedTransfer.notes && (
                    <div style={{ marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--border-color)" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Notlar:</span>
                      <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
                        {selectedTransfer.notes}
                      </p>
                    </div>
                  )}
                  {selectedTransfer.error_message && (
                    <div style={{ marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--border-color)" }}>
                      <span style={{ color: "var(--color-danger)", fontSize: "0.75rem" }}>Hata Mesajı:</span>
                      <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.875rem", color: "var(--color-danger)" }}>
                        {selectedTransfer.error_message}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
                <ModernButton variant="ghost" onClick={() => setSelectedTransfer(null)}>
                  Kapat
                </ModernButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
