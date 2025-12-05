import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { revenueService } from "../../../services/partner/revenue";
import { locationService } from "../../../services/partner/locations";
import { storageService } from "../../../services/partner/storages";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { SearchInput } from "../../../components/common/SearchInput";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";

export function SettlementsPage() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [storageId, setStorageId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list(),
  });

  const storagesQuery = useQuery({
    queryKey: ["storages"],
    queryFn: () => storageService.list(),
  });
  
  // Filter storages by location
  const filteredStorages = useMemo(() => {
    if (!locationId) return storagesQuery.data || [];
    return (storagesQuery.data || []).filter(s => s.location_id === locationId);
  }, [storagesQuery.data, locationId]);

  const settlementsQuery = useQuery({
    queryKey: ["settlements", statusFilter, dateFrom, dateTo, locationId, storageId, searchTerm],
    queryFn: () => revenueService.listSettlements(statusFilter, dateFrom, dateTo, locationId, storageId, searchTerm),
  });

  // Get data from the new response format
  const settlements = useMemo(() => {
    return settlementsQuery.data?.items ?? [];
  }, [settlementsQuery.data]);

  const totals = useMemo(() => {
    return {
      count: settlementsQuery.data?.total_count ?? 0,
      income: settlementsQuery.data?.total_income ?? 0,
      commission: settlementsQuery.data?.total_commission ?? 0,
      payout: settlementsQuery.data?.total_payout ?? 0,
    };
  }, [settlementsQuery.data]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

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

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.settlements")}</h1>
          <p className="page-subtitle">
            Tüm hakediş kayıtlarını görüntüleyin ve filtreleyin.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {!settlementsQuery.isLoading && !settlementsQuery.isError && settlements.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
              Toplam Gelir
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-text)" }}>
              {formatCurrency(totals.income)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              {totals.count} işlem
            </div>
          </div>
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
              Otel Hakedişi
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1d4ed8" }}>
              {formatCurrency(totals.payout)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              Net ödeme tutarı
            </div>
          </div>
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
              Komisyon
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626" }}>
              {formatCurrency(totals.commission)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              Platform komisyonu
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="panel">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
            padding: "1rem",
          }}
        >
          <div style={{ minWidth: "250px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
              Ara
            </label>
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="ID veya tutar ile ara..."
            />
          </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
              {t("common.status")}
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
              <option value="">{t("common.all")}</option>
            <option value="pending">Beklemede</option>
            <option value="settled">Hesaplaştı</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
              Lokasyon
          </label>
          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setStorageId(""); // Reset storage when location changes
            }}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
            }}
          >
            <option value="">Tümü</option>
            {locationsQuery.data?.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
              Depo
          </label>
          <select
            value={storageId}
            onChange={(e) => setStorageId(e.target.value)}
            disabled={!locationId}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "1px solid #cbd5f5",
              opacity: locationId ? 1 : 0.6,
            }}
          >
            <option value="">Tümü</option>
            {filteredStorages.map((storage) => (
              <option key={storage.id} value={storage.id}>
                {storage.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.85rem" }}>
              {t("common.from")}
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
              {t("common.to")}
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
      </div>

      {/* Settlements table */}
      {settlementsQuery.isLoading ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">{t("common.loading")}</h3>
            <p>Hakediş verileri yükleniyor...</p>
          </div>
        </div>
      ) : settlementsQuery.isError ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">{t("common.error")}</h3>
            <p style={{ color: "#dc2626" }}>Hakedişler yüklenemedi. Lütfen sayfayı yenileyin.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => settlementsQuery.refetch()}
              style={{ marginTop: "1rem" }}
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      ) : settlements.length > 0 ? (
        <div className="panel">
          <div className="panel__header">
            <h2 className="panel__title">Hakediş Kayıtları</h2>
            <p className="panel__subtitle">{totals.count} kayıt bulundu</p>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
            <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Payment ID</th>
                  <th>Toplam Tutar</th>
                  <th>Otel Hakedişi</th>
                  <th>Komisyon</th>
                  <th>Oran</th>
                  <th>Durum</th>
              </tr>
            </thead>
            <tbody>
                {settlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td>{formatDate(settlement.settled_at || settlement.created_at)}</td>
                    <td>
                      <code style={{ fontSize: "0.75rem", background: "var(--color-surface)", padding: "0.15rem 0.35rem", borderRadius: "3px" }}>
                        {settlement.payment_id.slice(0, 8)}...
                      </code>
                  </td>
                    <td><strong>{formatCurrency(settlement.total_amount_minor)}</strong></td>
                    <td style={{ color: "#1d4ed8" }}>{formatCurrency(settlement.tenant_settlement_minor)}</td>
                    <td style={{ color: "#dc2626" }}>{formatCurrency(settlement.kyradi_commission_minor)}</td>
                    <td>%{settlement.commission_rate}</td>
                    <td>
                    <span
                        className={`badge ${
                          settlement.status === "settled" 
                            ? "badge--success" 
                            : settlement.status === "cancelled" 
                              ? "badge--danger" 
                              : "badge--warning"
                        }`}
                    >
                      {statusLabels[settlement.status] || settlement.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>💼</div>
            <h3 className="empty-state__title">{t("common.noData")}</h3>
            <p>Henüz hakediş kaydı bulunmuyor veya seçili filtrelerde sonuç yok.</p>
          </div>
        </div>
      )}
    </section>
  );
}

