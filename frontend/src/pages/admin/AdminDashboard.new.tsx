import { Outlet } from "react-router-dom";
import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/translations";

// New Premium UI Components
import { AppLayout, AppLayoutBody, AppLayoutMain } from "../../components/layout/AppLayout";
import { TopNav } from "../../components/layout/TopNav";
import { Sidebar, type SidebarNavItem } from "../../components/layout/Sidebar";

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
  
  const navigation = useMemo((): SidebarNavItem[] => {
    const items: Array<{ to: string; labelKey: TranslationKey; end?: boolean }> = [
      { to: "overview", labelKey: "nav.overview", end: true },
      { to: "tenants", labelKey: "nav.tenants" },
      { to: "revenue", labelKey: "nav.globalRevenue" },
      { to: "settlements", labelKey: "nav.globalSettlements" },
      { to: "users", labelKey: "nav.globalUsers" },
      { to: "settings", labelKey: "nav.systemSettings" },
      { to: "audit", labelKey: "nav.audit" },
    ];
    return items.map((item) => ({ to: item.to, label: t(item.labelKey), end: item.end }));
  }, [t]);

  return (
    <AppLayout variant="admin">
      <TopNav
        variant="admin"
        brandMark="KA"
        brandText={t("nav.brandAdmin")}
        userEmail={user?.email}
        onLogout={logout}
      >
        <LanguageSwitcher />
      </TopNav>

      <AppLayoutBody>
        <Sidebar items={navigation} heading={t("nav.adminHeading")} />
        
        <AppLayoutMain>
          <Outlet />
        </AppLayoutMain>
      </AppLayoutBody>
    </AppLayout>
  );
}

