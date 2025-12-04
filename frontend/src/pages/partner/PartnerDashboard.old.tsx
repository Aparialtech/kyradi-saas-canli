import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../context/AuthContext";
import { partnerReportService, type PartnerSummary } from "../../services/partner/reports";
import { useToast } from "../../hooks/useToast";
import { useTranslation } from "../../hooks/useTranslation";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { Modal } from "../../components/common/Modal";
import { KyradiChat } from "../../components/KyradiChat";
import { FloatingChatWidget } from "../../components/FloatingChatWidget";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { env } from "../../config/env";
import type { TranslationKey } from "../../i18n/translations";

const warningActions: Record<
  string,
  { labelKey: TranslationKey; descriptionKey: TranslationKey; href: string; variant?: "primary" | "secondary" }
> = {
  "aktif rezervasyon": {
    labelKey: "partner.warning.planUpgrade.label",
    descriptionKey: "partner.warning.planUpgrade.desc",
    href: "mailto:support@kyradi.com?subject=Plan%20Yukseltme",
    variant: "primary",
  },
  "toplam rezervasyon": {
    labelKey: "partner.warning.archive.label",
    descriptionKey: "partner.warning.archive.desc",
    href: "https://docs.kyradi.com/guide/archive-reservations",
  },
  "rapor export": {
    labelKey: "partner.warning.export.label",
    descriptionKey: "partner.warning.export.desc",
    href: "https://docs.kyradi.com/guide/report-export",
  },
  "self-service rezervasyon": {
    labelKey: "partner.warning.selfService.label",
    descriptionKey: "partner.warning.selfService.desc",
    href: "mailto:support@kyradi.com?subject=Self%20service%20kota",
    variant: "primary",
  },
  depolama: {
    labelKey: "partner.warning.storage.label",
    descriptionKey: "partner.warning.storage.desc",
    href: "https://docs.kyradi.com/guide/storage-cleanup",
  },
};

export function PartnerOverview() {
  const { messages, push } = useToast();
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportTopic, setSupportTopic] = useState("plan_upgrade");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportContact, setSupportContact] = useState(user?.email ?? "");
  const summaryQuery = useQuery<PartnerSummary, Error>({
    queryKey: ["partner", "summary"],
    queryFn: () => partnerReportService.summary(),
  });

  useEffect(() => {
    if (summaryQuery.error) {
      push({
        title: t("partner.toast.summaryError"),
        description: getErrorMessage(summaryQuery.error),
        type: "error",
      });
    }
  }, [summaryQuery.error, push, t]);
  useEffect(() => {
    setSupportContact(user?.email ?? "");
  }, [user?.email]);

  const activeReservations = summaryQuery.data?.active_reservations ?? 0;
  const occupancyPct = summaryQuery.data?.locker_occupancy_pct ?? 0;
  const revenueMinor = summaryQuery.data?.today_revenue_minor ?? 0;

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

  const statItems = useMemo(() => {
    const totalLimit =
      summaryQuery.data?.plan_limits?.max_reservations_total != null
        ? t("partner.stats.totalHintLimit", {
            value: summaryQuery.data.plan_limits.max_reservations_total.toLocaleString(locale),
          })
        : t("partner.stats.totalHintUnlimited");
    const storageLimit =
      summaryQuery.data?.plan_limits?.max_storage_mb != null
        ? t("partner.stats.storageHintLimit", {
            value: summaryQuery.data.plan_limits.max_storage_mb,
          })
        : t("partner.stats.storageHintUnlimited");
    return [
      {
        label: t("partner.stats.activeLabel"),
        value: summaryQuery.isPending ? "..." : activeReservations.toLocaleString(locale),
        hint: t("partner.stats.activeHint"),
        icon: "📦",
        variant: "",
      },
      {
        label: t("partner.stats.occupancyLabel"),
        value: summaryQuery.isPending
          ? "..."
          : `${occupancyPct.toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
        hint: t("partner.stats.occupancyHint"),
        icon: "📊",
        variant: "stat-card--secondary",
      },
      {
        label: t("partner.stats.revenueLabel"),
        value: summaryQuery.isPending ? "..." : currencyFormatter.format(revenueMinor / 100),
        hint: t("partner.stats.revenueHint"),
        icon: "💳",
        variant: "stat-card--accent",
      },
      {
        label: t("partner.stats.totalLabel"),
        value: summaryQuery.isPending
          ? "..."
          : (summaryQuery.data?.total_reservations ?? 0).toLocaleString(locale),
        hint: totalLimit,
        icon: "🧾",
        variant: "",
      },
      {
        label: t("partner.stats.storageLabel"),
        value: summaryQuery.isPending
          ? "..."
          : `${summaryQuery.data?.storage_used_mb ?? 0} MB`,
        hint: storageLimit,
        icon: "💾",
        variant: "",
      },
    ];
  }, [
    summaryQuery.isPending,
    activeReservations,
    occupancyPct,
    revenueMinor,
    summaryQuery.data,
    locale,
    currencyFormatter,
    t,
  ]);

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">{t("partner.overview.title")}</h2>
            <p className="panel__subtitle">{t("partner.overview.subtitle")}</p>
          </div>
        </div>
        <div className="stat-grid">
          {statItems.map((item) => (
            <div key={item.label} className={["stat-card", item.variant].filter(Boolean).join(" ")}>
              <span className="stat-card__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="stat-card__label">{item.label}</span>
              <p className="stat-card__value">{item.value}</p>
              <p className="stat-card__hint">{item.hint}</p>
            </div>
          ))}
        </div>
        {summaryQuery.data?.warnings && summaryQuery.data.warnings.length > 0 && (
          <div className="panel panel--muted">
            <h3 style={{ marginTop: 0 }}>{t("partner.planWarnings.title")}</h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {summaryQuery.data.warnings.map((warning) => (
                <li key={warning.type} style={{ marginBottom: "0.75rem", color: "#b45309" }}>
                  <div>
                    <strong>{warning.type}:</strong> {warning.message}
                    {warning.remaining != null && (
                      <span>
                        {" "}
                        ({t("partner.warning.remaining")}: {warning.remaining.toLocaleString(locale)})
                      </span>
                    )}
                  </div>
                  {(() => {
                    const action = warningActions[warning.type.toLowerCase()];
                    if (!action) return null;
                    return (
                      <div style={{ marginTop: "0.35rem" }}>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
                          {t(action.descriptionKey)}
                        </p>
                        <a
                          className={`action-link ${action.variant === "primary" ? "action-link--primary" : ""}`}
                          href={action.href}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {t(action.labelKey)}
                        </a>
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn--primary"
              style={{ alignSelf: "flex-start", marginTop: "0.75rem" }}
              onClick={() => setSupportModalOpen(true)}
            >
              {t("partner.planWarnings.button")}
            </button>
          </div>
        )}
        {user?.tenant_id && (
          <div className="panel panel--muted">
            <div className="panel__header">
              <div>
                <h3 className="panel__title">{t("partner.assistant.title")}</h3>
                <p className="panel__subtitle">{t("partner.assistant.subtitle")}</p>
              </div>
            </div>
            <KyradiChat
              apiBase={env.API_URL}
              tenantId={user.tenant_id}
              userId={user.id}
              locale={locale}
              theme="light"
            />
          </div>
        )}
        {summaryQuery.data && (
          <div className="plan-inline-cards">
            <div className="plan-inline-card">
              <h4>{t("partner.cards.report.title")}</h4>
              <p>
                {summaryQuery.data.report_exports_today}/
                {summaryQuery.data.plan_limits.max_report_exports_daily ?? "∞"}
              </p>
              <p className="plan-inline-card__hint">
                {t("partner.cards.report.hint")}:{" "}
                {summaryQuery.data.report_exports_remaining != null
                  ? summaryQuery.data.report_exports_remaining
                  : t("partner.cards.unlimited")}
              </p>
              <p className="plan-inline-card__hint">
                {t("partner.cards.report.reset")}{" "}
                {new Date(summaryQuery.data.report_exports_reset_at).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="plan-inline-card">
              <h4>{t("partner.cards.self.title")}</h4>
              {summaryQuery.data.plan_limits.max_self_service_daily != null ? (
                <>
                  <p>
                    {(summaryQuery.data.plan_limits.max_self_service_daily ?? 0) -
                      (summaryQuery.data.self_service_remaining ?? 0)}
                    /{summaryQuery.data.plan_limits.max_self_service_daily}
                  </p>
                  <p className="plan-inline-card__hint">
                    {t("partner.cards.self.remaining")}: {summaryQuery.data.self_service_remaining ?? 0}
                  </p>
                </>
              ) : (
                <>
                  <p>{t("partner.cards.unlimited")}</p>
                  <p className="plan-inline-card__hint">{t("partner.cards.self.unlimited")}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {supportModalOpen && (
        <Modal
          isOpen
          onClose={() => setSupportModalOpen(false)}
          title={t("partner.support.modalTitle")}
          width="520px"
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const subject = encodeURIComponent(`${t("partner.support.subject")} (${supportTopic})`);
              const body = encodeURIComponent(
                `Tenant: ${user?.tenant_id ?? "-"}\nKullanıcı: ${supportContact}\n\nMesaj:\n${supportMessage || "(boş)"}`,
              );
              window.open(`mailto:support@kyradi.com?subject=${subject}&body=${body}`, "_blank");
              push({ title: t("partner.toast.supportReady"), type: "success" });
              setSupportModalOpen(false);
              setSupportMessage("");
            }}
          >
            <label className="form-field">
              <span className="form-field__label">{t("partner.support.topicLabel")}</span>
              <select value={supportTopic} onChange={(event) => setSupportTopic(event.target.value)}>
                <option value="plan_upgrade">{t("partner.support.topic.planUpgrade")}</option>
                <option value="storage_cleanup">{t("partner.support.topic.storage")}</option>
                <option value="self_service_quota">{t("partner.support.topic.selfService")}</option>
                <option value="other">{t("partner.support.topic.other")}</option>
              </select>
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">{t("partner.support.contactLabel")}</span>
              <input
                type="email"
                value={supportContact}
                onChange={(event) => setSupportContact(event.target.value)}
                required
              />
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">{t("partner.support.messageLabel")}</span>
              <textarea
                value={supportMessage}
                onChange={(event) => setSupportMessage(event.target.value)}
                rows={4}
                placeholder={t("partner.support.messagePlaceholder")}
              />
            </label>
            <div className="form-actions form-grid__field--full">
              <button type="button" className="btn btn--ghost-dark" onClick={() => setSupportModalOpen(false)}>
                {t("partner.support.cancel")}
              </button>
              <button type="submit" className="btn btn--primary">
                {t("partner.support.submit")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

export { LocationsPage as PartnerLocationsPlaceholder } from "./locations/LocationsPage";
export { ReservationsPage as PartnerReservationsPage } from "./reservations/ReservationsPage";
export { QRVerificationPage as PartnerQRPage } from "./qr/QRVerificationPage";
export { LockersPage as PartnerLockersPage } from "./lockers/LockersPage";
export { ReportsAnalyticsPage as PartnerReportsAnalyticsPage } from "./reports/ReportsAnalyticsPage";
export { RevenueDashboard as PartnerRevenueDashboard } from "./revenue/RevenueDashboard";
export { SettlementsPage as PartnerSettlementsPage } from "./revenue/SettlementsPage";
export { StaffPage as PartnerStaffPage } from "./staff/StaffPage";
export { PricingPage as PartnerPricingPage } from "./pricing/PricingPage";
export { UsersPage as PartnerUsersPage } from "./users/UsersPage";
export { DemoFlowPage } from "./DemoFlowPage";
export { DemoPaymentFlowPage } from "./DemoPaymentFlowPage";
export { PartnerSettingsPage } from "./settings/PartnerSettingsPage";

export function PartnerDashboard() {
  const { user, logout, hasRole } = useAuth();
  const { t } = useTranslation();

  const navigation = useMemo(() => {
    const items: Array<{ to: string; labelKey: TranslationKey; end?: boolean }> = [
      { to: ".", labelKey: "nav.overview", end: true },
      { to: "locations", labelKey: "nav.locations" },
      { to: "lockers", labelKey: "nav.storages" },
      { to: "reservations", labelKey: "nav.reservations" },
      { to: "qr", labelKey: "nav.qr" },
    ];
    
    // Accounting and hotel manager can see revenue
    if (hasRole("accounting") || hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "reports", labelKey: "nav.reports" });
      items.push({ to: "revenue", labelKey: "nav.revenue" });
      items.push({ to: "settlements", labelKey: "nav.settlements" });
    }
    
    // Hotel manager and tenant admin can manage users and staff
    if (hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "users", labelKey: "nav.users" });
      items.push({ to: "staff", labelKey: "nav.staff" });
      items.push({ to: "pricing", labelKey: "nav.pricing" });
      items.push({ to: "demo-flow", labelKey: "nav.demoFlow" });
    }
    
    // All authenticated users can access settings
    items.push({ to: "settings", labelKey: "nav.settings" });
    
    return items.map((item) => ({ ...item, label: t(item.labelKey) }));
  }, [hasRole, t]);

  return (
    <>
      <div className="app-shell app-shell--partner">
        <header className="app-shell__header">
          <div className="app-shell__brand">
            <span className="app-shell__brand-mark">KY</span>
            <span>{t("nav.brandPartner")}</span>
          </div>
          <div className="app-shell__user">
            <LanguageSwitcher />
            <span>{user?.email}</span>
            <button className="btn btn--ghost" onClick={logout}>
              {t("nav.logout")}
            </button>
          </div>
        </header>

        <div className="app-shell__body">
          <aside className="app-shell__sidebar">
            <div>
              <p className="sidebar-heading">{t("nav.menu")}</p>
            </div>
            <nav className="sidebar-nav">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="app-shell__main">
            <Outlet />
          </main>
        </div>
      </div>
      <FloatingChatWidget />
    </>
  );
}
