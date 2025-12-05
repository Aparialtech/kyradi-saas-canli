import { Outlet } from "react-router-dom";
import { useMemo } from "react";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { useTranslation } from "../../hooks/useTranslation";
import type { TranslationKey } from "../../i18n/translations";

// Shared Layout Components
import { DashboardShell } from "../../components/layout/DashboardShell";
import { SidebarNav, type SidebarNavItem } from "../../components/layout/SidebarNav";
import { TopBar } from "../../components/layout/TopBar";
import {
  Building2,
  BarChart3,
  Receipt,
  Users,
  Settings,
  Database,
  FileText,
  CreditCard,
} from "../../lib/lucide";
import styles from "./AdminDashboard.module.css";

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
    const items: Array<{ to: string; labelKey: TranslationKey; icon: React.ReactNode; end?: boolean }> = [
      { to: "overview", labelKey: "nav.overview", icon: <BarChart3 className="h-5 w-5" />, end: true },
      { to: "tenants", labelKey: "nav.tenants", icon: <Building2 className="h-5 w-5" /> },
      { to: "revenue", labelKey: "nav.globalRevenue", icon: <Receipt className="h-5 w-5" /> },
      { to: "settlements", labelKey: "nav.globalSettlements", icon: <CreditCard className="h-5 w-5" /> },
      { to: "users", labelKey: "nav.globalUsers", icon: <Users className="h-5 w-5" /> },
      { to: "settings", labelKey: "nav.systemSettings", icon: <Settings className="h-5 w-5" /> },
      { to: "audit", labelKey: "nav.audit", icon: <FileText className="h-5 w-5" /> },
    ];
    return items.map((item) => ({ to: item.to, label: t(item.labelKey), icon: item.icon, end: item.end }));
  }, [t]);

  return (
    <DashboardShell variant="admin">
      <TopBar
        variant="admin"
        title={t("nav.brandAdmin")}
        userEmail={user?.email}
        userName={user?.email?.split("@")[0]}
        onLogout={logout}
        actions={<LanguageSwitcher />}
      />
      
      <div className={styles.layoutBody}>
        <SidebarNav
          variant="admin"
          items={navigation}
          heading={t("nav.adminHeading")}
          brandName="KYRADI"
        />
        
        <main className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </DashboardShell>
  );
}

