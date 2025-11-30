import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { revenueService } from "../../../services/partner/revenue";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useToast } from "../../../hooks/useToast";

export function SettlementsPage() {
  const { messages } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const settlementsQuery = useQuery({
    queryKey: ["settlements", statusFilter, dateFrom, dateTo],
    queryFn: () => revenueService.listSettlements(statusFilter, dateFrom, dateTo),
  });

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("tr-TR");
  };

  const statusLabels: Record<string, string> = {
    pending: "Beklemede",
    settled: "Hesaplaştı",
    cancelled: "İptal",
  };

  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    settled: "#16a34a",
    cancelled: "#dc2626",
  };

  return (
    <section>
      <ToastContainer messages={messages} />
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Hakedişler</h2>
        <p style={{ color: "#64748b" }}>Tüm hakediş kayıtlarını görüntüleyin ve filtreleyin</p>
      </div>

      {/* Filters */}
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
            Durum
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
            }}
          >
            <option value="">Tümü</option>
            <option value="pending">Beklemede</option>
            <option value="settled">Hesaplaştı</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>
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

      {/* Settlements table */}
      {settlementsQuery.isLoading ? (
        <div>Yükleniyor...</div>
      ) : settlementsQuery.isError ? (
        <div style={{ color: "#dc2626" }}>Hakedişler yüklenemedi</div>
      ) : settlementsQuery.data && settlementsQuery.data.length > 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Tarih
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Toplam Tutar
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Otel Hakedişi
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Komisyon
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Komisyon Oranı
                </th>
                <th style={{ padding: "1rem", textAlign: "left", fontSize: "0.85rem", color: "#475569" }}>
                  Durum
                </th>
              </tr>
            </thead>
            <tbody>
              {settlementsQuery.data.map((settlement) => (
                <tr key={settlement.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "1rem", fontSize: "0.9rem" }}>
                    {formatDate(settlement.settled_at || settlement.created_at)}
                  </td>
                  <td style={{ padding: "1rem", fontSize: "0.9rem", fontWeight: 600 }}>
                    {formatCurrency(settlement.total_amount_minor)}
                  </td>
                  <td style={{ padding: "1rem", fontSize: "0.9rem", color: "#1d4ed8" }}>
                    {formatCurrency(settlement.tenant_settlement_minor)}
                  </td>
                  <td style={{ padding: "1rem", fontSize: "0.9rem", color: "#dc2626" }}>
                    {formatCurrency(settlement.kyradi_commission_minor)}
                  </td>
                  <td style={{ padding: "1rem", fontSize: "0.9rem" }}>%{settlement.commission_rate}</td>
                  <td style={{ padding: "1rem" }}>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: statusColors[settlement.status] + "20",
                        color: statusColors[settlement.status],
                      }}
                    >
                      {statusLabels[settlement.status] || settlement.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            padding: "3rem",
            borderRadius: "12px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <p>Henüz hakediş kaydı bulunmuyor</p>
        </div>
      )}
    </section>
  );
}

