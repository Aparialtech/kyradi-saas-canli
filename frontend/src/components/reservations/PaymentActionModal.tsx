import React, { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CreditCard, CheckCircle2, Wallet } from "../../lib/lucide";

import { reservationService, type Reservation, type ReservationPaymentInfo } from "../../services/partner/reservations";
import { paymentService } from "../../services/partner/payments";
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
  paymentInfo: ReservationPaymentInfo | null;
}

export const PaymentActionModal: React.FC<PaymentActionModalProps> = ({
  reservation,
  isOpen,
  onClose,
  paymentInfo,
}) => {
  const { t, locale } = useTranslation();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: paymentInfo?.currency || reservation?.currency || "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Create Checkout Session & Redirect to Payment Page
  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const reservationIdForPayment = paymentInfo?.reservation_id ?? reservation!.id;
      const response = await paymentService.createCheckoutSession({
        reservation_id: String(reservationIdForPayment),
      });
      return response;
    },
    onSuccess: (data) => {
      // Redirect to checkout URL
      if (data.checkout_url) {
        setIsRedirecting(true);
        
        // Full URL or relative path
        const checkoutUrl = data.checkout_url.startsWith('http') 
          ? data.checkout_url 
          : `${window.location.origin}${data.checkout_url}`;
        
        // Open in new tab
        window.open(checkoutUrl, '_blank');
        
        // Refresh reservations after a delay
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
          setIsRedirecting(false);
          onClose();
        }, 1500);
      }
    },
    onError: (error: unknown) => {
      setIsRedirecting(false);
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

  // Confirm Cash Payment Mutation
  const confirmCashMutation = useMutation({
    mutationFn: async () => {
      if (!paymentInfo?.payment_id) {
        throw new Error("Payment ID not found");
      }
      return paymentService.confirmCash(paymentInfo.payment_id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      push({ 
        title: "Nakit ödeme onaylandı", 
        description: "Ödeme başarıyla kaydedildi ve rezervasyon aktif hale getirildi.",
        type: "success" 
      });
      onClose();
    },
    onError: (error: unknown) => {
      push({
        title: "Nakit ödeme onaylanamadı",
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
  const paymentAmount = paymentInfo?.amount_minor ?? amount;
  const baggageCount = reservation.baggage_count || reservation.luggage_count || 0;
  const storageCode = reservation.storage_code || "—";

  const isLoading = createCheckoutMutation.isPending || markPaidMutation.isPending || confirmCashMutation.isPending || isRedirecting;
  const checkoutUrl = paymentInfo?.checkout_url;

  const handlePayClick = () => {
    if (checkoutUrl) {
      setIsRedirecting(true);
      const url = checkoutUrl.startsWith("http") ? checkoutUrl : `${window.location.origin}${checkoutUrl}`;
      window.open(url, "_blank");
      setTimeout(() => setIsRedirecting(false), 1200);
      return;
    }
    createCheckoutMutation.mutate();
  };

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
            {currencyFormatter.format(paymentAmount / 100)}
          </div>
          <div style={{ marginTop: "var(--space-2)" }}>
            <Badge variant="warning" size="sm">
              {t("payment.modal.unpaid")}
            </Badge>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={createCheckoutMutation.isPending || isRedirecting}
            disabled={isLoading}
            onClick={handlePayClick}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4" style={{ animation: "spin 1s linear infinite" }} />
                {t("payment.modal.redirecting")}
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                {t("payment.modal.processPayment")}
              </>
            )}
          </Button>

          <p style={{ 
            fontSize: "0.8125rem", 
            color: "var(--color-text-muted)", 
            textAlign: "center",
            margin: "var(--space-2) 0"
          }}>
            veya
          </p>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            isLoading={confirmCashMutation.isPending}
            disabled={isLoading}
            onClick={() => confirmCashMutation.mutate()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            <Wallet className="h-4 w-4" />
            Nakit Ödeme
          </Button>

          <p style={{ 
            fontSize: "0.8125rem", 
            color: "var(--color-text-muted)", 
            textAlign: "center",
            margin: "var(--space-2) 0"
          }}>
            veya
          </p>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            isLoading={markPaidMutation.isPending}
            disabled={isLoading}
            onClick={() => markPaidMutation.mutate()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t("payment.modal.markAsPaid")}
          </Button>
          
          <p style={{ 
            fontSize: "0.75rem", 
            color: "var(--color-text-subtle)", 
            textAlign: "center",
            marginTop: "var(--space-1)"
          }}>
            {t("payment.modal.manualPaidHint")}
          </p>
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
