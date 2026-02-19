import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { paymentScheduleService } from "../../../services/partner/paymentSchedules";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

export function TransferGatewayDemoPage() {
  const { transferId } = useParams<{ transferId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { messages, push } = useToast();
  const [processing, setProcessing] = useState(false);

  const amount = Number(searchParams.get("amount") || "0");

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!transferId) throw new Error("Transfer ID eksik");
      return paymentScheduleService.confirmTransferPayment(transferId);
    },
    onSuccess: () => {
      setProcessing(false);
      push({
        type: "success",
        title: "Ödeme tamamlandı",
        description: "Transfer admin onayına gönderildi.",
      });
      setTimeout(() => navigate("/app/transfers", { replace: true }), 1200);
    },
    onError: (error) => {
      setProcessing(false);
      push({
        type: "error",
        title: "Ödeme tamamlanamadı",
        description: getErrorMessage(error),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!transferId) throw new Error("Transfer ID eksik");
      return paymentScheduleService.cancelTransfer(transferId);
    },
    onSuccess: () => {
      setProcessing(false);
      push({
        type: "info",
        title: "Ödeme iptal edildi",
        description: "Transfer talebi iptal edildi.",
      });
      setTimeout(() => navigate("/app/transfers", { replace: true }), 1200);
    },
    onError: (error) => {
      setProcessing(false);
      push({
        type: "error",
        title: "İptal başarısız",
        description: getErrorMessage(error),
      });
    },
  });

  if (!transferId) {
    return <div className="page"><div className="empty-state">Transfer bulunamadı.</div></div>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <ToastContainer messages={messages} />
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(2, 6, 23, 0.35)",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a" }}>MagicPay</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#64748b" }}>
            Komisyon transferi ödeme ekranı
          </p>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>Transfer ID</p>
          <p style={{ margin: "0.25rem 0 0", fontFamily: "monospace", fontSize: "0.9rem", color: "#0f172a" }}>
            {transferId}
          </p>
          <p style={{ margin: "0.75rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>Tutar</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "1.4rem", fontWeight: 700, color: "#0f766e" }}>
            {formatCurrency(amount)}
          </p>
        </div>

        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: 10,
            padding: "0.75rem",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
            color: "#92400e",
          }}
        >
          Demo ekranı: Gerçek entegrasyonda kart bilgisi sağlayıcı tarafından bu adımda alınır.
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <button
            type="button"
            disabled={processing}
            onClick={() => {
              if (processing) return;
              setProcessing(true);
              confirmMutation.mutate();
            }}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "0.95rem 1rem",
              background: "linear-gradient(135deg, #0f766e 0%, #06b6d4 100%)",
              color: "#fff",
              fontWeight: 700,
              cursor: processing ? "not-allowed" : "pointer",
            }}
          >
            {processing ? "İşleniyor..." : "Ödemeyi Tamamla"}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() => {
              if (processing) return;
              setProcessing(true);
              cancelMutation.mutate();
            }}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "0.95rem 1rem",
              background: "#fff",
              color: "#475569",
              fontWeight: 600,
              cursor: processing ? "not-allowed" : "pointer",
            }}
          >
            Ödemeyi İptal Et
          </button>
        </div>
      </div>
    </div>
  );
}

