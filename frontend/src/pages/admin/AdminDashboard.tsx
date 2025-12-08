import { Outlet } from "react-router-dom";
import { useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { useTranslation } from "../../hooks/useTranslation";

// Modern UI Components (same as Partner Panel)
import { ModernSidebar, type ModernSidebarNavItem } from "../../components/layout/ModernSidebar";
import { ModernNavbar } from "../../components/layout/ModernNavbar";
import {
  Building2,
  BarChart3,
  Receipt,
  Users,
  Settings,
  FileText,
  CreditCard,
  TrendingUp,
  FileInvoice,
} from "../../lib/lucide";

export { AdminReportsOverview } from "./reports/AdminReportsOverview";
export { AdminReportsAnalyticsPage } from "./reports/AdminReportsAnalyticsPage";
export { AdminInvoicePage } from "./invoice/AdminInvoicePage";
export { TenantsPage as AdminTenantsPage } from "./tenants/TenantsPage";
export { AdminAuditLogsPage as AdminAuditPage } from "./audit/AdminAuditLogsPage";
export { AdminRevenuePage } from "./revenue/AdminRevenuePage";
export { AdminSettlementsPage } from "./settlements/AdminSettlementsPage";
export { AdminUsersPage } from "./users/AdminUsersPage";
export { AdminSettingsPage } from "./settings/AdminSettingsPage";

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const modernNavigation = useMemo((): ModernSidebarNavItem[] => {
    const items: ModernSidebarNavItem[] = [
      { to: ".", label: t("nav.overview"), end: true, icon: <BarChart3 className="h-5 w-5" /> },
      { to: "reports", label: "Raporlar ve Analiz", icon: <TrendingUp className="h-5 w-5" /> },
      { to: "invoice", label: "Fatura Oluştur", icon: <FileInvoice className="h-5 w-5" /> },
      { to: "tenants", label: t("nav.tenants"), icon: <Building2 className="h-5 w-5" /> },
      { to: "revenue", label: t("nav.globalRevenue"), icon: <Receipt className="h-5 w-5" /> },
      { to: "settlements", label: t("nav.globalSettlements"), icon: <CreditCard className="h-5 w-5" /> },
      { to: "users", label: t("nav.globalUsers"), icon: <Users className="h-5 w-5" /> },
      { to: "settings", label: t("nav.systemSettings"), icon: <Settings className="h-5 w-5" /> },
      { to: "audit", label: t("nav.audit"), icon: <FileText className="h-5 w-5" /> },
    ];
    return items;
  }, [t]);

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', background: 'var(--bg-secondary)' }}>
        {/* Modern Sidebar (same as Partner Panel) */}
        <ModernSidebar
          items={modernNavigation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          brandName="KYRADI"
        />

        {/* Main Content */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          width: '100%',
          minWidth: 0,
          marginLeft: sidebarOpen ? '280px' : '80px',
          transition: 'margin-left 0.2s',
        }}
        className="main-content"
        >
          {/* Modern Navbar (same as Partner Panel) */}
          <ModernNavbar
            title="Admin Panel"
            subtitle={t("nav.adminHeading")}
            userName={user?.email ?? 'Admin'}
            userRole="Super Admin"
            onLogout={logout}
            actions={<LanguageSwitcher />}
          />

          {/* Page Content */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative', padding: 'var(--space-8)' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}

