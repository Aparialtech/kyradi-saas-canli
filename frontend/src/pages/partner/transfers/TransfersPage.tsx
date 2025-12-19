import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  DollarSign,
  Send,
  Clock,
  Loader2,
  AlertCircle,
  TrendingUp,
  Calendar,
  CreditCard,
  Building2,
  RefreshCw,
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
  completed: { label: "Tamamlandı", color: "success" },
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
      push({ type: "success", title: "Başarılı", description: "Transfer talebi gönderildi." });
      queryClient.invalidateQueries({ queryKey: ["payment-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["payment-balance"] });
      setShowRequestModal(false);
      setRequestAmount("");
      setRequestNotes("");
    },
    onError: (error) => {
      push({ type: "error", title: "Hata", description: getErrorMessage(error) });
    },
  });

  const handleRequestTransfer = useCallback(() => {
    const amount = parseFloat(requestAmount);
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
      label: "Brüt Tutar",
      render: (row: PaymentTransfer) => formatCurrency(row.gross_amount),
    },
    {
      key: "commission_amount",
      label: "Komisyon",
      render: (row: PaymentTransfer) => formatCurrency(row.commission_amount),
    },
    {
      key: "net_amount",
      label: "Net Tutar",
      render: (row: PaymentTransfer) => (
        <span style={{ fontWeight: 600, color: "var(--color-success)" }}>
          {formatCurrency(row.net_amount)}
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
      label: "Transfer Tarihi",
      render: (row: PaymentTransfer) => formatDate(row.transfer_date),
    },
    {
      key: "reference_id",
      label: "Referans",
      render: (row: PaymentTransfer) => row.reference_id || "-",
    },
  ];

  const balance = balanceQuery.data;
  const schedule = scheduleQuery.data;

  return (
    <div style={{ padding: "var(--space-6)" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Para Transferleri
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
          Hesap bakiyenizi ve transfer geçmişinizi görüntüleyin
        </p>
      </motion.div>

      {/* Balance Cards */}
      {balance && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-4)",
            marginBottom: "var(--space-6)",
          }}
        >
          <Card>
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <DollarSign
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-primary)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Mevcut Bakiye
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(balance.available_balance)}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <Clock
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-warning)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Bekleyen Transferler
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(balance.pending_transfers)}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <TrendingUp
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-success)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Toplam Transfer
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(balance.total_transferred)}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div style={{ textAlign: "center" }}>
                <Calendar
                  className="h-8 w-8"
                  style={{ margin: "0 auto var(--space-2)", color: "var(--color-info)" }}
                />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                  Sonraki Planlanan
                </p>
                <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: "var(--space-1) 0 0" }}>
                  {balance.next_scheduled_date
                    ? new Date(balance.next_scheduled_date).toLocaleDateString("tr-TR")
                    : "Planlanmamış"}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Schedule Info */}
      {schedule && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Building2 className="h-5 w-5" />
              <span>Ödeme Planı Bilgileri</span>
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
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Durum</p>
                <Badge variant={schedule.is_enabled ? "success" : "neutral"}>
                  {schedule.is_enabled ? "Aktif" : "Pasif"}
                </Badge>
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Periyot</p>
                <p style={{ fontWeight: 500, margin: "var(--space-1) 0 0" }}>
                  {schedule.period_type === "daily" && "Günlük"}
                  {schedule.period_type === "weekly" && "Haftalık"}
                  {schedule.period_type === "biweekly" && "2 Haftalık"}
                  {schedule.period_type === "monthly" && "Aylık"}
                  {schedule.period_type === "custom" && `${schedule.custom_days} Gün`}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Komisyon Oranı</p>
                <p style={{ fontWeight: 500, margin: "var(--space-1) 0 0" }}>
                  %{(schedule.commission_rate * 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Min. Transfer</p>
                <p style={{ fontWeight: 500, margin: "var(--space-1) 0 0" }}>
                  {formatCurrency(schedule.min_transfer_amount)}
                </p>
              </div>
              {schedule.bank_iban && (
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0 }}>Banka Hesabı</p>
                  <p style={{ fontWeight: 500, margin: "var(--space-1) 0 0", fontFamily: "monospace" }}>
                    {schedule.bank_iban}
                  </p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Actions & Filters */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <CreditCard className="h-5 w-5" />
              <span>Transfer Geçmişi</span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
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
                onClick={() => queryClient.invalidateQueries({ queryKey: ["payment-transfers"] })}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Yenile
              </ModernButton>
              {balance?.can_request_transfer && (
                <ModernButton
                  variant="primary"
                  onClick={() => setShowRequestModal(true)}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Transfer Talep Et
                </ModernButton>
              )}
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
              <p>Henüz transfer kaydı bulunmuyor.</p>
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

      {/* Request Transfer Modal */}
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
          }}
          onClick={() => setShowRequestModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "var(--shadow-xl)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "1.25rem", fontWeight: 600 }}>
              Transfer Talep Et
            </h3>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 500 }}>
                Tutar (TL)
              </label>
              <ModernInput
                type="number"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder={`Min. ${balance?.min_transfer_amount || 100} TL`}
                fullWidth
              />
            </div>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 500 }}>
                Not (Opsiyonel)
              </label>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Transfer ile ilgili notunuz..."
                style={{
                  width: "100%",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  resize: "vertical",
                  minHeight: "80px",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {requestAmount && parseFloat(requestAmount) > 0 && schedule && (
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Brüt Tutar:</span>
                  <span>{formatCurrency(parseFloat(requestAmount))}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    Komisyon (%{(schedule.commission_rate * 100).toFixed(2)}):
                  </span>
                  <span style={{ color: "var(--color-danger)" }}>
                    -{formatCurrency(parseFloat(requestAmount) * schedule.commission_rate)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 600,
                    borderTop: "1px solid var(--border-color)",
                    paddingTop: "var(--space-2)",
                  }}
                >
                  <span>Net Tutar:</span>
                  <span style={{ color: "var(--color-success)" }}>
                    {formatCurrency(parseFloat(requestAmount) * (1 - schedule.commission_rate))}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <ModernButton variant="ghost" onClick={() => setShowRequestModal(false)}>
                İptal
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleRequestTransfer}
                isLoading={requestMutation.isPending}
                disabled={!requestAmount || parseFloat(requestAmount) < (balance?.min_transfer_amount || 100)}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Talep Gönder
              </ModernButton>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
