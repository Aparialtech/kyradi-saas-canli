import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Clock,
  Loader2,
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap,
  Eye,
  Check,
  X,
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
import { Badge } from "../../../components/ui/Badge";

import styles from "./AdminTransfersPage.module.css";

const statusConfig: Record<string, { label: string; color: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending: { label: "Onay Bekliyor", color: "warning" },
  processing: { label: "İşleniyor", color: "info" },
  completed: { label: "Onaylandı", color: "success" },
  failed: { label: "Başarısız", color: "danger" },
  cancelled: { label: "Reddedildi", color: "neutral" },
};

export function AdminTransfersPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [selectedTransfer, setSelectedTransfer] = useState<PaymentTransfer | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
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
  const approveMutation = useMutation({
    mutationFn: (transferId: string) =>
      paymentScheduleService.processTransferWithMagicPay(transferId),
    onSuccess: (data) => {
      push({
        type: "success",
        title: "Transfer Onaylandı",
        description: `İşlem No: ${data.transaction_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-transfers"] });
      setShowApproveModal(false);
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
      push({ type: "success", title: "Transfer Reddedildi" });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-transfers"] });
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedTransfer(null);
    },
    onError: (error) => {
      push({ type: "error", title: "Hata", description: getErrorMessage(error) });
    },
  });

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

  const transfers = transfersQuery.data?.data || [];
  const paginationMeta = useMemo(() => {
    if (!transfersQuery.data?.meta) return calculatePaginationMeta(0, page, pageSize);
    return {
      total: transfersQuery.data.meta.total || 0,
      page: transfersQuery.data.meta.page || 1,
      pageSize: transfersQuery.data.meta.pageSize || 10,
      totalPages: transfersQuery.data.meta.totalPages || 1,
    };
  }, [transfersQuery.data?.meta, page, pageSize]);

  // Stats
  const stats = useMemo(() => {
    const validTransfers = transfers.filter((t) => t != null);
    return {
      pendingCount: validTransfers.filter((t) => t?.status === "pending").length,
      pendingAmount: validTransfers.filter((t) => t?.status === "pending").reduce((sum, t) => sum + (t?.gross_amount || 0), 0),
      completedAmount: validTransfers.filter((t) => t?.status === "completed").reduce((sum, t) => sum + (t?.gross_amount || 0), 0),
      totalAmount: validTransfers.reduce((sum, t) => sum + (t?.gross_amount || 0), 0),
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
      key: "tenant_id",
      label: "Partner",
      render: (_value: unknown, row: PaymentTransfer) => (
        <span className={styles.tenantId}>
          {row?.tenant_id ? `${row.tenant_id.substring(0, 8)}...` : "-"}
        </span>
      ),
    },
    {
      key: "gross_amount",
      label: "Tutar",
      render: (_value: unknown, row: PaymentTransfer) => (
        <span style={{ fontWeight: 600, color: "#dc2626" }}>
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
        <span className={styles.noteCell}>
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
          <div className={styles.actionButtons}>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTransfer(row);
                setShowDetailModal(true);
              }}
              leftIcon={<Eye className="h-3 w-3" />}
            >
              Detay
            </ModernButton>
            {isPending && (
              <>
                <ModernButton
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTransfer(row);
                    setShowApproveModal(true);
                  }}
                  leftIcon={<Check className="h-3 w-3" />}
                >
                  Onayla
                </ModernButton>
                <ModernButton
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTransfer(row);
                    setShowRejectModal(true);
                  }}
                  leftIcon={<X className="h-3 w-3" />}
                >
                  Reddet
                </ModernButton>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const magicPayStatus = magicPayStatusQuery.data;

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
            <h1 className={styles.title}>Komisyon Transferleri</h1>
            <p className={styles.subtitle}>Partnerlerden gelen komisyon ödemelerini yönetin ve onaylayın</p>
          </div>
          <Badge variant={magicPayStatus?.is_demo_mode ? "warning" : "success"}>
            <Zap className="h-3 w-3" style={{ marginRight: 4 }} />
            {magicPayStatus?.is_demo_mode ? "MagicPay Demo" : "MagicPay Aktif"}
          </Badge>
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
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <Clock className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Onay Bekleyen</p>
              <p className={styles.statValue} style={{ color: "#d97706" }}>{stats.pendingCount} adet</p>
              <p className={styles.statSubvalue}>{formatCurrency(stats.pendingAmount)}</p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
              <CheckCircle className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Alınan Komisyon</p>
              <p className={styles.statValue} style={{ color: "#059669" }}>{formatCurrency(stats.completedAmount)}</p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
              <CreditCard className="h-6 w-6" style={{ color: "white" }} />
            </div>
            <div>
              <p className={styles.statLabel}>Toplam İşlem</p>
              <p className={styles.statValue} style={{ color: "#4f46e5" }}>{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Transfers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>Tüm Transferler</h2>
              <div className={styles.tableActions}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TransferStatus | "")}
                  className={styles.filterSelect}
                >
                  <option value="">Tüm Durumlar</option>
                  <option value="pending">Onay Bekliyor</option>
                  <option value="completed">Onaylandı</option>
                  <option value="cancelled">Reddedildi</option>
                </select>
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
                <p>Henüz komisyon transferi bulunmuyor</p>
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

      {/* Approve Modal */}
      <AnimatePresence>
        {showApproveModal && selectedTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
            onClick={() => setShowApproveModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={styles.modal}
            >
              <div className={styles.modalCenter}>
                <div className={styles.modalIconLarge} style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
                  <CheckCircle className="h-8 w-8" style={{ color: "white" }} />
                </div>
                <h3 className={styles.modalTitle}>Transferi Onayla</h3>
                <p className={styles.modalSubtitle}>Bu komisyon ödemesini onaylamak istediğinizden emin misiniz?</p>
              </div>

              <div className={styles.approveDetails}>
                <div className={styles.detailRow}>
                  <span>Tutar</span>
                  <span className={styles.approveAmount}>{formatCurrency(selectedTransfer.gross_amount)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Partner</span>
                  <span className={styles.tenantId}>{selectedTransfer.tenant_id?.substring(0, 12)}...</span>
                </div>
              </div>

              <div className={styles.modalActions}>
                <ModernButton variant="ghost" onClick={() => setShowApproveModal(false)} style={{ flex: 1 }}>
                  İptal
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={() => approveMutation.mutate(selectedTransfer.id)}
                  isLoading={approveMutation.isPending}
                  leftIcon={<Check className="h-4 w-4" />}
                  style={{ flex: 1 }}
                >
                  Onayla
                </ModernButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={styles.modal}
            >
              <div className={styles.modalCenter}>
                <div className={styles.modalIconLarge} style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}>
                  <XCircle className="h-8 w-8" style={{ color: "white" }} />
                </div>
                <h3 className={styles.modalTitle}>Transferi Reddet</h3>
                <p className={styles.modalSubtitle}>Bu komisyon ödemesini reddetmek istediğinizden emin misiniz?</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Red Nedeni (Opsiyonel)</label>
                <textarea
                  placeholder="Red nedeninizi yazın..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className={styles.textarea}
                />
              </div>

              <div className={styles.modalActions}>
                <ModernButton variant="ghost" onClick={() => setShowRejectModal(false)} style={{ flex: 1 }}>
                  İptal
                </ModernButton>
                <ModernButton
                  variant="danger"
                  onClick={() => rejectMutation.mutate({ transferId: selectedTransfer.id, reason: rejectReason })}
                  isLoading={rejectMutation.isPending}
                  leftIcon={<X className="h-4 w-4" />}
                  style={{ flex: 1 }}
                >
                  Reddet
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
              style={{ maxWidth: "500px" }}
            >
              <div className={styles.detailHeader}>
                <h3 className={styles.modalTitle}>Transfer Detayı</h3>
                <Badge variant={statusConfig[selectedTransfer.status]?.color || "neutral"}>
                  {statusConfig[selectedTransfer.status]?.label || selectedTransfer.status}
                </Badge>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span>Tutar</span>
                  <span style={{ fontWeight: 700, color: "#dc2626", fontSize: "1.125rem" }}>
                    {formatCurrency(selectedTransfer.gross_amount)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span>Partner ID</span>
                  <span className={styles.tenantId}>{selectedTransfer.tenant_id}</span>
                </div>
                <div className={styles.detailRow}>
                  <span>Talep Tarihi</span>
                  <span>{formatDate(selectedTransfer.created_at)}</span>
                </div>
                {selectedTransfer.transfer_date && (
                  <div className={styles.detailRow}>
                    <span>İşlem Tarihi</span>
                    <span>{formatDate(selectedTransfer.transfer_date)}</span>
                  </div>
                )}
                {selectedTransfer.reference_id && (
                  <div className={styles.detailRow}>
                    <span>Referans No</span>
                    <span style={{ fontFamily: "monospace" }}>{selectedTransfer.reference_id}</span>
                  </div>
                )}
                {selectedTransfer.notes && (
                  <div className={styles.detailRowFull}>
                    <span>Not</span>
                    <p>{selectedTransfer.notes}</p>
                  </div>
                )}
                {selectedTransfer.error_message && (
                  <div className={styles.errorBox}>
                    <span>Red Nedeni</span>
                    <p>{selectedTransfer.error_message}</p>
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                {selectedTransfer.status === "pending" && (
                  <>
                    <ModernButton
                      variant="primary"
                      onClick={() => {
                        setShowDetailModal(false);
                        setShowApproveModal(true);
                      }}
                      leftIcon={<Check className="h-4 w-4" />}
                      style={{ flex: 1 }}
                    >
                      Onayla
                    </ModernButton>
                    <ModernButton
                      variant="danger"
                      onClick={() => {
                        setShowDetailModal(false);
                        setShowRejectModal(true);
                      }}
                      leftIcon={<X className="h-4 w-4" />}
                      style={{ flex: 1 }}
                    >
                      Reddet
                    </ModernButton>
                  </>
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
