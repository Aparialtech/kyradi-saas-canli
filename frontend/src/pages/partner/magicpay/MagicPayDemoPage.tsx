import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";

import { magicpayService } from "../../../services/partner/magicpay";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";

export function MagicPayDemoPage() {
  const { t: _t } = useTranslation(); // Translation hook ready for i18n
  const { sessionId } = useParams<{ sessionId: string }>();
  const { messages, push } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const paymentInfoQuery = useQuery({
    queryKey: ["magicpay", "payment-info", sessionId],
    queryFn: () => magicpayService.getPaymentInfo(sessionId!),
    enabled: !!sessionId,
  });

  const completeMutation = useMutation({
    mutationFn: (result: "success" | "failed") =>
      magicpayService.completeDemoPayment(sessionId!, result),
    onSuccess: (data, variables) => {
      setIsProcessing(false);
      if (data.ok) {
        // Determine result from the request parameter (what user clicked)
        // Also check payment_status as fallback
        const paymentStatus = (data.payment_status || "").toUpperCase();
        const isSuccess = variables === "success" || paymentStatus === "CAPTURED" || paymentStatus === "SUCCESS";
        
        push({
          title: isSuccess ? "Ödeme Başarılı" : "Ödeme İptal Edildi",
          description: data.message || (isSuccess ? "Ödeme başarıyla tamamlandı." : "Ödeme iptal edildi."),
          type: isSuccess ? "success" : "info",
        });
        
        // Redirect based on result
        setTimeout(() => {
          if (isSuccess) {
            window.location.href = `/app/reservations?payment_success=${data.payment_id}`;
          } else {
            window.location.href = `/app/reservations?payment_failed=${data.payment_id}`;
          }
        }, 2000);
      }
    },
    onError: (error) => {
      setIsProcessing(false);
      push({
        title: "Ödeme İşlemi Başarısız",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const handleSuccess = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    completeMutation.mutate("success");
  };

  const handleCancel = async () => {
    if (isProcessing) return;
    const confirmed = window.confirm("Ödemeyi iptal etmek istediğinize emin misiniz?");
    if (confirmed) {
      setIsProcessing(true);
      completeMutation.mutate("failed");
    }
  };

  const formatPrice = (minor: number, currency: string = "TRY") => {
    return (minor / 100).toFixed(2) + (currency === "TRY" ? " ₺" : ` ${currency}`);
  };

  if (!sessionId) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>Geçersiz ödeme oturumu</p>
        </div>
      </div>
    );
  }

  if (paymentInfoQuery.isLoading) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (paymentInfoQuery.isError || !paymentInfoQuery.data) {
    return (
      <div className="page">
        <div className="empty-state" style={{ color: "#dc2626" }}>
          <p>Ödeme bilgileri yüklenemedi</p>
          <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {paymentInfoQuery.error ? getErrorMessage(paymentInfoQuery.error) : "Bilinmeyen hata"}
          </p>
        </div>
      </div>
    );
  }

  const paymentInfo = paymentInfoQuery.data;
  const amount = formatPrice(paymentInfo.amount_minor, paymentInfo.currency);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <ToastContainer messages={messages} />
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          maxWidth: "500px",
          width: "100%",
          padding: "3rem",
        }}
      >
        {/* MagicPay Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "0.5rem",
            }}
          >
            MagicPay
          </div>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Güvenli Ödeme Gateway</p>
        </div>

        {/* Demo Badge */}
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fde047",
            borderRadius: "8px",
            padding: "0.75rem",
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
            <strong>🔒 Demo Modu:</strong> Bu ekran MagicPay hosted ödeme sayfasını simüle eder.
            Gerçek ortamda kart bilgileri bu sayfa üzerinden, MagicPay tarafından alınacaktır.
            Kyradi kart bilgilerini asla görmez/saklamaz.
          </p>
        </div>

        {/* Payment Details */}
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#0f172a" }}>
            Ödeme Detayları
          </h2>

          {paymentInfo.tenant && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.25rem" }}>
                İşletme
              </p>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                {paymentInfo.tenant.name}
              </p>
            </div>
          )}

          {paymentInfo.reservation && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.25rem" }}>
                Hizmet
              </p>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                Depo / Bavul Emanet Hizmeti
              </p>
              {paymentInfo.reservation.customer_name && (
                <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Müşteri: {paymentInfo.reservation.customer_name}
                </p>
              )}
            </div>
          )}

          <div
            style={{
              background: "#f8fafc",
              borderRadius: "12px",
              padding: "1.5rem",
              marginTop: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 500 }}>
                Toplam Tutar
              </span>
              <span
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {amount}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleSuccess}
            disabled={isProcessing}
            style={{
              width: "100%",
              padding: "1rem",
              background: isProcessing
                ? "#94a3b8"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: isProcessing ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
            }}
          >
            {isProcessing ? "İşleniyor..." : "✅ Ödemeyi Başarılı Tamamla"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            style={{
              width: "100%",
              padding: "1rem",
              background: "#fff",
              color: "#64748b",
              border: "2px solid #e2e8f0",
              borderRadius: "12px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: isProcessing ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
            }}
          >
            ❌ Ödemeyi İptal Et
          </button>
        </div>

        {/* Security Note */}
        <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", margin: 0 }}>
            🔒 SSL ile korumalı ödeme | MagicPay güvenli ödeme altyapısı
          </p>
        </div>
      </div>
    </div>
  );
}
