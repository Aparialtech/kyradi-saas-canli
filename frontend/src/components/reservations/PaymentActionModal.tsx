import React, { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CreditCard, CheckCircle2, Wallet, Building2, Banknote } from "../../lib/lucide";

import { reservationService, type Reservation, type ReservationPaymentInfo } from "../../services/partner/reservations";
import { paymentService } from "../../services/partner/payments";
import { useToast } from "../../hooks/useToast";
import { useTranslation } from "../../hooks/useTranslation";
import { getErrorMessage } from "../../lib/httpError";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

type PaymentMethodType = "magicpay" | "pos" | "cash" | "bank_transfer";

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
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: paymentInfo?.currency || reservation?.currency || "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Create Checkout Session & Redirect to Payment Page (MagicPay)
  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const reservationIdForPayment = paymentInfo?.reservation_id ?? reservation!.id;
      const response = await paymentService.createCheckoutSession({
        reservation_id: String(reservationIdForPayment),
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        setIsRedirecting(true);
        const checkoutUrl = data.checkout_url.startsWith('http') 
          ? data.checkout_url 
          : `${window.location.origin}${data.checkout_url}`;
        window.open(checkoutUrl, '_blank');
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

  // Record Manual Payment (POS, Cash, Bank Transfer)
  const recordPaymentMutation = useMutation({
    mutationFn: async (method: string) => {
      return reservationService.createPayment(reservation!.id, { 
        method,
        notes: `Manuel ödeme - ${method.toUpperCase()}`
      });
    },
    onSuccess: (_data, method) => {
      void queryClient.invalidateQueries({ queryKey: ["widget-reservations"] });
      const methodLabels: Record<string, string> = {
        pos: "POS",
        cash: "Nakit",
        bank_transfer: "Havale/EFT"
      };
      push({ 
        title: "Ödeme Kaydedildi", 
        description: `${methodLabels[method] || method} ödemesi başarıyla kaydedildi.`,
        type: "success" 
      });
      onClose();
    },
    onError: (error: unknown) => {
      push({
        title: "Ödeme kaydedilemedi",
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

  const isLoading = createCheckoutMutation.isPending || recordPaymentMutation.isPending || isRedirecting;

  const handleConfirmPayment = () => {
    if (!selectedMethod) return;
    
    if (selectedMethod === "magicpay") {
      const checkoutUrl = paymentInfo?.checkout_url;
      if (checkoutUrl) {
        setIsRedirecting(true);
        const url = checkoutUrl.startsWith("http") ? checkoutUrl : `${window.location.origin}${checkoutUrl}`;
        window.open(url, "_blank");
        setTimeout(() => setIsRedirecting(false), 1200);
        return;
      }
      createCheckoutMutation.mutate();
    } else {
      recordPaymentMutation.mutate(selectedMethod);
    }
  };

  const paymentMethods = [
    {
      id: "magicpay" as PaymentMethodType,
      icon: CreditCard,
      title: "Online Ödeme",
      subtitle: "MagicPay ile kredi/banka kartı",
      color: "#6366f1",
      bgColor: "rgba(99, 102, 241, 0.1)",
      description: "Müşteri kartıyla online ödeme yapar"
    },
    {
      id: "pos" as PaymentMethodType,
      icon: Building2,
      title: "POS Cihazı",
      subtitle: "Otelin kendi POS'u ile",
      color: "#0ea5e9",
      bgColor: "rgba(14, 165, 233, 0.1)",
      description: "Otelin POS cihazından kart çekildi"
    },
    {
      id: "cash" as PaymentMethodType,
      icon: Banknote,
      title: "Nakit",
      subtitle: "Elden nakit ödeme",
      color: "#22c55e",
      bgColor: "rgba(34, 197, 94, 0.1)",
      description: "Müşteri nakit ödeme yaptı"
    },
    {
      id: "bank_transfer" as PaymentMethodType,
      icon: Wallet,
      title: "Havale / EFT",
      subtitle: "Banka transferi",
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.1)",
      description: "Müşteri havale/EFT yaptı"
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="💳 Ödeme Al"
        description="Rezervasyon için ödeme yöntemini seçin"
        onClose={onClose}
      />
      <ModalBody>
        {/* Reservation Summary */}
        <Card variant="elevated" padding="md" style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>
                Misafir
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
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>
                Rezervasyon
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>ID:</strong> #{String(reservation.id).slice(0, 8)}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>Depo:</strong> {storageCode}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>Bavul:</strong> {baggageCount} adet
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
            padding: "var(--space-5)",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            borderRadius: "var(--radius-xl)",
            textAlign: "center",
            marginBottom: "var(--space-4)",
            color: "white",
            boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)",
          }}
        >
          <div style={{ fontSize: "0.875rem", fontWeight: 500, opacity: 0.9, marginBottom: "var(--space-1)" }}>
            Alınacak Tutar
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {currencyFormatter.format(paymentAmount / 100)}
          </div>
        </motion.div>

        {/* Payment Method Selection */}
        <div style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ 
            fontSize: "0.875rem", 
            fontWeight: 600, 
            color: "var(--color-text)", 
            marginBottom: "var(--space-3)" 
          }}>
            Ödeme Yöntemi Seçin
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              
              return (
                <motion.div
                  key={method.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedMethod(method.id)}
                  style={{
                    padding: "var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    border: `2px solid ${isSelected ? method.color : "var(--color-border)"}`,
                    background: isSelected ? method.bgColor : "var(--color-bg-secondary)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: method.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCircle2 style={{ width: "14px", height: "14px", color: "white" }} />
                    </motion.div>
                  )}
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "var(--radius-md)",
                        background: method.bgColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon style={{ width: "24px", height: "24px", color: method.color }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "0.9375rem" }}>
                        {method.title}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                        {method.subtitle}
                      </div>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: "var(--space-2)",
                        paddingTop: "var(--space-2)",
                        borderTop: `1px solid ${method.color}30`,
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {method.description}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        {selectedMethod && selectedMethod !== "magicpay" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "var(--space-3)",
              background: "var(--color-warning-soft)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              color: "var(--color-warning-dark)",
              marginBottom: "var(--space-3)",
            }}
          >
            ℹ️ <strong>Not:</strong> Bu ödeme yöntemi seçildiğinde, ödemenin zaten alındığı varsayılır ve sistem sadece kayıt tutar.
          </motion.div>
        )}
      </ModalBody>
      
      <ModalFooter justify="space-between">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          İptal
        </Button>
        <Button 
          variant="primary" 
          onClick={handleConfirmPayment}
          disabled={!selectedMethod || isLoading}
          isLoading={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4" style={{ animation: "spin 1s linear infinite" }} />
              İşleniyor...
            </>
          ) : selectedMethod === "magicpay" ? (
            <>
              <CreditCard className="h-4 w-4" />
              Online Ödemeye Git
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Ödemeyi Kaydet
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
