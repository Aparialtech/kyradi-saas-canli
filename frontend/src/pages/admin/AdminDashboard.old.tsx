import { NavLink, Outlet } from "react-router-dom";
import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/translations";

export { AdminReportsOverview } from "./reports/AdminReportsOverview";
export { TenantsPage as AdminTenantsPage } from "./tenants/TenantsPage";
export { AdminAuditLogsPage as AdminAuditPage } from "./audit/AdminAuditLogsPage";
export { AdminRevenuePage } from "./revenue/AdminRevenuePage";
export { AdminSettlementsPage } from "./settlements/AdminSettlementsPage";
export { AdminUsersPage } from "./users/AdminUsersPage";
export { AdminSettingsPage } from "./settings/AdminSettingsPage";

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigation = useMemo(() => {
    const items: Array<{ to: string; labelKey: TranslationKey; end?: boolean }> = [
      { to: "overview", labelKey: "nav.overview", end: true },
      { to: "tenants", labelKey: "nav.tenants" },
      { to: "revenue", labelKey: "nav.globalRevenue" },
      { to: "settlements", labelKey: "nav.globalSettlements" },
      { to: "users", labelKey: "nav.globalUsers" },
      { to: "settings", labelKey: "nav.systemSettings" },
      { to: "audit", labelKey: "nav.audit" },
    ];
    return items.map((item) => ({ ...item, label: t(item.labelKey) }));
  }, [t]);

  return (
    <div className="app-shell app-shell--admin">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark">KA</span>
          <span>{t("nav.brandAdmin")}</span>
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
            <p className="sidebar-heading">{t("nav.adminHeading")}</p>
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
  );
}
