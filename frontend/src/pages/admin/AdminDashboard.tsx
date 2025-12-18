import { Outlet, useNavigate } from "react-router-dom";
import { useMemo, useState, useCallback } from "react";

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
  Mail,
} from "../../lib/lucide";

// UX Enhancement Components
import { QuickActions, useQuickActionsShortcut } from "../../components/common/QuickActions";
import { Breadcrumbs } from "../../components/common/Breadcrumbs";
import { ConfirmProvider } from "../../components/common/ConfirmDialog";

export { AdminReportsOverview } from "./reports/AdminReportsOverview";
export { AdminReportsAnalyticsPage } from "./reports/AdminReportsAnalyticsPage";
export { AdminInvoicePage } from "./invoice/AdminInvoicePage";
export { TenantsPage as AdminTenantsPage } from "./tenants/TenantsPage";
export { AdminAuditLogsPage as AdminAuditPage } from "./audit/AdminAuditLogsPage";
export { AdminRevenuePage } from "./revenue/AdminRevenuePage";
export { AdminSettlementsPage } from "./settlements/AdminSettlementsPage";
export { AdminUsersPage } from "./users/AdminUsersPage";
export { AdminEmailPage } from "./email/AdminEmailPage";
export { AdminSettingsPage } from "./settings/AdminSettingsPage";

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Keyboard shortcut for Quick Actions (Cmd+K / Ctrl+K)
  useQuickActionsShortcut(useCallback(() => setQuickActionsOpen(true), []));
  
  const modernNavigation = useMemo((): ModernSidebarNavItem[] => {
    const items: ModernSidebarNavItem[] = [
      { to: ".", label: t("nav.overview"), end: true, icon: <BarChart3 className="h-5 w-5" /> },
      { to: "reports", label: "Raporlar ve Analiz", icon: <TrendingUp className="h-5 w-5" /> },
      { to: "invoice", label: "Fatura Oluştur", icon: <Receipt className="h-5 w-5" /> },
      { to: "tenants", label: t("nav.tenants"), icon: <Building2 className="h-5 w-5" /> },
      { to: "revenue", label: t("nav.globalRevenue"), icon: <Receipt className="h-5 w-5" /> },
      { to: "settlements", label: t("nav.globalSettlements"), icon: <CreditCard className="h-5 w-5" /> },
      { to: "users", label: t("nav.globalUsers"), icon: <Users className="h-5 w-5" /> },
      { to: "email", label: "E-posta Gönder", icon: <Mail className="h-5 w-5" /> },
      { to: "settings", label: t("nav.systemSettings"), icon: <Settings className="h-5 w-5" /> },
      { to: "audit", label: t("nav.audit"), icon: <FileText className="h-5 w-5" /> },
    ];
    return items;
  }, [t]);

  return (
    <ConfirmProvider>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', background: 'var(--bg-secondary)' }}>
        {/* Modern Sidebar (same as Partner Panel) */}
        <ModernSidebar
          items={modernNavigation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          brandName="KYRADI"
          brandLogo="/logo-black.png"
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
            onSettingsClick={() => navigate('/admin/settings')}
            actions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => setQuickActionsOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    minWidth: '180px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Hızlı Arama (⌘K)"
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                >
                  <span>🔍</span>
                  <span style={{ opacity: 0.7, flex: 1, textAlign: 'left' }}>Ara...</span>
                  <kbd style={{ 
                    padding: '3px 6px', 
                    background: 'var(--bg-primary)', 
                    borderRadius: '4px', 
                    fontSize: '0.7rem',
                    border: '1px solid var(--border-primary)',
                    fontWeight: 500,
                  }}>⌘K</kbd>
                </button>
                <LanguageSwitcher />
              </div>
            }
          />

          {/* Breadcrumbs */}
          <div style={{ 
            padding: 'var(--space-3) var(--space-6)', 
            borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-primary)',
          }}>
            <Breadcrumbs homePath="/admin" homeLabel="Admin" />
          </div>

          {/* Page Content */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative', padding: 'var(--space-8)' }}>
            <Outlet />
          </div>
        </div>

        {/* Quick Actions Modal */}
        <QuickActions
          isOpen={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
          panelType="admin"
        />
      </div>
    </ConfirmProvider>
  );
}

