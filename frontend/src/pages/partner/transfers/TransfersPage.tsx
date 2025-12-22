import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Send,
  Clock,
  Loader2,
  AlertCircle,
  Calendar,
  CreditCard,
  Building2,
  RefreshCw,
  Zap,
  Info,
  ArrowRight,
  Wallet,
  PieChart,
  CheckCircle,
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
import { ModernInput } from "../../../components/ui/ModernInput";
import { Badge } from "../../../components/ui/Badge";

const statusConfig: Record<TransferStatus, { label: string; color: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending: { label: "Beklemede", color: "warning" },
  processing: { label: "İşleniyor", color: "info" },
  completed: { label: "Ödendi", color: "success" },
  failed: { label: "Başarısız", color: "danger" },
  cancelled: { label: "İptal", color: "neutral" },
};

export function TransfersPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

  // Queries
  const scheduleQuery = useQuery({
    queryKey: ["payment-schedule"],
    queryFn: () => paymentScheduleService.getMySchedule(),
  });

  const balanceQuery = useQuery({
    queryKey: ["payment-balance"],
    queryFn: () => paymentScheduleService.getBalance(),
  });

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

  const handleRequestTransfer = useCallback(() => {
    // Handle both comma and dot as decimal separator (Turkish locale uses comma)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  };

  // Parse amount handling Turkish comma decimal separator
  const parseAmount = (value: string): number => {
    return parseFloat(value.replace(",", "."));
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

  const columns: ModernTableColumn<PaymentTransfer>[] = [
    {
      key: "created_at",
      label: "Tarih",
      render: (row: PaymentTransfer) => formatDate(row.created_at),
    },
    {
      key: "gross_amount",
      label: "Komisyon Tutarı",
      render: (row: PaymentTransfer) => (
        <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>
          {formatCurrency(row.gross_amount)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      render: (row: PaymentTransfer) => {
        const config = statusConfig[row.status];
        return <Badge variant={config.color}>{config.label}</Badge>;
      },
    },
    {
      key: "transfer_date",
      label: "Ödeme Tarihi",
      render: (row: PaymentTransfer) => formatDate(row.transfer_date),
    },
    {
      key: "reference_id",
      label: "Referans No",
      render: (row: PaymentTransfer) => (
        <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
          {row.reference_id || "-"}
        </span>
      ),
    },
  ];

  const balance = balanceQuery.data;
  const schedule = scheduleQuery.data;
  const commission = commissionQuery.data;

  return (
    <div style={{ padding: "var(--space-6)" }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
        }
        .commission-card {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          position: relative;
          overflow: hidden;
        }
        .commission-card::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        }
        .magicpay-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .stat-card {
          transition: all 0.2s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        .paid-card {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
              Kyradi Komisyon Ödemeleri
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
              Kyradi'ye borçlu olduğunuz komisyon tutarlarını görüntüleyin ve ödeyin
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div className="magicpay-badge">
              <Zap className="h-4 w-4" />
              MagicPay Demo
            </div>
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

      {/* Commission Summary Card - Borç Durumu */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="commission-card"
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Wallet className="h-6 w-6" />
            <span style={{ fontSize: "1.125rem", fontWeight: 600 }}>Kyradi'ye Borçlu Olduğunuz Komisyon</span>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-4)" }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: "0.875rem", margin: 0 }}>Toplam Komisyon Borcu</p>
              <p style={{ fontSize: "2rem", fontWeight: 700, margin: "var(--space-1) 0 0" }}>
                {formatCurrency(commission?.total_commission || 0)}
              </p>
            </div>
            <div>
              <p style={{ opacity: 0.8, fontSize: "0.875rem", margin: 0 }}>Ödenmemiş Tutar</p>
              <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: "var(--space-1) 0 0" }}>
                {formatCurrency(commission?.available_commission || 0)}
              </p>
            </div>
            <div>
              <p style={{ opacity: 0.8, fontSize: "0.875rem", margin: 0 }}>Ödeme Bekleyen</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 600, margin: "var(--space-1) 0 0" }}>
                {formatCurrency(commission?.pending_commission || 0)}
              </p>
            </div>
            <div>
              <p style={{ opacity: 0.8, fontSize: "0.875rem", margin: 0 }}>Ödenen Toplam</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 600, margin: "var(--space-1) 0 0" }}>
                {formatCurrency(commission?.transferred_commission || 0)}
              </p>
            </div>
          </div>
          
          {commission && commission.reservation_count > 0 && (
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.875rem", opacity: 0.9 }}>
                <PieChart className="h-4 w-4" />
                {commission.reservation_count} rezervasyondan hesaplanan
              </span>
            </div>
          )}
        </div>
      </motion.div>

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
                <DollarSign
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "#dc2626" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Ödenmemiş Borç
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(balance?.available_balance || 0)}
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
                <Clock
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-warning)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Ödeme Bekliyor
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(balance?.pending_transfers || 0)}
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
                  Toplam Ödenen
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-success)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(balance?.total_transferred || 0)}
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="stat-card">
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <Calendar
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-info)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Sonraki Ödeme Tarihi
                </p>
                <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {balance?.next_scheduled_date
                    ? new Date(balance.next_scheduled_date).toLocaleDateString("tr-TR")
                    : "Belirlenmedi"}
                </p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Commission Rate Info */}
      {schedule && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card style={{ marginBottom: "var(--space-6)" }}>
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Building2 className="h-5 w-5" />
                <span>Komisyon Bilgileri</span>
              </div>
            </CardHeader>
            <CardBody>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Sistem Durumu</p>
                  <Badge variant={schedule.is_enabled ? "success" : "neutral"}>
                    {schedule.is_enabled ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Ödeme Periyodu</p>
                  <p style={{ fontWeight: 500, margin: "var(--space-1) 0 0" }}>
                    {schedule.period_type === "daily" && "Günlük"}
                    {schedule.period_type === "weekly" && "Haftalık"}
                    {schedule.period_type === "biweekly" && "2 Haftalık"}
                    {schedule.period_type === "monthly" && "Aylık"}
                    {schedule.period_type === "custom" && `${schedule.custom_days} Gün`}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Kyradi Komisyon Oranı</p>
                  <p style={{ fontWeight: 600, fontSize: "1.25rem", color: "#dc2626", margin: "var(--space-1) 0 0" }}>
                    %{(schedule.commission_rate * 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Min. Ödeme Tutarı</p>
                  <p style={{ fontWeight: 500, margin: "var(--space-1) 0 0" }}>
                    {formatCurrency(schedule.min_transfer_amount)}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Demo Mode Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4)",
            marginBottom: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <Info className="h-5 w-5" style={{ color: "#8b5cf6", flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "#7c3aed" }}>
              MagicPay Demo Modu Aktif
            </p>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Şu anda demo modunda çalışıyorsunuz. Ödeme işlemleri simüle edilmektedir.
              Gerçek API entegrasyonu yapıldığında komisyon ödemeleri otomatik olarak işlenecektir.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Payment History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CreditCard className="h-5 w-5" />
                <span>Ödeme Geçmişi</span>
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
                  <option value="completed">Ödendi</option>
                  <option value="failed">Başarısız</option>
                  <option value="cancelled">İptal</option>
                </select>
                <ModernButton
                  variant="ghost"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["payment-transfers"] });
                    queryClient.invalidateQueries({ queryKey: ["commission-summary"] });
                    queryClient.invalidateQueries({ queryKey: ["payment-balance"] });
                  }}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Yenile
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={() => setShowRequestModal(true)}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Komisyon Öde
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
                <p style={{ margin: 0 }}>Henüz ödeme kaydı bulunmuyor.</p>
                <ModernButton
                  variant="primary"
                  size="sm"
                  onClick={() => setShowRequestModal(true)}
                  leftIcon={<Send className="h-4 w-4" />}
                  style={{ marginTop: "var(--space-4)" }}
                >
                  İlk Komisyon Ödemesini Yap
                </ModernButton>
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

      {/* Payment Modal */}
      <AnimatePresence>
        {showRequestModal && (
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
            onClick={() => setShowRequestModal(false)}
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
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Send className="h-6 w-6" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                    Kyradi'ye Komisyon Öde
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Borçlu olduğunuz komisyonu ödeyin
                  </p>
                </div>
              </div>

              {/* Outstanding Balance Highlight */}
              {commission && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(185, 28, 28, 0.1) 100%)",
                    border: "1px solid rgba(220, 38, 38, 0.3)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-4)",
                    marginBottom: "var(--space-4)",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Ödenmemiş Komisyon Borcu
                  </p>
                  <p style={{ margin: "var(--space-1) 0 0", fontSize: "1.75rem", fontWeight: 700, color: "#dc2626" }}>
                    {formatCurrency(commission.available_commission)}
                  </p>
                </div>
              )}

              <div style={{ marginBottom: "var(--space-4)" }}>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 500 }}>
                  Ödeme Tutarı (TL) *
                </label>
                <ModernInput
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder={`Ödemek istediğiniz tutar`}
                  fullWidth
                />
                {commission && requestAmount && parseAmount(requestAmount) > commission.available_commission && (
                  <p style={{ margin: "var(--space-2) 0 0", fontSize: "0.75rem", color: "var(--color-warning)" }}>
                    Borç tutarından fazla ödeme yapamazsınız.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: "var(--space-4)" }}>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 500 }}>
                  Not (Opsiyonel)
                </label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Ödeme ile ilgili notunuz..."
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

              {requestAmount && parseAmount(requestAmount) > 0 && (
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    padding: "var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    marginBottom: "var(--space-4)",
                  }}
                >
                  <p style={{ margin: "0 0 var(--space-3)", fontWeight: 600, fontSize: "0.875rem" }}>
                    Ödeme Özeti
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                    <span>Kyradi'ye Ödenecek:</span>
                    <span style={{ color: "#dc2626", fontSize: "1.125rem" }}>
                      {formatCurrency(parseAmount(requestAmount))}
                    </span>
                  </div>
                </div>
              )}

              {/* MagicPay Demo Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  background: "rgba(139, 92, 246, 0.1)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <Zap className="h-4 w-4" style={{ color: "#8b5cf6" }} />
                <span style={{ fontSize: "0.75rem", color: "#7c3aed" }}>
                  MagicPay Demo - Ödeme simüle edilecektir
                </span>
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                <ModernButton variant="ghost" onClick={() => setShowRequestModal(false)}>
                  İptal
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={handleRequestTransfer}
                  isLoading={requestMutation.isPending}
                  disabled={!requestAmount || parseAmount(requestAmount) <= 0}
                  leftIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Ödemeyi Gönder
                </ModernButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
