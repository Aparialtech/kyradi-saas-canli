import React from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "../../lib/lucide";

import { reservationService, type Reservation, type ReservationPaymentInfo } from "../../services/partner/reservations";
import { useToast } from "../../hooks/useToast";
import { useConfirm } from "../common/ConfirmDialog";
import { useTranslation } from "../../hooks/useTranslation";
import { getErrorMessage } from "../../lib/httpError";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface PaymentDetailModalProps {
  reservation: Reservation | null;
  paymentInfo: ReservationPaymentInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
  reservation,
  paymentInfo,
  isOpen,
  onClose,
}) => {
  const { t, locale } = useTranslation();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: paymentInfo?.currency || reservation?.payment?.currency || reservation?.currency || "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Refund Payment Mutation
  const refundMutation = useMutation({
    mutationFn: () =>
      reservationService.refundPayment(reservation!.id, paymentInfo?.payment_id || reservation?.payment?.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("payment.modal.refundSuccess"), type: "success" });
      onClose();
    },
    onError: (error: unknown) => {
      push({
        title: t("payment.modal.refundError"),
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  if (!reservation) return null;

  const amount = paymentInfo?.amount_minor || reservation.estimated_total_price || reservation.amount_minor || 0;
  const paidAtRaw =
    paymentInfo?.paid_at ??
    paymentInfo?.meta?.captured_at ??
    paymentInfo?.meta?.paid_at ??
    paymentInfo?.meta?.processed_at;

  const paidAt =
    paidAtRaw instanceof Date
      ? paidAtRaw
      : typeof paidAtRaw === "string" || typeof paidAtRaw === "number"
        ? new Date(paidAtRaw)
        : undefined;

  const transactionId = paymentInfo?.transaction_id || "—";
  const paymentMethod = paymentInfo?.provider || paymentInfo?.mode || t("payment.modal.methodUnknown");
  const storageCode = reservation.storage_code || "—";
  const guestName = reservation.full_name || reservation.customer_name || reservation.guest_name || t("reservations.guestUnknown");

  const handleRefund = async () => {
    const confirmed = await confirm({
      title: 'İade Onayı',
      message: t("payment.modal.refundConfirm") || 'Bu ödemeyi iade etmek istediğinize emin misiniz?',
      confirmText: 'İade Et',
      cancelText: 'İptal',
      variant: 'warning',
    });
    if (confirmed) {
      refundMutation.mutate();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title={t("payment.modal.detailTitle")}
        description={t("payment.modal.detailDescription")}
        onClose={onClose}
      />
      <ModalBody>
        {/* Payment Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "var(--space-6)",
            background: "linear-gradient(135deg, var(--color-success-soft), rgba(16, 185, 129, 0.15))",
            borderRadius: "var(--radius-xl)",
            textAlign: "center",
            marginBottom: "var(--space-6)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div style={{ marginBottom: "var(--space-3)" }}>
            <Badge variant="success" solid size="lg" className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("payment.modal.paid")}
            </Badge>
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            {currencyFormatter.format(amount / 100)}
          </div>
        </motion.div>

        {/* Payment Details Grid */}
        <Card variant="elevated" padding="none" style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0" }}>
            {/* Amount */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {t("payment.modal.amount")}
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text)" }}>
                {currencyFormatter.format(amount / 100)}
              </span>
            </div>

            {/* Payment Date */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {t("payment.modal.paidAt")}
              </span>
              <span style={{ fontSize: "0.9375rem", color: "var(--color-text)" }}>
                {paidAt ? dateFormatter.format(new Date(paidAt)) : "—"}
              </span>
            </div>

            {/* Payment Method */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {t("payment.modal.method")}
              </span>
              <Badge variant="primary" size="sm">
                {paymentMethod}
              </Badge>
            </div>

            {/* Transaction ID */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {t("payment.modal.transactionId")}
              </span>
              <span style={{ fontSize: "0.875rem", fontFamily: "monospace", color: "var(--color-text-secondary)" }}>
                {transactionId}
              </span>
            </div>

            {/* Storage */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {t("payment.modal.storage")}
              </span>
              <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text)" }}>
                {storageCode}
              </span>
            </div>

            {/* Guest */}
            <div style={{
              padding: "var(--space-4) var(--space-5)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {t("payment.modal.guest")}
              </span>
              <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text)" }}>
                {guestName}
              </span>
            </div>
          </div>
        </Card>

        {/* Refund Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            variant="danger"
            size="lg"
            fullWidth
            isLoading={refundMutation.isPending}
            onClick={handleRefund}
          >
            💸 {t("payment.modal.refund")}
          </Button>
          <p style={{
            fontSize: "0.8125rem",
            color: "var(--color-text-muted)",
            textAlign: "center",
            marginTop: "var(--space-2)",
          }}>
            {t("payment.modal.refundWarning")}
          </p>
        </motion.div>
      </ModalBody>
      <ModalFooter justify="end">
        <Button variant="ghost" onClick={onClose} disabled={refundMutation.isPending}>
          {t("common.close")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
