import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Users, Package, DollarSign, HardDrive, Mail, MessageSquare, CreditCard, Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Send, FileText } from "../../../lib/lucide";
import { ModernButton } from "../../../components/ui/ModernButton";

import { adminReportService, type AdminSummaryResponse } from "../../../services/admin/reports";
import { paymentScheduleService } from "../../../services/partner/paymentSchedules";
import { adminTenantService } from "../../../services/admin/tenants";
import type { Tenant } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";

export function AdminReportsOverview() {
  const { t } = useTranslation();
  const { messages } = useToast();
  const navigate = useNavigate();
  const summaryQuery = useQuery<AdminSummaryResponse>({ 
    queryKey: ["admin", "summary"], 
    queryFn: () => adminReportService.summary(),
  });
  const tenantsQuery = useQuery({ queryKey: ["admin", "tenants"], queryFn: adminTenantService.list });
  
  // Commission transfers query
  const transfersQuery = useQuery({
    queryKey: ["admin-payment-transfers-summary"],
    queryFn: () => paymentScheduleService.adminListAllTransfers({ page: 1, pageSize: 100 }),
  });

  // Calculate commission stats
  const commissionStats = useMemo(() => {
    const transfers = transfersQuery.data?.data || [];
    const pendingTransfers = transfers.filter((t) => t?.status === "pending");
    const completedTransfers = transfers.filter((t) => t?.status === "completed");
    
    const pendingCount = pendingTransfers.length;
    const pendingAmount = pendingTransfers.reduce((sum, t) => {
      const amount = Number(t?.gross_amount) || 0;
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    const completedAmount = completedTransfers.reduce((sum, t) => {
      const amount = Number(t?.gross_amount) || 0;
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    
    return { pendingCount, pendingAmount, completedAmount };
  }, [transfersQuery.data?.data]);

  const tenantsById = useMemo(() => {
    const map = new Map<string, Tenant>();
    for (const tenant of tenantsQuery.data ?? []) {
      map.set(tenant.id, tenant);
    }
    return map;
  }, [tenantsQuery.data]);

  const formatCurrency = (minor: number | null | undefined) => {
    const safeValue = Number(minor) || 0;
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(safeValue / 100);
  };

  // For decimal values (transfer amounts are already in TL, not minor)
  const formatCurrencyDecimal = (value: number | null | undefined) => {
    const safeValue = Number(value) || 0;
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(safeValue);
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
            {t("admin.dashboard.title")}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("admin.dashboard.subtitle")}
          </p>
        </div>
        <ModernButton
          variant="primary"
          onClick={() => navigate("/admin/guide")}
        >
          <FileText className="h-4 w-4" style={{ marginRight: "var(--space-2)", display: "inline-block" }} />
          Nasıl Kullanılır?
        </ModernButton>
      </motion.div>

      {/* Global KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)", marginBottom: 'var(--space-6)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  {t("admin.dashboard.totalHotels")}
                </p>
                <Building2 className="h-5 w-5" style={{ color: '#6366f1' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#6366f1', margin: '0 0 var(--space-1) 0' }}>
                {summaryQuery.isLoading ? "..." : (summaryQuery.data?.total_tenants ?? 0)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                {summaryQuery.data?.active_tenants ?? 0} {t("admin.dashboard.activeHotels").toLowerCase()},{" "}
                {((summaryQuery.data?.total_tenants ?? 0) - (summaryQuery.data?.active_tenants ?? 0))} pasif
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  {t("admin.dashboard.totalUsers")}
                </p>
                <Users className="h-5 w-5" style={{ color: '#16a34a' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: '0 0 var(--space-1) 0' }}>
                {summaryQuery.isLoading ? "..." : (summaryQuery.data?.total_users ?? 0)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                {t("admin.dashboard.totalUsers")} - {t("common.hotel")} bazlı
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  {t("admin.dashboard.reservations24h")}
                </p>
                <Package className="h-5 w-5" style={{ color: '#3b82f6' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#3b82f6', margin: '0 0 var(--space-1) 0' }}>
                {summaryQuery.isLoading ? "..." : (summaryQuery.data?.reservations_24h ?? 0)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                {t("admin.dashboard.reservations7d")}: {summaryQuery.data?.reservations_7d ?? 0}
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  {t("admin.dashboard.totalRevenue")} (30g)
                </p>
                <DollarSign className="h-5 w-5" style={{ color: '#16a34a' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: '0 0 var(--space-1) 0' }}>
                {summaryQuery.isLoading
                  ? "..."
                  : formatCurrency(summaryQuery.data?.total_revenue_minor ?? 0)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                {t("admin.dashboard.totalCommission")}: {formatCurrency(summaryQuery.data?.total_commission_minor ?? 0)}
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  {t("admin.dashboard.totalStorages")}
                </p>
                <HardDrive className="h-5 w-5" style={{ color: '#a855f7' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#a855f7', margin: '0 0 var(--space-1) 0' }}>
                {summaryQuery.isLoading ? "..." : summaryQuery.data?.total_storages ?? "-"}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                {t("common.storages")} - {t("common.allHotels" as any)}
              </p>
            </div>
          </ModernCard>
        </motion.div>

        {/* Commission Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  Onay Bekleyen Komisyon
                </p>
                <Clock className="h-5 w-5" style={{ color: '#d97706' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#d97706', margin: '0 0 var(--space-1) 0' }}>
                {transfersQuery.isLoading ? "..." : `${commissionStats.pendingCount} adet`}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                Tutar: {formatCurrencyDecimal(commissionStats.pendingAmount)}
              </p>
            </div>
          </ModernCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <ModernCard variant="glass" padding="lg" hoverable>
            <div style={{ padding: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                  Alınan Komisyon
                </p>
                <Send className="h-5 w-5" style={{ color: '#059669' }} />
              </div>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#059669', margin: '0 0 var(--space-1) 0' }}>
                {transfersQuery.isLoading ? "..." : formatCurrencyDecimal(commissionStats.completedAmount)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                Onaylanan komisyon ödemeleri
              </p>
            </div>
          </ModernCard>
        </motion.div>
      </div>

      {/* System Health */}
      {summaryQuery.data?.system_health && (
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              {t("admin.dashboard.systemHealth")}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Servis durumları ve son hatalar
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <Mail className="h-5 w-5" style={{ color: summaryQuery.data.system_health.email_service_status === "ok" ? '#16a34a' : '#dc2626' }} />
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Email Servisi</strong>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    background:
                      summaryQuery.data.system_health.email_service_status === "ok"
                        ? "rgba(34, 197, 94, 0.1)"
                        : "rgba(220, 38, 38, 0.1)",
                    color:
                      summaryQuery.data.system_health.email_service_status === "ok"
                        ? "#16a34a"
                        : "#dc2626",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                  }}
                >
                  {summaryQuery.data.system_health.email_service_status === "ok" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Çalışıyor
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Hata
                    </>
                  )}
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <MessageSquare className="h-5 w-5" style={{ color: summaryQuery.data.system_health.sms_service_status === "ok" ? '#16a34a' : '#dc2626' }} />
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>SMS Servisi</strong>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    background:
                      summaryQuery.data.system_health.sms_service_status === "ok"
                        ? "rgba(34, 197, 94, 0.1)"
                        : "rgba(220, 38, 38, 0.1)",
                    color:
                      summaryQuery.data.system_health.sms_service_status === "ok" ? "#16a34a" : "#dc2626",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                  }}
                >
                  {summaryQuery.data.system_health.sms_service_status === "ok" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Çalışıyor
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Hata
                    </>
                  )}
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <CreditCard className="h-5 w-5" style={{ color: summaryQuery.data.system_health.payment_provider_status === "ok" ? '#16a34a' : '#dc2626' }} />
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Ödeme Gateway</strong>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    background:
                      summaryQuery.data.system_health.payment_provider_status === "ok"
                        ? "rgba(34, 197, 94, 0.1)"
                        : "rgba(220, 38, 38, 0.1)",
                    color:
                      summaryQuery.data.system_health.payment_provider_status === "ok" ? "#16a34a" : "#dc2626",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                  }}
                >
                  {summaryQuery.data.system_health.payment_provider_status === "ok" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Çalışıyor
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Hata
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </ModernCard>
      )}

      {/* Top 5 Tenants */}
      {summaryQuery.data?.top_tenants && summaryQuery.data.top_tenants.length > 0 && (
        <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              {t("admin.dashboard.topTenants")} (Son 30 Gün)
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Top 5 {t("common.hotel")} performans özeti
            </p>
          </div>
          <ModernTable
            columns={[
              {
                key: 'rank',
                label: 'Sıra',
                render: (_, __, index) => <strong style={{ color: 'var(--primary)' }}>#{index + 1}</strong>,
                align: 'center',
              },
              {
                key: 'tenant_name',
                label: t("common.hotel"),
                render: (value) => <strong>{value}</strong>,
              },
              {
                key: 'revenue_minor',
                label: t("admin.dashboard.totalRevenue"),
                render: (value) => formatCurrency(value),
                align: 'right',
              },
              {
                key: 'commission_minor',
                label: t("admin.dashboard.totalCommission"),
                render: (value) => formatCurrency(value),
                align: 'right',
              },
            ] as ModernTableColumn<typeof summaryQuery.data.top_tenants[0] & { rank?: number }>[]}
            data={summaryQuery.data.top_tenants.map((t, i) => ({ ...t, rank: i + 1 }))}
            loading={summaryQuery.isLoading}
            striped
            hoverable
            stickyHeader
          />
        </ModernCard>
      )}

      {/* Tenant Activities */}
      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
            {t("admin.dashboard.tenantActivities")}
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            Günlük özet: {t("common.hotel")} bazlı gelir ve rezervasyon sayıları.
          </p>
        </div>
        {summaryQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Veriler yükleniyor...</p>
          </div>
        ) : summaryQuery.data?.tenants && summaryQuery.data.tenants.length > 0 ? (
          <ModernTable
            columns={[
              {
                key: 'tenant_name',
                label: t("common.hotel"),
                render: (value, row) => {
                  const tenantInfo = tenantsById.get(row.tenant_id);
                  return (
                    <div>
                      <strong>{value ?? tenantInfo?.name ?? `Bilinmeyen ${t("common.hotel")}`}</strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                        {t("common.shortName")}: {row.tenant_slug ?? tenantInfo?.slug ?? row.tenant_id.slice(0, 8)}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'today_revenue_minor',
                label: 'Bugünkü Gelir',
                render: (value) => formatCurrency(value),
                align: 'right',
              },
              {
                key: 'active_reservations',
                label: 'Aktif Rezervasyon',
                render: (value) => <strong style={{ color: 'var(--primary)' }}>{value}</strong>,
                align: 'center',
              },
              {
                key: 'total_revenue_30d_minor',
                label: '30 Günlük Ciro',
                render: (value) => formatCurrency(value),
                align: 'right',
              },
              {
                key: 'total_commission_30d_minor',
                label: '30 Günlük Komisyon',
                render: (value) => <span style={{ color: '#dc2626', fontWeight: 'var(--font-semibold)' }}>{formatCurrency(value)}</span>,
                align: 'right',
              },
            ] as ModernTableColumn<typeof summaryQuery.data.tenants[0]>[]}
            data={summaryQuery.data.tenants}
            loading={summaryQuery.isLoading}
            striped
            hoverable
            stickyHeader
          />
        ) : (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Package className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              Veri bulunamadı
            </p>
            <p style={{ margin: 0 }}>Henüz tenant aktivite verisi bulunmuyor.</p>
          </div>
        )}
      </ModernCard>

      {summaryQuery.isError && (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: "0.5rem", fontSize: 'var(--text-lg)' }}>
              Rapor verileri alınamadı
            </p>
            <p style={{ margin: 0 }}>Lütfen daha sonra tekrar deneyin.</p>
          </div>
        </ModernCard>
      )}
    </div>
  );
}
