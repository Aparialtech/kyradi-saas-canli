import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { revenueService } from "../../../services/partner/revenue";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";

export function RevenueDashboard() {
  const { messages } = useToast();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const revenueQuery = useQuery({
    queryKey: ["revenue", "summary", dateFrom, dateTo],
    queryFn: () => revenueService.getSummary(dateFrom, dateTo),
  });

  const dailyQuery = useQuery({
    queryKey: ["revenue", "daily"],
    queryFn: () => revenueService.getDaily(),
  });

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  return (
    <section>
      <ToastContainer messages={messages} />
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Gelir ve Hakediş</h2>
        <p style={{ color: "#64748b" }}>Gelir özetleri ve hakediş detaylarını görüntüleyin</p>
      </div>

      {/* Date filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
          background: "#fff",
          padding: "1.25rem",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
            Başlangıç Tarihi
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
            Bitiş Tarihi
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
            }}
          />
        </div>
      </div>

      {/* Today's summary */}
      {dailyQuery.data && (
        <div
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Bugünkü Özet</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.5rem",
            }}
          >
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Toplam Gelir</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#16a34a" }}>
                {formatCurrency(dailyQuery.data.total_revenue_minor)}
              </p>
            </div>
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Otel Hakedişi</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1d4ed8" }}>
                {formatCurrency(dailyQuery.data.tenant_settlement_minor)}
              </p>
            </div>
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Kyradi Komisyonu</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#dc2626" }}>
                {formatCurrency(dailyQuery.data.kyradi_commission_minor)}
              </p>
            </div>
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>İşlem Sayısı</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{dailyQuery.data.transaction_count}</p>
            </div>
          </div>
        </div>
      )}

      {/* Period summary */}
      {revenueQuery.data && (dateFrom || dateTo) && (
        <div
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
            Dönem Özeti {dateFrom && dateTo && `(${dateFrom} - ${dateTo})`}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.5rem",
            }}
          >
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Toplam Gelir</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#16a34a" }}>
                {formatCurrency(revenueQuery.data.total_revenue_minor)}
              </p>
            </div>
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Otel Hakedişi</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1d4ed8" }}>
                {formatCurrency(revenueQuery.data.tenant_settlement_minor)}
              </p>
            </div>
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Kyradi Komisyonu</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#dc2626" }}>
                {formatCurrency(revenueQuery.data.kyradi_commission_minor)}
              </p>
            </div>
            <div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.25rem" }}>İşlem Sayısı</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{revenueQuery.data.transaction_count}</p>
            </div>
          </div>
        </div>
      )}

      {revenueQuery.isLoading && <div>Yükleniyor...</div>}
      {revenueQuery.isError && <div style={{ color: "#dc2626" }}>Gelir verileri yüklenemedi</div>}
    </section>
  );
}

