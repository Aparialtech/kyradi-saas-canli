import React from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reservationService, type Reservation } from "../../services/partner/reservations";
import { useToast } from "../../hooks/useToast";
import { useTranslation } from "../../hooks/useTranslation";
import { getErrorMessage } from "../../lib/httpError";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface PaymentActionModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentActionModal: React.FC<PaymentActionModalProps> = ({
  reservation,
  isOpen,
  onClose,
}) => {
  const { t, locale } = useTranslation();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: reservation?.currency || "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Create Payment Mutation
  const createPaymentMutation = useMutation({
    mutationFn: () => reservationService.createPayment(reservation!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("payment.modal.createSuccess"), type: "success" });
      onClose();
    },
    onError: (error: unknown) => {
      push({
        title: t("payment.modal.createError"),
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  // Mark Paid Mutation (Manual)
  const markPaidMutation = useMutation({
    mutationFn: () => reservationService.markPaid(reservation!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ title: t("payment.modal.markPaidSuccess"), type: "success" });
      onClose();
    },
    onError: (error: unknown) => {
      push({
        title: t("payment.modal.markPaidError"),
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  if (!reservation) return null;

  const guestName = reservation.full_name || reservation.customer_name || reservation.guest_name || t("reservations.guestUnknown");
  const guestEmail = reservation.guest_email || reservation.customer_email || "—";
  const guestPhone = reservation.guest_phone || reservation.customer_phone || reservation.phone_number || "—";
  const amount = reservation.estimated_total_price || reservation.amount_minor || 0;
  const baggageCount = reservation.baggage_count || reservation.luggage_count || 0;
  const storageCode = reservation.storage_code || "—";

  const isLoading = createPaymentMutation.isPending || markPaidMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title={t("payment.modal.actionTitle")}
        description={t("payment.modal.actionDescription")}
        onClose={onClose}
      />
      <ModalBody>
        {/* Reservation Summary */}
        <Card variant="elevated" padding="md" style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            {/* Guest Info */}
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>
                {t("payment.modal.guest")}
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text)" }}>
                {guestName}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {guestEmail}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                {guestPhone}
              </div>
            </div>

            {/* Reservation Info */}
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>
                {t("payment.modal.reservationInfo")}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>ID:</strong> #{String(reservation.id).slice(0, 8)}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>{t("payment.modal.storage")}:</strong> {storageCode}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>{t("payment.modal.baggage")}:</strong> {baggageCount} {t("common.pieces")}
              </div>
            </div>
          </div>
        </Card>

        {/* Price Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            padding: "var(--space-6)",
            background: "linear-gradient(135deg, var(--color-primary-soft), var(--color-secondary-soft))",
            borderRadius: "var(--radius-xl)",
            textAlign: "center",
            marginBottom: "var(--space-4)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
            {t("payment.modal.totalAmount")}
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            {currencyFormatter.format(amount / 100)}
          </div>
          <Badge variant="warning" size="sm" style={{ marginTop: "var(--space-2)" }}>
            {t("payment.modal.unpaid")}
          </Badge>
        </motion.div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={createPaymentMutation.isPending}
            disabled={isLoading}
            onClick={() => createPaymentMutation.mutate()}
          >
            💳 {t("payment.modal.processPayment")}
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            isLoading={markPaidMutation.isPending}
            disabled={isLoading}
            onClick={() => markPaidMutation.mutate()}
          >
            ✅ {t("payment.modal.markAsPaid")}
          </Button>
        </div>
      </ModalBody>
      <ModalFooter justify="end">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          {t("common.close")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

