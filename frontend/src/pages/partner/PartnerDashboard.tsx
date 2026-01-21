import { useEffect, useMemo, useState, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import {
  partnerReportService,
  type PartnerOverviewByPaymentMethodItem,
  type PartnerSummary,
} from "../../services/partner/reports";
import { useToast } from "../../hooks/useToast";
import { useTranslation } from "../../hooks/useTranslation";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { KyradiChat } from "../../components/KyradiChat";
import { env } from "../../config/env";
import type { TranslationKey } from "../../i18n/translations";
import { detectHostType, isDevelopment } from "../../lib/hostDetection";

// UX Enhancement Components
import { QuickActions, useQuickActionsShortcut } from "../../components/common/QuickActions";
import { Breadcrumbs } from "../../components/common/Breadcrumbs";
import { ConfirmProvider } from "../../components/common/ConfirmDialog";

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
import { ReservationTrendChart } from "../../components/charts/ReservationTrendChart";
import { RevenueDonutChart } from "../../components/charts/RevenueDonutChart";
import { OccupancyBarChart } from "../../components/charts/OccupancyBarChart";
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
  BookOpen,
  Settings2,
  MessageSquare,
  DollarSign,
  Send,
} from "../../lib/lucide";
import { ticketService } from "../../services/partner/tickets";
import { paymentScheduleService } from "../../services/partner/paymentSchedules";
import { partnerSettingsService } from "../../services/partner/settings";

const warningActions: Record<
  string,
  {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
    href?: string;
    hrefKey?: TranslationKey;
    variant?: "primary" | "secondary";
  }
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
    hrefKey: "partner.warning.export.href",
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
  const navigate = useNavigate();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportTopic, setSupportTopic] = useState("plan_upgrade");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportContact, setSupportContact] = useState(user?.email ?? "");
  const exportGuideHref = "/app/export-guide";
  
  const summaryQuery = useQuery<PartnerSummary, Error>({
    queryKey: ["partner", "summary"],
    queryFn: () => partnerReportService.summary(),
  });

  // Chart data queries
  const trendQuery = useQuery({
    queryKey: ["partner", "trends"],
    queryFn: () =>
      partnerReportService.getTrends({
        granularity: "daily",
      }),
  });

  const storageUsageQuery = useQuery({
    queryKey: ["partner", "storage-usage"],
    queryFn: () => partnerReportService.getStorageUsage(),
  });

  const paymentMethodQuery = useQuery<PartnerOverviewByPaymentMethodItem[], Error>({
    queryKey: ["partner", "overview", "payment-methods"],
    queryFn: async () => {
      const response = await partnerReportService.getPartnerOverview();
      return response.by_payment_method ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Commission summary query
  const commissionQuery = useQuery({
    queryKey: ["commission-summary"],
    queryFn: () => paymentScheduleService.getCommissionSummary(),
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
    if (paymentMethodQuery.error) {
      push({
        title: "Gelir dağılımı yüklenemedi",
        description: getErrorMessage(paymentMethodQuery.error),
        type: "error",
      });
    }
  }, [paymentMethodQuery.error, push]);
  
  useEffect(() => {
    setSupportContact(user?.email ?? "");
  }, [user?.email]);

  const activeReservations = summaryQuery.data?.active_reservations ?? 0;
  const occupancyPct = summaryQuery.data?.locker_occupancy_pct ?? 0;
  const todayRevenueMinor = summaryQuery.data?.today_revenue_minor ?? 0;
  const totalRevenueMinor = summaryQuery.data?.total_revenue ?? 0;

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

  // Chart data transformations
  const trendData = useMemo(() => {
    if (!trendQuery.data) return [];
    return trendQuery.data.map((point) => {
      const dateLabel = new Date(point.date).toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
      });
      return {
        date: dateLabel,
        reservations: point.reservations ?? 0,
        revenue: Math.round((point.revenue_minor ?? 0) / 100),
      };
    });
  }, [trendQuery.data, locale]);

  const occupancyData = useMemo(() => {
    if (!storageUsageQuery.data) return [];
    return storageUsageQuery.data.map((item) => ({
      label: `${item.location_name} / ${item.storage_code}`,
      occupancy_rate: item.occupancy_rate ?? 0,
    }));
  }, [storageUsageQuery.data]);

  const revenueDistributionData = useMemo(() => {
    if (!paymentMethodQuery.data) return [];
    const fallbackColors = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6"];
    const methodColors: Record<string, string> = {
      GATEWAY_DEMO: "#6366f1",
      GATEWAY_LIVE: "#3B82F6",
      POS: "#0ea5e9",
      CASH: "#22c55e",
      BANK_TRANSFER: "#f59e0b",
    };

    return paymentMethodQuery.data.map((item, index) => {
      const amount = Math.max(0, (item.revenue_minor ?? 0) / 100);
      return {
        name: item.method_name || item.method || `Yöntem ${index + 1}`,
        value: Number(amount.toFixed(2)),
        color: methodColors[item.method ?? ""] || fallbackColors[index % fallbackColors.length],
      };
    });
  }, [paymentMethodQuery.data]);

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
        label: t("partner.stats.totalRevenueLabel"),
        value: summaryQuery.isPending ? "..." : currencyFormatter.format(totalRevenueMinor / 100),
        hint: t("partner.stats.totalRevenueHint"),
        icon: <Wallet className="h-[22px] w-[22px]" />,
      },
      {
        label: t("partner.stats.revenueLabel"),
        value: summaryQuery.isPending ? "..." : currencyFormatter.format(todayRevenueMinor / 100),
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
      {
        label: t("partner.stats.availableCommissionLabel"),
        value: commissionQuery.isPending
          ? "..."
          : currencyFormatter.format(commissionQuery.data?.available_commission ?? 0),
        hint: t("partner.stats.availableCommissionHint"),
        icon: <DollarSign className="h-[22px] w-[22px]" />,
      },
      {
        label: t("partner.stats.transferredCommissionLabel"),
        value: commissionQuery.isPending
          ? "..."
          : currencyFormatter.format(commissionQuery.data?.transferred_commission ?? 0),
        hint: t("partner.stats.transferredCommissionHint"),
        icon: <Send className="h-[22px] w-[22px]" />,
      },
    ];
  }, [
    summaryQuery.isPending,
    activeReservations,
    occupancyPct,
    todayRevenueMinor,
    totalRevenueMinor,
    summaryQuery.data,
    locale,
    currencyFormatter,
    t,
    commissionQuery.isPending,
    commissionQuery.data,
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
              key: "guide",
              node: (
                <Button
                  variant="primary"
                  onClick={() => navigate("/app/guide")}
                >
                  <FileText className="h-4 w-4" style={{ marginRight: "var(--space-2)" }} />
                  {t("common.howToUse")}
                </Button>
              ),
            },
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
                  onClick={() => navigate(exportGuideHref)}
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
                        const href = action.hrefKey ? t(action.hrefKey) : action.href;
                        return (
                          <div style={{ marginTop: 'var(--space-2)' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                              {t(action.descriptionKey)}
                            </p>
                            <a
                              href={href}
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
          <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)', width: '100%' }}>
            <h3 style={{ marginTop: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
              {t("partner.assistant.title")}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
              {t("partner.assistant.subtitle")}
            </p>
            <div style={{ width: '100%' }}>
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

      {/* Charts Section */}
      <motion.div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <ModernCard variant="glass" padding="lg" style={{ overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
            📈 Rezervasyon Trendi
          </h3>
          <div style={{ height: '280px', minHeight: '280px', minWidth: 0, width: '100%' }}>
            {trendQuery.isLoading ? (
              <div className="shimmer" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }} />
            ) : trendData.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'var(--text-tertiary)'
              }}>
                <LineChart className="h-12 w-12" style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                <p style={{ fontSize: 'var(--text-sm)' }}>Henüz trend verisi yok</p>
              </div>
            ) : (
              <ReservationTrendChart data={trendData} chartType="area" />
            )}
          </div>
        </ModernCard>

        <ModernCard variant="glass" padding="lg" style={{ overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
            💰 Gelir Dağılımı
          </h3>
          <div style={{ height: '280px', minHeight: '280px', minWidth: 0, width: '100%' }}>
            {paymentMethodQuery.isLoading ? (
              <div className="shimmer" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }} />
            ) : paymentMethodQuery.error ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  height: "100%",
                  color: "var(--text-tertiary)",
                }}
              >
                <PiggyBank className="h-10 w-10" style={{ opacity: 0.35 }} />
                <span style={{ fontSize: "var(--text-sm)", textAlign: "center" }}>
                  Gelir dağılımı yüklenemedi
                </span>
                <span style={{ fontSize: "var(--text-xs)", maxWidth: 260, textAlign: "center" }}>
                  {getErrorMessage(paymentMethodQuery.error)}
                </span>
              </div>
            ) : revenueDistributionData.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'var(--text-tertiary)'
              }}>
                <PiggyBank className="h-12 w-12" style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                <p style={{ fontSize: 'var(--text-sm)' }}>Henüz gelir verisi yok</p>
              </div>
            ) : (
              <RevenueDonutChart data={revenueDistributionData} chartType="donut" />
            )}
          </div>
        </ModernCard>

        <ModernCard variant="glass" padding="lg" style={{ overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
            📦 Depo Doluluk Oranları
          </h3>
          <div style={{ height: '280px', minHeight: '280px', minWidth: 0, width: '100%' }}>
            {storageUsageQuery.isLoading ? (
              <div className="shimmer" style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }} />
            ) : occupancyData.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'var(--text-tertiary)'
              }}>
                <Briefcase className="h-12 w-12" style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                <p style={{ fontSize: 'var(--text-sm)' }}>Henüz depo verisi yok</p>
              </div>
            ) : (
              <OccupancyBarChart data={occupancyData} showDetailCards={false} />
            )}
          </div>
        </ModernCard>
      </motion.div>

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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const showDomainGuide = isDevelopment() || detectHostType() === "tenant";

  // Unread tickets count for menu badge
  const unreadTicketsQuery = useQuery({
    queryKey: ["unread-tickets"],
    queryFn: () => ticketService.getUnreadCount(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get tenant information for header
  const tenantSettingsQuery = useQuery({
    queryKey: ["partner", "settings"],
    queryFn: () => partnerSettingsService.getSettings(),
  });

  // Keyboard shortcut for Quick Actions (Cmd+K / Ctrl+K)
  useQuickActionsShortcut(useCallback(() => setQuickActionsOpen(true), []));

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
      items.push({ to: "transfers", label: t("nav.commissionPayments"), icon: <PiggyBank className="h-5 w-5" /> });
    }
    
    // Hotel manager and tenant admin can manage users and staff
    if (hasRole("hotel_manager") || hasRole("tenant_admin")) {
      items.push({ to: "users", label: t("nav.users"), icon: <UsersIcon className="h-5 w-5" /> });
      items.push({ to: "staff", label: t("nav.staff"), icon: <UserCog className="h-5 w-5" /> });
      items.push({ to: "pricing", label: t("nav.pricing"), icon: <BadgePercent className="h-5 w-5" /> });
      items.push({ to: "demo-flow", label: t("nav.demoFlow"), icon: <LineChart className="h-5 w-5" /> });
    }
    
    // All authenticated users can access tickets and settings
    const unreadCount = unreadTicketsQuery.data ?? 0;
    items.push({ 
      to: "tickets", 
      label: t("nav.communication"), 
      icon: <MessageSquare className="h-5 w-5" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    });
    items.push({ to: "settings", label: t("nav.settings"), icon: <Settings2 className="h-5 w-5" /> });
    if (showDomainGuide) {
      items.push({ to: "docs/domain-kurulumu", label: "Domain Kurulum Rehberi", icon: <BookOpen className="h-5 w-5" /> });
    }
    
    return items;
  }, [hasRole, showDomainGuide, t, unreadTicketsQuery.data]);

  return (
    <ConfirmProvider>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', background: 'var(--bg-secondary)' }}>
        {/* Modern Sidebar */}
        <ModernSidebar
          items={modernNavigation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          brandName="KYRADI"
          brandLogo="/logo-black.png"
        />

        {/* Main Content */}
        <main style={{ 
          flex: '1 1 auto',
          display: 'flex', 
          flexDirection: 'column',
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          marginLeft: sidebarOpen ? '280px' : '80px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
        className="main-content-area"
        >
          {/* Modern Navbar */}
          <ModernNavbar
            title={tenantSettingsQuery.data?.tenant_name 
              ? `Partner Panel - ${tenantSettingsQuery.data.tenant_name}` 
              : "Partner Panel"}
            userName={user?.email ?? 'Partner'}
            userRole="Partner"
            onLogout={logout}
            onSettingsClick={() => navigate('/app/settings')}
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
            <Breadcrumbs />
          </div>

          {/* Page Content */}
          <div style={{ 
            flex: '1 1 auto', 
            overflow: 'auto', 
            position: 'relative',
            minWidth: 0,
            width: '100%',
          }}>
            <Outlet />
          </div>
        </main>

        {/* Quick Actions Modal */}
        <QuickActions
          isOpen={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
          panelType="partner"
        />
      </div>
    </ConfirmProvider>
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
export { ExportGuidePage } from "./ExportGuidePage";
