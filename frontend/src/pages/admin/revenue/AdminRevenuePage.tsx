import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../../hooks/useTranslation";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";

interface RevenueSummary {
  total_revenue_minor: number;
  tenant_settlement_minor: number;
  kyradi_commission_minor: number;
  transaction_count: number;
}

export function AdminRevenuePage() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const revenueQuery = useQuery({
    queryKey: ["admin", "revenue", selectedTenantId, dateFrom, dateTo],
    queryFn: async (): Promise<RevenueSummary> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const response = await http.get<RevenueSummary>("/admin/revenue/summary", { params });
      return response.data;
    },
  });

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.globalRevenue")}</h1>
          <p className="page-subtitle">{t("common.allHotels" as any)} gelir özeti ve detaylı hakediş kayıtları</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">Filtreler</h3>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <label className="form-field">
            <span className="form-field__label">{t("common.hotel")} Seç</span>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">{t("common.allHotels" as any)}</option>
              {tenantsQuery.data?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Başlangıç Tarihi</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Bitiş Tarihi</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__icon" aria-hidden="true">
            💰
          </span>
          <span className="stat-card__label">Toplam Ciro</span>
          <p className="stat-card__value">
            {revenueQuery.isLoading
              ? "..."
              : `₺ ${((revenueQuery.data?.total_revenue_minor ?? 0) / 100).toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </p>
          <p className="stat-card__hint">Seçili filtreler için toplam gelir</p>
        </div>

        <div className="stat-card stat-card--secondary">
          <span className="stat-card__icon" aria-hidden="true">
            🏨
          </span>
          <span className="stat-card__label">Otel Hakedişi</span>
          <p className="stat-card__value">
            {revenueQuery.isLoading
              ? "..."
              : `₺ ${((revenueQuery.data?.tenant_settlement_minor ?? 0) / 100).toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </p>
          <p className="stat-card__hint">Tenant'lara ödenecek toplam tutar</p>
        </div>

        <div className="stat-card stat-card--accent">
          <span className="stat-card__icon" aria-hidden="true">
            📊
          </span>
          <span className="stat-card__label">Kyradi Komisyonu</span>
          <p className="stat-card__value">
            {revenueQuery.isLoading
              ? "..."
              : `₺ ${((revenueQuery.data?.kyradi_commission_minor ?? 0) / 100).toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </p>
          <p className="stat-card__hint">Platform komisyon geliri</p>
        </div>

        <div className="stat-card">
          <span className="stat-card__icon" aria-hidden="true">
            🔢
          </span>
          <span className="stat-card__label">İşlem Sayısı</span>
          <p className="stat-card__value">{revenueQuery.data?.transaction_count ?? 0}</p>
          <p className="stat-card__hint">Tamamlanan ödeme işlemi sayısı</p>
        </div>
      </div>

      {revenueQuery.isError && (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">Gelir verileri alınamadı</h3>
            <p className="field-error">Lütfen daha sonra tekrar deneyin veya filtreleri değiştirin.</p>
          </div>
        </div>
      )}
      
      {!revenueQuery.isLoading && !revenueQuery.isError && revenueQuery.data && revenueQuery.data.transaction_count === 0 && (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
            <h3 className="empty-state__title">Henüz gelir kaydı yok</h3>
            <p>Seçili tarih aralığında henüz ödeme işlemi gerçekleşmemiş.</p>
          </div>
        </div>
      )}
    </section>
  );
}
