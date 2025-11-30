import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { demoService } from "../../services/partner/demo";
import { magicpayService } from "../../services/partner/magicpay";
import { paymentService } from "../../services/partner/payments";
import { http } from "../../lib/http";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { useTranslation } from "../../hooks/useTranslation";

interface Reservation {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  storage_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  start_at: string;
  end_at: string;
  payment?: {
    id: string;
    status: string;
    mode: string;
    provider: string;
    provider_intent_id?: string | null;
    amount_minor: number;
  } | null;
}

interface Storage {
  id: string;
  code: string;
  status: string;
}

export function DemoPaymentFlowPage() {
  const { messages, push } = useToast();
  const { t } = useTranslation();
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<"pos" | "magicpay_success" | "magicpay_fail" | null>(null);

  // Get reservations list
  const reservationsQuery = useQuery({
    queryKey: ["partner", "reservations", "demo"],
    queryFn: async () => {
      const response = await http.get<Reservation[]>("/reservations", {
        params: { status: "active" },
      });
      return response.data;
    },
  });

  // Get selected reservation details
  const reservationQuery = useQuery({
    queryKey: ["partner", "reservation", selectedReservationId],
    queryFn: async () => {
      const response = await http.get<Reservation>(`/reservations/${selectedReservationId}`);
      return response.data;
    },
    enabled: !!selectedReservationId,
  });

  // Convert widget reservation mutation
  const convertMutation = useMutation({
    mutationFn: (widgetReservationId: number) => demoService.convertWidgetReservation(widgetReservationId),
    onSuccess: (data) => {
      push({
        title: "Rezervasyon Dönüştürüldü",
        description: `Rezervasyon ID: ${data.reservation_id}, Depo ID: ${data.storage_id}`,
        type: "success",
      });
      setSelectedReservationId(data.reservation_id);
      reservationsQuery.refetch();
    },
    onError: (error) => {
      push({
        title: "Dönüştürme Hatası",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  // POS payment confirmation mutation
  const confirmPosMutation = useMutation({
    mutationFn: (paymentId: string) => paymentService.confirmPos(paymentId),
    onSuccess: (data) => {
      push({
        title: "POS Ödemesi Onaylandı",
        description: `Ödeme ID: ${data.payment_id}, Tutar: ${(data.total_amount || 0) / 100} TRY`,
        type: "success",
      });
      reservationQuery.refetch();
      reservationsQuery.refetch();
      setScenario(null);
    },
    onError: (error) => {
      push({
        title: "POS Ödeme Hatası",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  // MagicPay demo complete mutation
  const magicpayCompleteMutation = useMutation({
    mutationFn: ({ sessionId, result }: { sessionId: string; result: "success" | "failed" }) =>
      magicpayService.completeDemoPayment(sessionId, result),
    onSuccess: (data, variables) => {
      const isSuccess = variables.result === "success";
      push({
        title: isSuccess ? "MagicPay Ödemesi Başarılı" : "MagicPay Ödemesi İptal Edildi",
        description: data.message,
        type: isSuccess ? "success" : "info",
      });
      reservationQuery.refetch();
      reservationsQuery.refetch();
      setScenario(null);
    },
    onError: (error) => {
      push({
        title: "MagicPay Ödeme Hatası",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const formatPrice = (minor: number, currency: string = "TRY") => {
    return (minor / 100).toFixed(2) + (currency === "TRY" ? " ₺" : ` ${currency}`);
  };

  const handlePosPayment = () => {
    if (!selectedReservationId || !reservationQuery.data?.payment) {
      push({
        title: "Hata",
        description: "Lütfen önce bir rezervasyon seçin ve payment bilgisini kontrol edin.",
        type: "error",
      });
      return;
    }

    const payment = reservationQuery.data.payment;
    if (payment.mode !== "POS") {
      push({
        title: "Hata",
        description: "Bu ödeme POS modunda değil. Lütfen POS modunda bir ödeme seçin.",
        type: "error",
      });
      return;
    }

    if (payment.status === "paid") {
      push({
        title: "Bilgi",
        description: "Bu ödeme zaten onaylanmış.",
        type: "info",
      });
      return;
    }

    if (confirm("POS ödemesini onaylamak istediğinize emin misiniz?")) {
      setScenario("pos");
      confirmPosMutation.mutate(payment.id);
    }
  };

  const handleMagicPaySuccess = () => {
    if (!selectedReservationId || !reservationQuery.data?.payment) {
      push({
        title: "Hata",
        description: "Lütfen önce bir rezervasyon seçin ve payment bilgisini kontrol edin.",
        type: "error",
      });
      return;
    }

    const payment = reservationQuery.data.payment;
    if (payment.provider !== "MAGIC_PAY" || payment.mode !== "GATEWAY_DEMO") {
      push({
        title: "Hata",
        description: "Bu ödeme MagicPay GATEWAY_DEMO modunda değil.",
        type: "error",
      });
      return;
    }

    const sessionId = payment.provider_intent_id || payment.id;
    if (!sessionId) {
      push({
        title: "Hata",
        description: "Session ID bulunamadı.",
        type: "error",
      });
      return;
    }

    setScenario("magicpay_success");
    magicpayCompleteMutation.mutate({ sessionId, result: "success" });
  };

  const handleMagicPayFail = () => {
    if (!selectedReservationId || !reservationQuery.data?.payment) {
      push({
        title: "Hata",
        description: "Lütfen önce bir rezervasyon seçin ve payment bilgisini kontrol edin.",
        type: "error",
      });
      return;
    }

    const payment = reservationQuery.data.payment;
    if (payment.provider !== "MAGIC_PAY" || payment.mode !== "GATEWAY_DEMO") {
      push({
        title: "Hata",
        description: "Bu ödeme MagicPay GATEWAY_DEMO modunda değil.",
        type: "error",
      });
      return;
    }

    const sessionId = payment.provider_intent_id || payment.id;
    if (!sessionId) {
      push({
        title: "Hata",
        description: "Session ID bulunamadı.",
        type: "error",
      });
      return;
    }

    if (confirm("MagicPay ödemesini iptal etmek istediğinize emin misiniz?")) {
      setScenario("magicpay_fail");
      magicpayCompleteMutation.mutate({ sessionId, result: "failed" });
    }
  };

  const reservation = reservationQuery.data;
  const payment = reservation?.payment;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Demo Payment Flow - Ödeme Akışı Demo</h1>
        <p className="text-muted">
          Bu sayfa, rezervasyon → depo → ödeme → settlement → revenue zincirini test etmek için kullanılır.
        </p>
      </div>

      <ToastContainer messages={messages} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        {/* Left Column: Reservation Selection */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2>1. Rezervasyon Seç</h2>
            </div>
            <div className="card-body">
              {reservationsQuery.isLoading ? (
                <p>Yükleniyor...</p>
              ) : reservationsQuery.isError ? (
                <p style={{ color: "#dc2626" }}>Hata: {getErrorMessage(reservationsQuery.error)}</p>
              ) : !reservationsQuery.data?.length ? (
                <p>Henüz rezervasyon yok. Önce bir rezervasyon oluşturun.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {reservationsQuery.data.map((res: Reservation) => (
                    <button
                      key={res.id}
                      type="button"
                      className="btn btn--ghost"
                      style={{
                        textAlign: "left",
                        backgroundColor: selectedReservationId === res.id ? "#e0e7ff" : "transparent",
                      }}
                      onClick={() => setSelectedReservationId(res.id)}
                    >
                      <div>
                        <strong>{res.customer_name || "İsimsiz"}</strong> - {res.customer_phone || "Telefon yok"}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                        {formatPrice(res.amount_minor, res.currency)} - {res.status}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reservation Details */}
          {reservation && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <div className="card-header">
                <h2>2. Rezervasyon Detayları</h2>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <strong>Rezervasyon ID:</strong> {reservation.id}
                  </div>
                  <div>
                    <strong>Müşteri:</strong> {reservation.customer_name || "—"}
                  </div>
                  <div>
                    <strong>Telefon:</strong> {reservation.customer_phone || "—"}
                  </div>
                  <div>
                    <strong>Depo ID:</strong> {reservation.storage_id}
                  </div>
                  <div>
                    <strong>Durum:</strong> {reservation.status}
                  </div>
                  <div>
                    <strong>Tutar:</strong> {formatPrice(reservation.amount_minor, reservation.currency)}
                  </div>
                  {payment && (
                    <>
                      <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                        <strong>Ödeme Bilgileri:</strong>
                      </div>
                      <div>
                        <strong>Payment ID:</strong> {payment.id}
                      </div>
                      <div>
                        <strong>Provider:</strong> {payment.provider}
                      </div>
                      <div>
                        <strong>Mode:</strong> {payment.mode}
                      </div>
                      <div>
                        <strong>Status:</strong> {payment.status}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Payment Scenarios */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2>3. Ödeme Senaryoları</h2>
            </div>
            <div className="card-body">
              {!reservation ? (
                <p style={{ color: "#64748b" }}>Lütfen önce bir rezervasyon seçin.</p>
              ) : !payment ? (
                <p style={{ color: "#dc2626" }}>
                  Bu rezervasyon için henüz ödeme kaydı oluşturulmamış. Rezervasyon oluşturulduğunda otomatik olarak
                  ödeme kaydı oluşturulmalı.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* POS Payment */}
                  {payment.mode === "POS" && (
                    <div style={{ padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                      <h3 style={{ marginTop: 0 }}>POS Ödeme</h3>
                      <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
                        Kasadan veya postadan alınan nakit/kart ödemesi için kullanılır.
                      </p>
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={confirmPosMutation.isPending || payment.status === "paid"}
                        onClick={handlePosPayment}
                      >
                        {confirmPosMutation.isPending
                          ? "İşleniyor..."
                          : payment.status === "paid"
                            ? "Zaten Onaylandı"
                            : "Ödemeyi POS'tan Aldım"}
                      </button>
                    </div>
                  )}

                  {/* MagicPay Success */}
                  {payment.provider === "MAGIC_PAY" && payment.mode === "GATEWAY_DEMO" && (
                    <div style={{ padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                      <h3 style={{ marginTop: 0 }}>MagicPay Demo - Başarılı</h3>
                      <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
                        MagicPay gateway demo modunda başarılı ödeme simülasyonu.
                      </p>
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={magicpayCompleteMutation.isPending || payment.status === "paid"}
                        onClick={handleMagicPaySuccess}
                      >
                        {magicpayCompleteMutation.isPending
                          ? "İşleniyor..."
                          : payment.status === "paid"
                            ? "Zaten Ödendi"
                            : "MagicPay Ödemeyi Başarılı Tamamla"}
                      </button>
                    </div>
                  )}

                  {/* MagicPay Fail */}
                  {payment.provider === "MAGIC_PAY" && payment.mode === "GATEWAY_DEMO" && (
                    <div style={{ padding: "1rem", border: "1px solid #fecaca", borderRadius: "8px" }}>
                      <h3 style={{ marginTop: 0 }}>MagicPay Demo - İptal</h3>
                      <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
                        MagicPay gateway demo modunda iptal edilen ödeme simülasyonu.
                      </p>
                      <button
                        type="button"
                        className="btn"
                        style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                        disabled={magicpayCompleteMutation.isPending || payment.status === "paid"}
                        onClick={handleMagicPayFail}
                      >
                        {magicpayCompleteMutation.isPending
                          ? "İşleniyor..."
                          : payment.status === "paid"
                            ? "Zaten Ödendi"
                            : "MagicPay Ödemeyi İptal Et"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Results & Links */}
          {reservation && payment && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <div className="card-header">
                <h2>4. Sonuçlar ve Bağlantılar</h2>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <Link to={`/app/reservations`} className="btn btn--ghost">
                    📋 Rezervasyonlar Listesi
                  </Link>
                  <Link to={`/app/lockers`} className="btn btn--ghost">
                    📦 Depo Listesi
                  </Link>
                  <Link to={`/app/revenue`} className="btn btn--ghost">
                    💰 Revenue Dashboard
                  </Link>
                  <Link to={`/app/settlements`} className="btn btn--ghost">
                    💵 Hakedişler (Settlements)
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

