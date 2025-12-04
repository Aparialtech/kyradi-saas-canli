import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { partnerReportService, type PartnerSummary } from "../../services/partner/reports";
import { useToast } from "../../hooks/useToast";
import { useTranslation } from "../../hooks/useTranslation";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { FloatingChatWidget } from "../../components/FloatingChatWidget";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { KyradiChat } from "../../components/KyradiChat";
import { env } from "../../config/env";
import type { TranslationKey } from "../../i18n/translations";

// New Premium UI Components
import { ModernSidebar, type ModernSidebarNavItem } from "../../components/layout/ModernSidebar";
import { ModernNavbar } from "../../components/layout/ModernNavbar";
import { StatCard } from "../../components/ui/ModernCard";
import { ModernButton } from "../../components/ui/ModernButton";
import { ModernCard } from "../../components/ui/ModernCard";
import { Badge } from "../../components/ui/Badge";
import { ModernModal } from "../../components/ui/ModernModal";
import { Input, Textarea } from "../../components/ui/Input";
import { PageHeader } from "../../components/common/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  Briefcase,
  MapPin,
  PiggyBank,
  FileText,
  HardDrive,
  ScanLine,
  LineChart,
  Wallet,
  Users as UsersIcon,
  UserCog,
  BadgePercent,
  Settings2,
} from "../../lib/lucide";

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
        icon: <Briefcase className="h-[22px] w-[22px]" />,
      },
      {
        label: t("partner.stats.occupancyLabel"),
        value: summaryQuery.isPending
          ? "..."
          : `${occupancyPct.toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
        hint: t("partner.stats.occupancyHint"),
        icon: <MapPin className="h-[22px] w-[22px]" />,
      },
      {
        label: t("partner.stats.revenueLabel"),
        value: summaryQuery.isPending ? "..." : currencyFormatter.format(revenueMinor / 100),
        hint: t("partner.stats.revenueHint"),
        icon: <PiggyBank className="h-[22px] w-[22px]" />,
      },
      {
        label: t("partner.stats.totalLabel"),
        value: summaryQuery.isPending
          ? "..."
          : (summaryQuery.data?.total_reservations ?? 0).toLocaleString(locale),
        hint: totalLimit,
        icon: <FileText className="h-[22px] w-[22px]" />,
      },
      {
        label: t("partner.stats.storageLabel"),
        value: summaryQuery.isPending
          ? "..."
          : `${summaryQuery.data?.storage_used_mb ?? 0} MB`,
        hint: storageLimit,
        icon: <HardDrive className="h-[22px] w-[22px]" />,
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
    <div className="page-container">
      <ToastContainer messages={messages} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <PageHeader
          title={t("partner.overview.title")}
          subtitle={t("partner.overview.subtitle")}
          actions={[
            {
              key: "support",
              node: (
                <Button variant="secondary" onClick={() => setSupportModalOpen(true)}>
                  {t("partner.support.submit")}
                </Button>
              ),
            },
            {
              key: "docs",
              node: (
                <Button
                  variant="ghost"
                  onClick={() => window.open("https://docs.kyradi.com", "_blank", "noopener")}
                >
                  {t("partner.warning.export.label")}
                </Button>
              ),
            },
          ]}
        />
      </motion.div>

      {/* Modern Stats Grid */}
      <motion.div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-8)'
        }}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
      >
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <StatCard
              label={item.label}
              value={item.value}
              subtitle={item.hint}
              icon={item.icon}
              variant={index === 0 ? 'primary' : index === 1 ? 'secondary' : index === 2 ? 'success' : 'warning'}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Warnings */}
      {summaryQuery.data?.warnings && summaryQuery.data.warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
              {t("partner.planWarnings.title")}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {summaryQuery.data.warnings.map((warning) => (
                <div key={warning.type} style={{ 
                  padding: 'var(--space-4)', 
                  background: 'var(--color-warning-soft)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(245, 158, 11, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--space-3)' }}>
                    <Badge variant="warning" solid size="sm">{warning.type}</Badge>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                        {warning.message}
                        {warning.remaining != null && (
                          <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                            ({t("partner.warning.remaining")}: {warning.remaining.toLocaleString(locale)})
                          </span>
                        )}
                      </p>
                      {(() => {
                        const action = warningActions[warning.type.toLowerCase()];
                        if (!action) return null;
                        return (
                          <div style={{ marginTop: 'var(--space-2)' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                              {t(action.descriptionKey)}
                            </p>
                            <a
                              href={action.href}
                              target="_blank"
                              rel="noreferrer"
                              style={{ 
                                fontSize: '0.875rem', 
                                color: 'var(--color-primary)',
                                fontWeight: 500,
                                marginTop: 'var(--space-1)',
                                display: 'inline-block'
                              }}
                            >
                              {t(action.labelKey)} →
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ModernButton 
              variant="primary" 
              onClick={() => setSupportModalOpen(true)}
              style={{ marginTop: 'var(--space-4)' }}
              fullWidth
            >
              {t("partner.planWarnings.button")}
            </ModernButton>
          </ModernCard>
        </motion.div>
      )}

      {/* AI Assistant */}
      {user?.tenant_id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
              {t("partner.assistant.title")}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
              {t("partner.assistant.subtitle")}
            </p>
            <div>
              <KyradiChat
                apiBase={env.API_URL}
                tenantId={user.tenant_id}
                userId={user.id}
                locale={locale}
                theme="light"
              />
            </div>
          </ModernCard>
        </motion.div>
      )}

      {/* Plan Info Cards */}
      {summaryQuery.data && (
        <motion.div
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-6)'
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <Card variant="elevated" padding="md">
            <h4 style={{ margin: '0 0 var(--space-3)', fontSize: '1rem', fontWeight: 600 }}>
              {t("partner.cards.report.title")}
            </h4>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              {summaryQuery.data.report_exports_today}/
              {summaryQuery.data.plan_limits.max_report_exports_daily ?? "∞"}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 var(--space-1)' }}>
              {t("partner.cards.report.hint")}:{" "}
              {summaryQuery.data.report_exports_remaining != null
                ? summaryQuery.data.report_exports_remaining
                : t("partner.cards.unlimited")}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-subtle)', margin: 0 }}>
              {t("partner.cards.report.reset")}{" "}
              {new Date(summaryQuery.data.report_exports_reset_at).toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </Card>

          <Card variant="elevated" padding="md">
            <h4 style={{ margin: '0 0 var(--space-3)', fontSize: '1rem', fontWeight: 600 }}>
              {t("partner.cards.self.title")}
            </h4>
            {summaryQuery.data.plan_limits.max_self_service_daily != null ? (
              <>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  {(summaryQuery.data.plan_limits.max_self_service_daily ?? 0) -
                    (summaryQuery.data.self_service_remaining ?? 0)}
                  /{summaryQuery.data.plan_limits.max_self_service_daily}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t("partner.cards.self.remaining")}: {summaryQuery.data.self_service_remaining ?? 0}
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  {t("partner.cards.unlimited")}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t("partner.cards.self.unlimited")}
                </p>
              </>
            )}
          </Card>
        </motion.div>
      )}

      {/* Modern Support Modal */}
      <ModernModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        title={t("partner.support.modalTitle")}
        size="lg"
      >
        <form
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                {t("partner.support.topicLabel")}
              </label>
              <select 
                value={supportTopic} 
                onChange={(event) => setSupportTopic(event.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-3) var(--space-4)',
                  height: '44px',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-base)',
                  transition: 'all var(--transition-base)',
                }}
              >
                <option value="plan_upgrade">{t("partner.support.topic.planUpgrade")}</option>
                <option value="storage_cleanup">{t("partner.support.topic.storage")}</option>
                <option value="self_service_quota">{t("partner.support.topic.selfService")}</option>
                <option value="other">{t("partner.support.topic.other")}</option>
              </select>
            </div>
            
            <Input
              label={t("partner.support.contactLabel")}
              type="email"
              value={supportContact}
              onChange={(event) => setSupportContact(event.target.value)}
              required
            />
            
            <Textarea
              label={t("partner.support.messageLabel")}
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
              rows={4}
              placeholder={t("partner.support.messagePlaceholder")}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <ModernButton 
                variant="ghost" 
                onClick={() => setSupportModalOpen(false)}
                type="button"
              >
                {t("partner.support.cancel")}
              </ModernButton>
              <ModernButton variant="primary" type="submit">
                {t("partner.support.submit")}
              </ModernButton>
            </div>
          </div>
        </form>
      </ModernModal>
    </div>
  );
}

export function PartnerDashboard() {
  const { user, logout, hasRole } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const modernNavigation = useMemo((): ModernSidebarNavItem[] => {
    const items: ModernSidebarNavItem[] = [
      { to: ".", label: t("nav.overview"), end: true, icon: <Briefcase className="h-5 w-5" /> },
      { to: "locations", label: t("nav.locations"), icon: <MapPin className="h-5 w-5" /> },
      { to: "lockers", label: t("nav.storages"), icon: <HardDrive className="h-5 w-5" /> },
      { to: "reservations", label: t("nav.reservations"), icon: <FileText className="h-5 w-5" /> },
      { to: "qr", label: t("nav.qr"), icon: <ScanLine className="h-5 w-5" /> },
    ];
    
    // Accounting and hotel manager can see revenue
    if (hasRole("accounting") || hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "reports", label: t("nav.reports"), icon: <LineChart className="h-5 w-5" /> });
      items.push({ to: "revenue", label: t("nav.revenue"), icon: <Wallet className="h-5 w-5" /> });
      items.push({ to: "settlements", label: t("nav.settlements"), icon: <PiggyBank className="h-5 w-5" /> });
    }
    
    // Hotel manager and tenant admin can manage users and staff
    if (hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "users", label: t("nav.users"), icon: <UsersIcon className="h-5 w-5" /> });
      items.push({ to: "staff", label: t("nav.staff"), icon: <UserCog className="h-5 w-5" /> });
      items.push({ to: "pricing", label: t("nav.pricing"), icon: <BadgePercent className="h-5 w-5" /> });
      items.push({ to: "demo-flow", label: t("nav.demoFlow"), icon: <LineChart className="h-5 w-5" /> });
    }
    
    // All authenticated users can access settings
    items.push({ to: "settings", label: t("nav.settings"), icon: <Settings2 className="h-5 w-5" /> });
    
    return items;
  }, [hasRole, t]);

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', background: 'var(--bg-secondary)' }}>
        {/* Modern Sidebar */}
        <ModernSidebar
          items={modernNavigation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          brandName="KYRADI"
        />

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: sidebarOpen ? '280px' : '80px', transition: 'margin-left 0.2s' }}>
          {/* Modern Navbar */}
          <ModernNavbar
            title="Partner Panel"
            userName={user?.email ?? 'Partner'}
            userRole="Partner"
            onLogout={logout}
            sidebarToggle={
              <button 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-lg)',
                }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            }
            actions={<LanguageSwitcher />}
          />

          {/* Page Content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
      
      <FloatingChatWidget />
    </>
  );
}

// Re-export all other pages
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
