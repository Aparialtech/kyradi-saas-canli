import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { adminReportService } from "../../../services/admin/reports";
import { adminTenantService } from "../../../services/admin/tenants";
import type { Tenant } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useTranslation } from "../../../hooks/useTranslation";

export function AdminReportsOverview() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const summaryQuery = useQuery({ queryKey: ["admin", "summary"], queryFn: adminReportService.summary });
  const tenantsQuery = useQuery({ queryKey: ["admin", "tenants"], queryFn: adminTenantService.list });

  const tenantsById = useMemo(() => {
    const map = new Map<string, Tenant>();
    for (const tenant of tenantsQuery.data ?? []) {
      map.set(tenant.id, tenant);
    }
    return map;
  }, [tenantsQuery.data]);

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("admin.dashboard.title")}</h1>
          <p className="page-subtitle">{t("admin.dashboard.subtitle")}</p>
        </div>
      </div>

      {/* Global KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__icon" aria-hidden="true">
            🏢
          </span>
          <span className="stat-card__label">{t("admin.dashboard.totalHotels")}</span>
          <p className="stat-card__value">
            {summaryQuery.isLoading ? "..." : summaryQuery.data?.total_tenants ?? "-"}
          </p>
          <p className="stat-card__hint">
            {summaryQuery.data?.active_tenants ?? 0} {t("admin.dashboard.activeHotels").toLowerCase()},{" "}
            {(summaryQuery.data?.total_tenants ?? 0) - (summaryQuery.data?.active_tenants ?? 0)} pasif
          </p>
        </div>

        <div className="stat-card stat-card--secondary">
          <span className="stat-card__icon" aria-hidden="true">
            👥
          </span>
          <span className="stat-card__label">{t("admin.dashboard.totalUsers")}</span>
          <p className="stat-card__value">
            {summaryQuery.isLoading ? "..." : summaryQuery.data?.total_users ?? "-"}
          </p>
          <p className="stat-card__hint">{t("admin.dashboard.totalUsers")} - {t("common.hotel")} bazlı</p>
        </div>

        <div className="stat-card stat-card--accent">
          <span className="stat-card__icon" aria-hidden="true">
            📦
          </span>
          <span className="stat-card__label">{t("admin.dashboard.reservations24h")}</span>
          <p className="stat-card__value">
            {summaryQuery.isLoading ? "..." : summaryQuery.data?.reservations_24h ?? "-"}
          </p>
          <p className="stat-card__hint">
            {t("admin.dashboard.reservations7d")}: {summaryQuery.data?.reservations_7d ?? 0}
          </p>
        </div>

        <div className="stat-card">
          <span className="stat-card__icon" aria-hidden="true">
            💰
          </span>
          <span className="stat-card__label">{t("admin.dashboard.totalRevenue")} (30g)</span>
          <p className="stat-card__value">
            {summaryQuery.isLoading
              ? "..."
              : `₺ ${((summaryQuery.data?.total_revenue_minor ?? 0) / 100).toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </p>
          <p className="stat-card__hint">
            {t("admin.dashboard.totalCommission")}: ₺{" "}
            {((summaryQuery.data?.total_commission_minor ?? 0) / 100).toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="stat-card stat-card--secondary">
          <span className="stat-card__icon" aria-hidden="true">
            📦
          </span>
          <span className="stat-card__label">{t("admin.dashboard.totalStorages")}</span>
          <p className="stat-card__value">
            {summaryQuery.isLoading ? "..." : summaryQuery.data?.total_storages ?? "-"}
          </p>
          <p className="stat-card__hint">{t("common.storages")} - {t("common.allHotels" as any)}</p>
        </div>
      </div>

      {/* System Health */}
      {summaryQuery.data?.system_health && (
        <div className="panel">
          <div className="panel__header">
            <div>
              <h3 className="panel__title">{t("admin.dashboard.systemHealth")}</h3>
              <p className="panel__subtitle">Servis durumları ve son hatalar</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div style={{ padding: "1rem", background: "var(--color-surface)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>📧</span>
                <strong>Email Servisi</strong>
              </div>
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background:
                    summaryQuery.data.system_health.email_service_status === "ok"
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  color:
                    summaryQuery.data.system_health.email_service_status === "ok"
                      ? "#10b981"
                      : "#ef4444",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                {summaryQuery.data.system_health.email_service_status === "ok" ? "✓ Çalışıyor" : "✗ Hata"}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "var(--color-surface)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>💬</span>
                <strong>SMS Servisi</strong>
              </div>
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background:
                    summaryQuery.data.system_health.sms_service_status === "ok"
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  color:
                    summaryQuery.data.system_health.sms_service_status === "ok" ? "#10b981" : "#ef4444",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                {summaryQuery.data.system_health.sms_service_status === "ok" ? "✓ Çalışıyor" : "✗ Hata"}
              </div>
            </div>
            <div style={{ padding: "1rem", background: "var(--color-surface)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>💳</span>
                <strong>Ödeme Gateway</strong>
              </div>
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background:
                    summaryQuery.data.system_health.payment_provider_status === "ok"
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  color:
                    summaryQuery.data.system_health.payment_provider_status === "ok" ? "#10b981" : "#ef4444",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                {summaryQuery.data.system_health.payment_provider_status === "ok" ? "✓ Çalışıyor" : "✗ Hata"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 5 Tenants */}
      {summaryQuery.data?.top_tenants && summaryQuery.data.top_tenants.length > 0 && (
        <div className="panel">
          <div className="panel__header">
            <div>
              <h3 className="panel__title">{t("admin.dashboard.topTenants")} (Son 30 Gün)</h3>
              <p className="panel__subtitle">Top 5 {t("common.hotel")} performans özeti</p>
            </div>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>{t("common.hotel")}</th>
                  <th>{t("admin.dashboard.totalRevenue")}</th>
                  <th>{t("admin.dashboard.totalCommission")}</th>
                </tr>
              </thead>
              <tbody>
                {summaryQuery.data.top_tenants.map((tenant, index) => (
                  <tr key={tenant.tenant_id}>
                    <td>
                      <strong>#{index + 1}</strong>
                    </td>
                    <td>
                      <strong>{tenant.tenant_name}</strong>
                    </td>
                    <td>
                      ₺ {(tenant.revenue_minor / 100).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      ₺ {(tenant.commission_minor / 100).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tenant Activities */}
      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">{t("admin.dashboard.tenantActivities")}</h3>
            <p className="panel__subtitle">
              Günlük özet: {t("common.hotel")} bazlı gelir ve rezervasyon sayıları.
            </p>
          </div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("common.hotel")}</th>
                <th>Bugünkü Gelir</th>
                <th>Aktif Rezervasyon</th>
                <th>30 Günlük Ciro</th>
                <th>30 Günlük Komisyon</th>
              </tr>
            </thead>
            <tbody>
              {summaryQuery.isLoading ? (
                <tr>
                  <td colSpan={5}>Veriler yükleniyor...</td>
                </tr>
              ) : summaryQuery.data?.tenants && summaryQuery.data.tenants.length > 0 ? (
                summaryQuery.data.tenants.map((tenantSummary) => {
                  const tenantInfo = tenantsById.get(tenantSummary.tenant_id);
                  return (
                    <tr key={tenantSummary.tenant_id}>
                      <td>
                        <strong>{tenantSummary.tenant_name ?? tenantInfo?.name ?? `Bilinmeyen ${t("common.hotel")}`}</strong>
                        <div className="table-cell-muted">
                          {t("common.shortName")}: {tenantSummary.tenant_slug ?? tenantInfo?.slug ?? tenantSummary.tenant_id.slice(0, 8)}
                        </div>
                      </td>
                      <td>
                        ₺ {(tenantSummary.today_revenue_minor / 100).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>{tenantSummary.active_reservations}</td>
                      <td>
                        ₺ {(tenantSummary.total_revenue_30d_minor / 100).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        ₺ {(tenantSummary.total_commission_30d_minor / 100).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>Veri bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {summaryQuery.isError && (
        <div className="panel">
          <p className="field-error">Rapor verileri alınamadı. Lütfen daha sonra tekrar deneyin.</p>
        </div>
      )}
    </section>
  );
}
