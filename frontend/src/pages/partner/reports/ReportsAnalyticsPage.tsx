import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { partnerReportService, type PartnerOverviewResponse } from "../../../services/partner/reports";
import { useTranslation } from "../../../hooks/useTranslation";
import { getErrorMessage } from "../../../lib/httpError";

export function ReportsAnalyticsPage() {
  const { t, locale } = useTranslation();

  const overviewQuery = useQuery<PartnerOverviewResponse, Error>({
    queryKey: ["partner", "overview"],
    queryFn: () => partnerReportService.getPartnerOverview(),
  });

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("reports.title")}</h1>
          <p className="page-subtitle">{t("reports.subtitle")}</p>
        </div>
      </header>

      {/* Summary Cards */}
      {overviewQuery.isLoading ? (
        <div className="stat-grid" style={{ marginBottom: "2rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <span className="stat-card__label">{t("reports.state.loading")}</span>
              <p className="stat-card__value">...</p>
            </div>
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <div className="empty-state">
            <p style={{ color: "#dc2626" }}>{t("reports.state.error")}</p>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.5rem" }}>
              {getErrorMessage(overviewQuery.error)}
            </p>
          </div>
        </div>
      ) : overviewQuery.data ? (
        <>
          {/* Summary Cards */}
          <div className="stat-grid" style={{ marginBottom: "2rem" }}>
            <div className="stat-card">
              <span className="stat-card__icon" aria-hidden="true">
                💰
              </span>
              <span className="stat-card__label">{t("reports.summary.totalRevenue")}</span>
              <p className="stat-card__value">
                {currencyFormatter.format(overviewQuery.data.summary.total_revenue_minor / 100)}
              </p>
            </div>

            <div className="stat-card">
              <span className="stat-card__icon" aria-hidden="true">
                📦
              </span>
              <span className="stat-card__label">{t("reports.summary.totalReservations")}</span>
              <p className="stat-card__value">
                {numberFormatter.format(overviewQuery.data.summary.total_reservations)}
              </p>
            </div>

            <div className="stat-card stat-card--secondary">
              <span className="stat-card__icon" aria-hidden="true">
                ⚡
              </span>
              <span className="stat-card__label">{t("reports.summary.activeReservations")}</span>
              <p className="stat-card__value">
                {numberFormatter.format(overviewQuery.data.summary.active_reservations)}
              </p>
            </div>

            <div className="stat-card stat-card--accent">
              <span className="stat-card__icon" aria-hidden="true">
                📊
              </span>
              <span className="stat-card__label">{t("reports.summary.occupancyRate")}</span>
              <p className="stat-card__value">{overviewQuery.data.summary.occupancy_rate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Daily Revenue Chart */}
          {overviewQuery.data.daily.length > 0 && (
            <div className="panel" style={{ marginBottom: "2rem" }}>
              <div className="panel__header">
                <h2 className="panel__title">{t("reports.chart.dailyRevenue")}</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    padding: "1rem",
                    minWidth: "600px",
                    height: "200px",
                    alignItems: "flex-end",
                  }}
                >
                  {overviewQuery.data.daily.map((day, index) => {
                    const maxRevenue = Math.max(...overviewQuery.data!.daily.map((d) => d.revenue_minor), 1);
                    const height = (day.revenue_minor / maxRevenue) * 100;
                    const dateObj = new Date(day.date);
                    const formattedDate = new Intl.DateTimeFormat(locale, {
                      day: "2-digit",
                      month: "short",
                    }).format(dateObj);

                    return (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                        title={`${formattedDate}: ${currencyFormatter.format(day.revenue_minor / 100)}`}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: `${height}%`,
                            backgroundColor: "#3b82f6",
                            borderRadius: "4px 4px 0 0",
                            minHeight: height > 0 ? "4px" : "0",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "#64748b",
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                          }}
                        >
                          {formattedDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Location Revenue Table */}
          {overviewQuery.data.by_location.length > 0 && (
            <div className="panel" style={{ marginBottom: "2rem" }}>
              <div className="panel__header">
                <h2 className="panel__title">{t("reports.tables.byLocation.title")}</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.tables.byLocation.columns.location")}</th>
                      <th style={{ textAlign: "right" }}>{t("reports.tables.byLocation.columns.revenue")}</th>
                      <th style={{ textAlign: "right" }}>{t("reports.tables.byLocation.columns.reservations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.data.by_location.map((location, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{location.location_name}</strong>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {currencyFormatter.format(location.revenue_minor / 100)}
                        </td>
                        <td style={{ textAlign: "right" }}>{numberFormatter.format(location.reservations)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Storage Usage Table */}
          {overviewQuery.data.by_storage.length > 0 && (
            <div className="panel" style={{ marginBottom: "2rem" }}>
              <div className="panel__header">
                <h2 className="panel__title">{t("reports.tables.byStorage.title")}</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.tables.byStorage.columns.storage")}</th>
                      <th>{t("reports.tables.byStorage.columns.location")}</th>
                      <th style={{ textAlign: "right" }}>{t("reports.tables.byStorage.columns.reservations")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.data.by_storage.map((storage, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{storage.storage_code}</strong>
                        </td>
                        <td>{storage.location_name}</td>
                        <td style={{ textAlign: "right" }}>{numberFormatter.format(storage.reservations)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State if no data */}
          {overviewQuery.data.daily.length === 0 &&
            overviewQuery.data.by_location.length === 0 &&
            overviewQuery.data.by_storage.length === 0 && (
              <div className="panel">
                <div className="empty-state">
                  <p>{t("reports.state.empty")}</p>
                </div>
              </div>
            )}
        </>
      ) : null}
    </section>
  );
}

