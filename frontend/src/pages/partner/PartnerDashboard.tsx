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
import { AppLayout, AppLayoutBody, AppLayoutMain } from "../../components/layout/AppLayout";
import { TopNav } from "../../components/layout/TopNav";
import { Sidebar, type SidebarNavItem } from "../../components/layout/Sidebar";
import { StatCard, Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../components/ui/Modal";
import { Input, Textarea } from "../../components/ui/Input";
import { PageHeader } from "../../components/common/PageHeader";

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
      },
      {
        label: t("partner.stats.occupancyLabel"),
        value: summaryQuery.isPending
          ? "..."
          : `${occupancyPct.toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
        hint: t("partner.stats.occupancyHint"),
        icon: "📊",
      },
      {
        label: t("partner.stats.revenueLabel"),
        value: summaryQuery.isPending ? "..." : currencyFormatter.format(revenueMinor / 100),
        hint: t("partner.stats.revenueHint"),
        icon: "💳",
      },
      {
        label: t("partner.stats.totalLabel"),
        value: summaryQuery.isPending
          ? "..."
          : (summaryQuery.data?.total_reservations ?? 0).toLocaleString(locale),
        hint: totalLimit,
        icon: "🧾",
      },
      {
        label: t("partner.stats.storageLabel"),
        value: summaryQuery.isPending
          ? "..."
          : `${summaryQuery.data?.storage_used_mb ?? 0} MB`,
        hint: storageLimit,
        icon: "💾",
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

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: 'var(--space-6)',
        marginBottom: 'var(--space-8)'
      }}>
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
          >
            <StatCard
              label={item.label}
              value={item.value}
              icon={<span style={{ fontSize: '1.5rem' }}>{item.icon}</span>}
            />
          </motion.div>
        ))}
      </div>

      {/* Warnings */}
      {summaryQuery.data?.warnings && summaryQuery.data.warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Card variant="elevated" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.125rem', fontWeight: 600 }}>
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
            <Button 
              variant="primary" 
              size="md" 
              onClick={() => setSupportModalOpen(true)}
              style={{ marginTop: 'var(--space-4)' }}
            >
              {t("partner.planWarnings.button")}
            </Button>
          </Card>
        </motion.div>
      )}

      {/* AI Assistant */}
      {user?.tenant_id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <Card variant="elevated" padding="none" style={{ marginBottom: 'var(--space-6)' }}>
            <CardHeader 
              title={t("partner.assistant.title")} 
              description={t("partner.assistant.subtitle")}
            />
            <CardBody>
              <KyradiChat
                apiBase={env.API_URL}
                tenantId={user.tenant_id}
                userId={user.id}
                locale={locale}
                theme="light"
              />
            </CardBody>
          </Card>
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

      {/* Support Modal */}
      <Modal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        size="lg"
      >
        <ModalHeader
          title={t("partner.support.modalTitle")}
          onClose={() => setSupportModalOpen(false)}
        />
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
          <ModalBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                  {t("partner.support.topicLabel")}
                </label>
                <select 
                  value={supportTopic} 
                  onChange={(event) => setSupportTopic(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '0 var(--space-3)',
                    height: '40px',
                    border: '1.5px solid var(--color-input-border)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-input-text)',
                    fontSize: '0.9375rem'
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
            </div>
          </ModalBody>
          <ModalFooter justify="end">
            <Button 
              variant="ghost" 
              onClick={() => setSupportModalOpen(false)}
              type="button"
            >
              {t("partner.support.cancel")}
            </Button>
            <Button variant="primary" type="submit">
              {t("partner.support.submit")}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}

export function PartnerDashboard() {
  const { user, logout, hasRole } = useAuth();
  const { t } = useTranslation();

  const navigation = useMemo((): SidebarNavItem[] => {
    const items: SidebarNavItem[] = [
      { to: ".", label: t("nav.overview"), end: true },
      { to: "locations", label: t("nav.locations") },
      { to: "lockers", label: t("nav.storages") },
      { to: "reservations", label: t("nav.reservations") },
      { to: "qr", label: t("nav.qr") },
    ];
    
    // Accounting and hotel manager can see revenue
    if (hasRole("accounting") || hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "reports", label: t("nav.reports") });
      items.push({ to: "revenue", label: t("nav.revenue") });
      items.push({ to: "settlements", label: t("nav.settlements") });
    }
    
    // Hotel manager and tenant admin can manage users and staff
    if (hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "users", label: t("nav.users") });
      items.push({ to: "staff", label: t("nav.staff") });
      items.push({ to: "pricing", label: t("nav.pricing") });
      items.push({ to: "demo-flow", label: t("nav.demoFlow") });
    }
    
    // All authenticated users can access settings
    items.push({ to: "settings", label: t("nav.settings") });
    
    return items;
  }, [hasRole, t]);

  return (
    <>
      <AppLayout variant="partner">
        <TopNav
          variant="partner"
          brandMark="KY"
          brandText={t("nav.brandPartner")}
          userEmail={user?.email}
          onLogout={logout}
        >
          <LanguageSwitcher />
        </TopNav>

        <AppLayoutBody>
          <Sidebar items={navigation} heading={t("nav.menu")} />
          
          <AppLayoutMain>
            <Outlet />
          </AppLayoutMain>
        </AppLayoutBody>
      </AppLayout>
      
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
