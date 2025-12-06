import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, Edit, Building2, Loader2, AlertCircle, Users, UserPlus } from "../../../lib/lucide";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { ModernInput } from "../../../components/ui/ModernInput";

import {
  adminTenantService,
  type Tenant,
  type TenantCreatePayload,
  type TenantUpdatePayload,
  type TenantDetail,
  type TenantPlanLimitsUpdatePayload,
  type TenantMetadataUpdate,
} from "../../../services/admin/tenants";
import {
  adminTenantUserService,
  type AdminTenantUser,
  type AdminTenantUserCreatePayload,
  type AdminTenantUserUpdatePayload,
} from "../../../services/admin/tenantUsers";
import type { UserRole } from "../../../types/auth";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import { PageHeader } from "../../../components/common/PageHeader";
import { DataToolbar } from "../../../components/common/DataToolbar";
import { StatusBadge } from "../../../components/common/StatusBadge";

interface UserModalFormValues {
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

const tenantUserRoleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "tenant_admin", label: "Tenant Admin" },
  { value: "staff", label: "Personel" },
  { value: "viewer", label: "İzleyici" },
];

const userRoleLabels: Record<UserRole, string> = {
  super_admin: "Süper Admin",
  support: "Destek",
  tenant_admin: "Tenant Admin",
  staff: "Personel",
  viewer: "İzleyici",
  hotel_manager: "Otel Yöneticisi",
  storage_operator: "Depo Görevlisi",
  accounting: "Muhasebe",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
};

export function TenantsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const tenantsQuery = useQuery({ queryKey: ["admin", "tenants"], queryFn: adminTenantService.list });
  const tenantDetailQuery = useQuery({
    queryKey: ["admin", "tenants", selectedTenantId, "detail"],
    queryFn: () => adminTenantService.detail(selectedTenantId!),
    enabled: Boolean(selectedTenantId),
  });
  
  // Filter tenants
  const filteredTenants = useMemo(() => {
    let tenants = tenantsQuery.data || [];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      tenants = tenants.filter(t => 
        t.name.toLowerCase().includes(term) ||
        t.slug.toLowerCase().includes(term)
      );
    }
    
    if (planFilter) {
      tenants = tenants.filter(t => t.plan === planFilter);
    }
    
    if (statusFilter) {
      const isActive = statusFilter === "active";
      tenants = tenants.filter(t => t.is_active === isActive);
    }
    
    return tenants;
  }, [tenantsQuery.data, searchTerm, planFilter, statusFilter]);

  const createMutation = useMutation({
    mutationFn: (payload: TenantCreatePayload) => adminTenantService.create(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      push({ 
        title: "Tenant oluşturuldu", 
        description: `${data.name} (${data.slug}) başarıyla oluşturuldu.`,
        type: "success" 
      });
      reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
      setEditingTenant(null);
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(error);
      // Check if it's a DEMO_MODE error
      if (errorMsg.includes("demo environment") || errorMsg.includes("DEMO_MODE")) {
        push({ 
          title: "Demo Modu Aktif", 
          description: "Demo ortamında yeni tenant oluşturma devre dışı bırakılmıştır. Lütfen DEMO_MODE ayarını kontrol edin.",
          type: "error" 
        });
      } else {
        push({ title: "Tenant oluşturulamadı", description: errorMsg, type: "error" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenantUpdatePayload }) =>
      adminTenantService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      push({ title: "Tenant güncellendi", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const updatePlanLimitsMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenantPlanLimitsUpdatePayload }) =>
      adminTenantService.updatePlanLimits(id, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", variables.id, "detail"] });
      push({ title: "Plan limitleri güncellendi", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Plan güncellenemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TenantCreatePayload>({
    defaultValues: {
      slug: "",
      name: "",
      plan: "standard",
      is_active: true,
      brand_color: "",
      logo_url: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    if (editingTenant) {
      const { slug, ...payload } = values;
      await updateMutation.mutateAsync({ id: editingTenant.id, payload });
      setEditingTenant(null);
      reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
    } else {
      await createMutation.mutateAsync(values);
      // Form reset is handled in createMutation.onSuccess
    }
  });

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />

      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <PageHeader
          title={t("admin.tenants.title")}
          subtitle={t("admin.tenants.subtitle")}
          actions={[
            {
              key: "add",
              node: (
                <ModernButton
                  variant="primary"
                  onClick={() => {
                    setEditingTenant(null);
                    reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
                  }}
                  leftIcon={<UserPlus className="h-4 w-4" />}
                >
                  {t("common.create")}
                </ModernButton>
              ),
            },
          ]}
        />
      </motion.div>

      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
            {editingTenant ? t("common.update") : t("common.create")}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("admin.tenants.subtitle")}
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {!editingTenant && (
            <ModernInput
              label={t("common.shortName")}
              placeholder="demo-hotel"
              {...register("slug", { required: `${t("common.shortName")}` })}
              error={errors.slug?.message}
              helperText={t("common.shortNameHint")}
              fullWidth
              required
            />
          )}

          <ModernInput
            label={t("admin.tenants.hotelName")}
            placeholder={t("admin.tenants.hotelName")}
            {...register("name", { required: t("admin.tenants.hotelName") })}
            error={errors.name?.message}
            fullWidth
            required
          />

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              {t("admin.tenants.plan")}
            </label>
            <input
              {...register("plan")}
              placeholder="pro"
              style={{
                width: "100%",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input type="checkbox" {...register("is_active")} style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>{t("common.active")}</span>
          </label>

          <ModernInput
            label={t("settings.brandColor") || "Marka Rengi"}
            placeholder="#00A389"
            {...register("brand_color")}
            fullWidth
          />

          <ModernInput
            label={t("settings.logoUrl") || "Logo URL"}
            placeholder="https://..."
            {...register("logo_url")}
            fullWidth
          />

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", marginTop: 'var(--space-2)' }}>
            {editingTenant && (
              <ModernButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingTenant(null);
                  reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
                }}
              >
                {t("common.cancel")}
              </ModernButton>
            )}
            <ModernButton
              type="submit"
              variant="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
              isLoading={createMutation.isPending || updateMutation.isPending}
              loadingText={t("common.loading")}
            >
              {editingTenant ? t("common.save") : t("common.create")}
            </ModernButton>
          </div>
        </form>
      </ModernCard>

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <DataToolbar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder={t("common.search") || "Search"}
            filters={
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
                >
                  <option value="">{t("reservations.filter.all")}</option>
                  <option value="standard">standard</option>
                  <option value="pro">pro</option>
                  <option value="enterprise">enterprise</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
                >
                  <option value="">{t("reservations.filter.all")}</option>
                  <option value="active">{t("common.active")}</option>
                  <option value="inactive">{t("common.inactive")}</option>
                </select>
              </div>
            }
          />
        </div>

        {tenantsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              {t("common.loading")}
            </h3>
            <p style={{ margin: 0 }}>{t("admin.tenants.subtitle")}</p>
          </div>
        ) : tenantsQuery.isError ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
              {t("common.error")}
            </h3>
            <p style={{ margin: 0 }}>{t("common.retry") || t("common.error")}</p>
          </div>
        ) : filteredTenants.length > 0 ? (
          <ModernTable
            columns={[
              {
                key: 'name',
                label: t("common.hotel"),
                render: (value) => <strong>{value}</strong>,
              },
              {
                key: 'slug',
                label: t("common.shortName"),
                render: (value) => <code style={{ fontSize: 'var(--text-xs)', background: 'var(--bg-tertiary)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{value}</code>,
              },
              {
                key: 'plan',
                label: t("admin.tenants.plan"),
                align: 'center',
              },
              {
                key: 'is_active',
                label: t("admin.tenants.status"),
                render: (value) => (
                  <StatusBadge status={value ? "active" : "inactive"} label={value ? t("common.active") : t("common.inactive")} />
                ),
                align: 'center',
              },
              {
                key: 'created_at',
                label: t("common.createdAt"),
                render: (value) => new Date(value).toLocaleString("tr-TR"),
              },
              {
                key: 'id',
                label: 'İşlemler',
                render: (_, tenant) => (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTenantId(tenant.id)}
                      leftIcon={<Eye className="h-4 w-4" />}
                    >
                      Detay
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTenant(tenant);
                        reset({
                          slug: tenant.slug,
                          name: tenant.name,
                          plan: tenant.plan,
                          is_active: tenant.is_active,
                          brand_color: tenant.brand_color ?? "",
                          logo_url: tenant.logo_url ?? "",
                        });
                      }}
                      leftIcon={<Edit className="h-4 w-4" />}
                    >
                      Düzenle
                    </ModernButton>
                  </div>
                ),
                align: 'right',
              },
            ] as ModernTableColumn<Tenant>[]}
            data={filteredTenants}
            loading={tenantsQuery.isLoading}
            striped
            hoverable
            stickyHeader
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Building2 className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              {searchTerm || planFilter || statusFilter ? "Filtrelere uygun sonuç bulunamadı" : "Henüz tenant kaydı yok"}
            </p>
            <p style={{ margin: 0 }}>Yukarıdaki formu kullanarak yeni bir tenant oluşturabilirsiniz.</p>
          </div>
        )}
      </ModernCard>

      {selectedTenantId && (
        <TenantDetailCard
          tenantId={selectedTenantId}
          tenantDetail={tenantDetailQuery.data ?? null}
          isLoading={tenantDetailQuery.isLoading}
          isUpdating={updatePlanLimitsMutation.isPending}
          onPlanUpdate={(payload) => {
            if (!selectedTenantId) return;
            updatePlanLimitsMutation.mutate({ id: selectedTenantId, payload });
          }}
          onClose={() => setSelectedTenantId(null)}
          notify={push}
        />
      )}
    </div>
  );
}

type ToastPayload = { title: string; description?: string; type?: "info" | "success" | "error" };

interface TenantDetailCardProps {
  tenantId: string;
  tenantDetail: TenantDetail | null;
  isLoading: boolean;
  isUpdating: boolean;
  onPlanUpdate: (payload: TenantPlanLimitsUpdatePayload) => void;
  onClose: () => void;
  notify: (payload: ToastPayload) => void;
}

function TenantDetailCard({
  tenantId,
  tenantDetail,
  isLoading,
  isUpdating,
  onPlanUpdate,
  onClose,
  notify,
}: TenantDetailCardProps) {
  const { t } = useTranslation();
  const [planValue, setPlanValue] = useState("");
  const [maxLocations, setMaxLocations] = useState("");
  const [maxLockers, setMaxLockers] = useState("");
  const [maxActiveReservations, setMaxActiveReservations] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [maxSelfServiceDaily, setMaxSelfServiceDaily] = useState("");
  const [maxTotalReservations, setMaxTotalReservations] = useState("");
  const [maxReportExports, setMaxReportExports] = useState("");
  const [maxStorageMb, setMaxStorageMb] = useState("");
  const [userModal, setUserModal] = useState<{ mode: "create" | "edit"; user?: AdminTenantUser } | null>(null);
  const [resetModal, setResetModal] = useState<{ user: AdminTenantUser } | null>(null);
  
  // Metadata state (quotas, financial, features)
  const [quotaLocationCount, setQuotaLocationCount] = useState("");
  const [quotaStorageCount, setQuotaStorageCount] = useState("");
  const [quotaUserCount, setQuotaUserCount] = useState("");
  const [quotaReservationCount, setQuotaReservationCount] = useState("");
  const [financialCommissionRate, setFinancialCommissionRate] = useState("");
  const [featureAiEnabled, setFeatureAiEnabled] = useState(true);
  const [featureAdvancedReportsEnabled, setFeatureAdvancedReportsEnabled] = useState(true);
  const [featurePaymentGatewayEnabled, setFeaturePaymentGatewayEnabled] = useState(true);

  const queryClient = useQueryClient();
  
  const metadataQuery = useQuery({
    queryKey: ["admin", "tenants", tenantId, "metadata"],
    queryFn: () => adminTenantService.getMetadata(tenantId),
    enabled: Boolean(tenantId),
  });
  
  const updateMetadataMutation = useMutation({
    mutationFn: (payload: TenantMetadataUpdate) => adminTenantService.updateMetadata(tenantId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "metadata"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "detail"] });
      notify({ title: "Kota ve finans ayarları güncellendi", type: "success" });
    },
    onError: (error: unknown) => {
      notify({
        title: "Güncelleme başarısız",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "tenants", tenantId, "users"],
    queryFn: () => adminTenantUserService.list(tenantId),
  });

  const {
    register: registerUser,
    handleSubmit: handleUserSubmit,
    reset: resetUserForm,
    setError: setUserFormError,
    formState: { errors: userFormErrors },
  } = useForm<UserModalFormValues>({
    defaultValues: {
      email: "",
      password: "",
      role: "staff",
      is_active: true,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: AdminTenantUserCreatePayload) => adminTenantUserService.create(tenantId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "users"] });
      notify({ title: "Kullanıcı oluşturuldu", type: "success" });
      setUserModal(null);
    },
    onError: (error: unknown) => {
      notify({
        title: "Kullanıcı eklenemedi",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminTenantUserUpdatePayload }) =>
      adminTenantUserService.update(tenantId, userId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "users"] });
      notify({ title: "Kullanıcı güncellendi", type: "success" });
      setUserModal(null);
    },
    onError: (error: unknown) => {
      notify({
        title: "Kullanıcı güncellenemedi",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });
  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminTenantUserService.resetPassword(tenantId, userId, { password }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "users"] });
      notify({ title: "Parola sıfırlandı", type: "success" });
      setResetModal(null);
    },
    onError: (error: unknown) => {
      notify({
        title: "Parola sıfırlanamadı",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (!tenantDetail) {
      setPlanValue("");
      setMaxLocations("");
      setMaxLockers("");
      setMaxActiveReservations("");
      setMaxUsers("");
      setMaxSelfServiceDaily("");
      setMaxTotalReservations("");
      setMaxReportExports("");
      setMaxStorageMb("");
      return;
    }
    const basePlan = tenantDetail.tenant.plan.replace("::custom", "");
    setPlanValue(basePlan);
    setMaxLocations(
      tenantDetail.plan_limits.max_locations != null
        ? String(tenantDetail.plan_limits.max_locations)
        : "",
    );
    setMaxLockers(
      tenantDetail.plan_limits.max_lockers != null
        ? String(tenantDetail.plan_limits.max_lockers)
        : "",
    );
    // Note: max_lockers is backward compatibility for max_storages
    setMaxActiveReservations(
      tenantDetail.plan_limits.max_active_reservations != null
        ? String(tenantDetail.plan_limits.max_active_reservations)
        : "",
    );
    setMaxUsers(
      tenantDetail.plan_limits.max_users != null ? String(tenantDetail.plan_limits.max_users) : "",
    );
    setMaxSelfServiceDaily(
      tenantDetail.plan_limits.max_self_service_daily != null
        ? String(tenantDetail.plan_limits.max_self_service_daily)
        : "",
    );
    setMaxTotalReservations(
      tenantDetail.plan_limits.max_reservations_total != null
        ? String(tenantDetail.plan_limits.max_reservations_total)
        : "",
    );
    setMaxReportExports(
      tenantDetail.plan_limits.max_report_exports_daily != null
        ? String(tenantDetail.plan_limits.max_report_exports_daily)
        : "",
    );
    setMaxStorageMb(
      tenantDetail.plan_limits.max_storage_mb != null ? String(tenantDetail.plan_limits.max_storage_mb) : "",
    );
  }, [tenantDetail]);
  
  // Load metadata when available
  useEffect(() => {
    if (metadataQuery.data) {
      const { quotas, financial, features } = metadataQuery.data;
      setQuotaLocationCount(quotas.max_location_count != null ? String(quotas.max_location_count) : "");
      setQuotaStorageCount(quotas.max_storage_count != null ? String(quotas.max_storage_count) : "");
      setQuotaUserCount(quotas.max_user_count != null ? String(quotas.max_user_count) : "");
      setQuotaReservationCount(quotas.max_reservation_count != null ? String(quotas.max_reservation_count) : "");
      setFinancialCommissionRate(financial.commission_rate != null ? String(financial.commission_rate) : "");
      setFeatureAiEnabled(features.ai_enabled ?? true);
      setFeatureAdvancedReportsEnabled(features.advanced_reports_enabled ?? true);
      setFeaturePaymentGatewayEnabled(features.payment_gateway_enabled ?? true);
    }
  }, [metadataQuery.data]);

  useEffect(() => {
    if (!userModal) {
      resetUserForm({ email: "", password: "", role: "staff", is_active: true });
      return;
    }
    if (userModal.mode === "create") {
      resetUserForm({ email: "", password: "", role: "staff", is_active: true });
    } else if (userModal.user) {
      resetUserForm({
        email: userModal.user.email,
        password: "",
        role: userModal.user.role,
        is_active: userModal.user.is_active,
      });
    }
  }, [userModal, resetUserForm]);

  const limitUsage = tenantDetail
    ? [
        {
          label: "Aktif Kullanıcı",
          used: tenantDetail.metrics.users,
          limit: tenantDetail.plan_limits.max_users,
        },
        {
          label: "Self-service (24s)",
          used: tenantDetail.metrics.self_service_last24h,
          limit: tenantDetail.plan_limits.max_self_service_daily,
        },
        {
          label: "Rapor Export (24s)",
          used: tenantDetail.metrics.report_exports_last24h,
          limit: tenantDetail.plan_limits.max_report_exports_daily,
        },
        {
          label: "Depolama (MB)",
          used: tenantDetail.metrics.storage_used_mb,
          limit: tenantDetail.plan_limits.max_storage_mb,
        },
        {
          label: "Toplam Rezervasyon",
          used: tenantDetail.metrics.total_reservations,
          limit: tenantDetail.plan_limits.max_reservations_total,
        },
      ]
    : [];

  const handlePlanUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantDetail) {
      return;
    }
    const normalizedPlan = planValue.trim() || tenantDetail.tenant.plan || "standard";
    onPlanUpdate({
      plan: normalizedPlan,
      max_locations: maxLocations ? Number(maxLocations) : null,
      max_lockers: maxLockers ? Number(maxLockers) : null,
      max_active_reservations: maxActiveReservations ? Number(maxActiveReservations) : null,
      max_users: maxUsers ? Number(maxUsers) : null,
      max_self_service_daily: maxSelfServiceDaily ? Number(maxSelfServiceDaily) : null,
      max_reservations_total: maxTotalReservations ? Number(maxTotalReservations) : null,
      max_report_exports_daily: maxReportExports ? Number(maxReportExports) : null,
      max_storage_mb: maxStorageMb ? Number(maxStorageMb) : null,
    });
  };
  
  const handleMetadataUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: TenantMetadataUpdate = {
      quotas: {
        max_location_count: quotaLocationCount ? Number(quotaLocationCount) : null,
        max_storage_count: quotaStorageCount ? Number(quotaStorageCount) : null,
        max_user_count: quotaUserCount ? Number(quotaUserCount) : null,
        max_reservation_count: quotaReservationCount ? Number(quotaReservationCount) : null,
      },
      financial: {
        commission_rate: financialCommissionRate ? Number(financialCommissionRate) : undefined,
      },
      features: {
        ai_enabled: featureAiEnabled,
        advanced_reports_enabled: featureAdvancedReportsEnabled,
        payment_gateway_enabled: featurePaymentGatewayEnabled,
      },
    };
    updateMetadataMutation.mutate(payload);
  };

  const isUserMutationPending = createUserMutation.isPending || updateUserMutation.isPending;
  const isResetPending = resetPasswordMutation.isPending;

  const handleUserModalClose = () => {
    if (isUserMutationPending) {
      return;
    }
    setUserModal(null);
  };
  const handleResetModalClose = () => {
    if (isResetPending) {
      return;
    }
    setResetModal(null);
  };

  const onSubmitUser = handleUserSubmit(async (values) => {
    if (!userModal) return;
    try {
      if (userModal.mode === "create") {
        if (!values.password || values.password.trim().length < 8) {
          setUserFormError("password", { type: "manual", message: "Parola en az 8 karakter olmalıdır." });
          return;
        }
        const payload: AdminTenantUserCreatePayload = {
          email: values.email.trim(),
          password: values.password.trim(),
          role: values.role,
          is_active: values.is_active,
        };
        await createUserMutation.mutateAsync(payload);
      } else if (userModal.user) {
        const payload: AdminTenantUserUpdatePayload = {
          role: values.role,
          is_active: values.is_active,
        };
        if (values.password && values.password.trim().length > 0) {
          if (values.password.trim().length < 8) {
            setUserFormError("password", { type: "manual", message: "Parola en az 8 karakter olmalıdır." });
            return;
          }
          payload.password = values.password.trim();
        }
        await updateUserMutation.mutateAsync({ userId: userModal.user.id, payload });
      }
    } catch {
      // Hata bildirimleri mutation onError içinde tetikleniyor.
    }
  });

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <h2 className="panel__title">{t("admin.tenants.title")} - Detay</h2>
          <p className="panel__subtitle">
            Plan limitlerini güncelleyebilir, komisyon oranını ayarlayabilir ve branding bilgilerini görüntüleyebilirsiniz.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--ghost-dark" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
          <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
            Detaylar yükleniyor
          </h3>
          <p style={{ margin: 0 }}>Lütfen bekleyin...</p>
        </div>
      )}

      {!isLoading && tenantDetail && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-card__label">{t("common.hotel")}</span>
              <p className="stat-card__value" style={{ fontSize: "1.3rem" }}>
                {tenantDetail.tenant.name}
              </p>
              <p className="stat-card__hint">{t("common.shortName")}: {tenantDetail.tenant.slug}</p>
            </div>
            <div className="stat-card stat-card--secondary">
              <span className="stat-card__label">{t("admin.tenants.plan")}</span>
              <p className="stat-card__value">{tenantDetail.tenant.plan}</p>
              <p className="stat-card__hint">
                {t("admin.tenants.status")}: {tenantDetail.tenant.is_active ? "Aktif" : "Pasif"}
              </p>
            </div>
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">{t("common.createdAt")}</span>
              <p className="stat-card__value" style={{ fontSize: "1.1rem" }}>
                {new Date(tenantDetail.tenant.created_at).toLocaleDateString("tr-TR")}
              </p>
              <p className="stat-card__hint">{t("common.lastActivity")}</p>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">{t("common.storageCount")}</span>
              <p className="stat-card__value">{tenantDetail.metrics.lockers}</p>
              <p className="stat-card__hint">
                Limit: {tenantDetail.plan_limits.max_lockers ?? "Sınırsız"}
              </p>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">{t("admin.tenants.commissionRate")}</span>
              <p className="stat-card__value">{financialCommissionRate || metadataQuery.data?.financial.commission_rate || "5.0"}%</p>
              <p className="stat-card__hint">Varsayılan: 5.0%</p>
            </div>
          </div>
          {limitUsage.length > 0 && (
            <div className="panel panel--muted">
              <h3 style={{ marginTop: 0 }}>Limit Kullanımı</h3>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kaynak</th>
                      <th>Kullanım</th>
                      <th>Limit</th>
                      <th>Kalan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitUsage.map((item) => (
                      <tr key={item.label}>
                        <td>{item.label}</td>
                        <td>{item.used.toLocaleString("tr-TR")}</td>
                        <td>{item.limit != null ? item.limit.toLocaleString("tr-TR") : "Limitsiz"}</td>
                        <td>
                          {item.limit != null
                            ? Math.max(item.limit - item.used, 0).toLocaleString("tr-TR")
                            : "Limitsiz"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-cell-muted" style={{ marginTop: "0.35rem" }}>
                * Self-service ve rapor export limitleri kaydırmalı 24 saatlik pencerede takip edilir.
              </p>
            </div>
          )}

          <form className="form-grid" onSubmit={handlePlanUpdate} style={{ marginTop: "1.5rem" }}>
            <label className="form-field">
              <span className="form-field__label">Plan</span>
              <input value={planValue} onChange={(event) => setPlanValue(event.target.value)} />
            </label>

            <label className="form-field">
              <span className="form-field__label">Maks. Lokasyon</span>
              <input
                value={maxLocations}
                onChange={(event) => setMaxLocations(event.target.value)}
                type="number"
                min={0}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">{t("admin.tenants.maxStorages")}</span>
              <input
                value={maxLockers}
                onChange={(event) => setMaxLockers(event.target.value)}
                type="number"
                min={0}
                placeholder="Sınırsız için boş bırakın"
              />
              <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                {t("common.storages")} limiti (max_lockers)
              </small>
            </label>
            

            <label className="form-field">
              <span className="form-field__label">Maks. Aktif Rezervasyon</span>
              <input
                value={maxActiveReservations}
                onChange={(event) => setMaxActiveReservations(event.target.value)}
                type="number"
                min={0}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Maks. Aktif Kullanıcı</span>
              <input
                value={maxUsers}
                onChange={(event) => setMaxUsers(event.target.value)}
                type="number"
                min={0}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">24 Saatlik Self-Service Limiti</span>
              <input
                value={maxSelfServiceDaily}
                onChange={(event) => setMaxSelfServiceDaily(event.target.value)}
                type="number"
                min={0}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Toplam Rezervasyon</span>
              <input
                value={maxTotalReservations}
                onChange={(event) => setMaxTotalReservations(event.target.value)}
                type="number"
                min={0}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">Rapor Export / 24s</span>
              <input
                value={maxReportExports}
                onChange={(event) => setMaxReportExports(event.target.value)}
                type="number"
                min={0}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">Depolama Limiti (MB)</span>
              <input
                value={maxStorageMb}
                onChange={(event) => setMaxStorageMb(event.target.value)}
                type="number"
                min={0}
              />
            </label>

          <div className="form-actions form-grid__field--full">
            <button type="submit" className="btn btn--primary" disabled={isUpdating}>
              {isUpdating ? "Güncelleniyor..." : "Plan Limitlerini Kaydet"}
            </button>
          </div>
        </form>

          {/* Quota & Financial Settings Section */}
          <ModernCard variant="glass" padding="lg" style={{ marginTop: 'var(--space-6)' }}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                Kota ve Finans Ayarları
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Lokasyon, depo, kullanıcı ve rezervasyon kotası ile komisyon oranını yönetin
              </p>
            </div>
            
            <form className="form-grid" onSubmit={handleMetadataUpdate}>
              <div style={{ gridColumn: 'span 2', marginBottom: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
                  Kota Ayarları
                </h4>
              </div>
              
              <ModernInput
                label="Maks. Lokasyon Sayısı"
                type="number"
                min={0}
                value={quotaLocationCount}
                onChange={(e) => setQuotaLocationCount(e.target.value)}
                placeholder="Sınırsız için boş bırakın"
                helperText="Tenant'ın oluşturabileceği maksimum lokasyon sayısı"
                fullWidth
              />
              
              <ModernInput
                label="Maks. Depo Sayısı"
                type="number"
                min={0}
                value={quotaStorageCount}
                onChange={(e) => setQuotaStorageCount(e.target.value)}
                placeholder="Sınırsız için boş bırakın"
                helperText="Tenant'ın oluşturabileceği maksimum depo sayısı"
                fullWidth
              />
              
              <ModernInput
                label="Maks. Kullanıcı Sayısı"
                type="number"
                min={0}
                value={quotaUserCount}
                onChange={(e) => setQuotaUserCount(e.target.value)}
                placeholder="Sınırsız için boş bırakın"
                helperText="Tenant'ın oluşturabileceği maksimum aktif kullanıcı sayısı"
                fullWidth
              />
              
              <ModernInput
                label="Maks. Rezervasyon Sayısı"
                type="number"
                min={0}
                value={quotaReservationCount}
                onChange={(e) => setQuotaReservationCount(e.target.value)}
                placeholder="Sınırsız için boş bırakın"
                helperText="Tenant'ın oluşturabileceği maksimum toplam rezervasyon sayısı"
                fullWidth
              />
              
              <div style={{ gridColumn: 'span 2', marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
                  Finans Ayarları
                </h4>
              </div>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  Komisyon Oranı (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={financialCommissionRate || metadataQuery.data?.financial.commission_rate || 5.0}
                    onChange={(e) => setFinancialCommissionRate(e.target.value)}
                    style={{ flex: 1, height: '8px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)', outline: 'none' }}
                  />
                  <ModernInput
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={financialCommissionRate}
                    onChange={(e) => setFinancialCommissionRate(e.target.value)}
                    placeholder="5.0"
                    style={{ width: '120px' }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>%</span>
                </div>
                <small style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', display: 'block', marginTop: 'var(--space-1)' }}>
                  Kyradi platform komisyon oranı (0-100%). Raporlar ve hakedişler bu orana göre hesaplanır.
                </small>
              </div>
              
              <div style={{ gridColumn: 'span 2', marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
                  Özellik Bayrakları
                </h4>
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                <input
                  type="checkbox"
                  checked={featureAiEnabled}
                  onChange={(e) => setFeatureAiEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    AI Asistanı
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    KYRADI AI Asistanı özelliğini etkinleştir/devre dışı bırak
                  </div>
                </div>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                <input
                  type="checkbox"
                  checked={featureAdvancedReportsEnabled}
                  onChange={(e) => setFeatureAdvancedReportsEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Gelişmiş Raporlar
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    Gelişmiş analiz ve raporlama özelliklerini etkinleştir/devre dışı bırak
                  </div>
                </div>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                <input
                  type="checkbox"
                  checked={featurePaymentGatewayEnabled}
                  onChange={(e) => setFeaturePaymentGatewayEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Ödeme Gateway
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    Online ödeme gateway entegrasyonunu etkinleştir/devre dışı bırak
                  </div>
                </div>
              </label>
              
              <div className="form-actions form-grid__field--full" style={{ marginTop: 'var(--space-4)' }}>
                <ModernButton
                  type="submit"
                  variant="primary"
                  disabled={updateMetadataMutation.isPending}
                  isLoading={updateMetadataMutation.isPending}
                  loadingText="Güncelleniyor..."
                >
                  Kota ve Finans Ayarlarını Kaydet
                </ModernButton>
              </div>
            </form>
          </ModernCard>

          <div className="panel__header" style={{ marginTop: "2.5rem" }}>
            <div>
              <h3 className="panel__title">{t("common.hotel")} Kullanıcıları</h3>
              <p className="panel__subtitle">
                Rol atayın, erişim durumlarını yönetin ve gerektiğinde parolaları güncelleyin.
              </p>
            </div>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setUserModal({ mode: "create" })}
              >
                Yeni Kullanıcı
              </button>
            </div>
          </div>

          {usersQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
                Kullanıcılar yükleniyor
              </h3>
              <p style={{ margin: 0 }}>Lütfen birkaç saniye bekleyin.</p>
            </div>
          ) : usersQuery.isError ? (
            <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
              <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
                Kullanıcı bilgileri alınamadı
              </h3>
              <p style={{ margin: 0 }}>Sayfayı yenileyip tekrar deneyebilirsiniz.</p>
            </div>
          ) : usersQuery.data && usersQuery.data.length > 0 ? (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kullanıcı</th>
                    <th>Rol</th>
                    <th>Durum</th>
                    <th>Son Giriş</th>
                    <th>Oluşturulma</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.data.map((user) => {
                    const statusClass = user.is_active ? "badge badge--success" : "badge badge--danger";
                    const statusLabel = user.is_active ? "Aktif" : "Pasif";
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.email}</strong>
                          <div className="table-cell-muted">Kullanıcı ID: {user.id}</div>
                        </td>
                        <td>{userRoleLabels[user.role] ?? user.role}</td>
                        <td>
                          <span className={statusClass}>{statusLabel}</span>
                        </td>
                        <td>{formatDateTime(user.last_login_at)}</td>
                        <td>{formatDateTime(user.created_at)}</td>
                        <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => setUserModal({ mode: "edit", user })}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => setResetModal({ user })}
                        >
                          Parola Sıfırla
                        </button>
                      </div>
                    </td>
                  </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <Users className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
                Kullanıcı bulunmuyor
              </h3>
              <p style={{ margin: 0 }}>{t("common.hotel")} için yeni kullanıcı ekleyerek erişim tanımlayabilirsiniz.</p>
            </div>
          )}
        </>
      )}

      {!isLoading && !tenantDetail && (
        <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
          <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
            {t("common.hotel")} bilgisi bulunamadı
          </h3>
          <p style={{ margin: 0 }}>Detaylar yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>
        </div>
      )}

      {userModal && (
        <Modal
          isOpen
          title={userModal.mode === "create" ? "Yeni Tenant Kullanıcısı" : "Kullanıcıyı Düzenle"}
          onClose={handleUserModalClose}
          disableClose={isUserMutationPending}
        >
          <form className="form-grid" onSubmit={onSubmitUser}>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">E-posta</span>
              <input
                type="email"
                placeholder="kullanici@example.com"
                readOnly={userModal.mode === "edit"}
                {...registerUser("email", {
                  required: "E-posta zorunlu",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Geçerli bir e-posta girin",
                  },
                })}
              />
              {userFormErrors.email && <span className="field-error">{userFormErrors.email.message}</span>}
            </label>

            <label className="form-field">
              <span className="form-field__label">
                {userModal.mode === "create" ? "Parola" : "Yeni Parola"}
              </span>
              <input
                type="password"
                placeholder={userModal.mode === "create" ? "En az 8 karakter" : "Opsiyonel"}
                {...registerUser("password")}
              />
              {userFormErrors.password && <span className="field-error">{userFormErrors.password.message}</span>}
              {userModal.mode === "edit" && (
                <span className="table-cell-muted">Boş bırakılırsa parola değişmez.</span>
              )}
            </label>

            <label className="form-field">
              <span className="form-field__label">Rol</span>
              <select {...registerUser("role", { required: "Rol seçin" })}>
                {tenantUserRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field form-field--inline">
              <span className="form-field__label">Aktif</span>
              <input type="checkbox" {...registerUser("is_active")} />
            </label>

            <div className="form-actions form-grid__field--full">
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={handleUserModalClose}
                disabled={isUserMutationPending}
              >
                Vazgeç
              </button>
              <button type="submit" className="btn btn--primary" disabled={isUserMutationPending}>
                {isUserMutationPending
                  ? "Kaydediliyor..."
                  : userModal.mode === "create"
                    ? "Kullanıcı Oluştur"
                    : "Kullanıcıyı Kaydet"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {resetModal && (
        <Modal
          isOpen
          title="Parola Sıfırla"
          onClose={handleResetModalClose}
          disableClose={isResetPending}
          width="440px"
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const password = (data.get("password") as string | null)?.trim() ?? "";
              if (password.length < 8) {
                notify({ title: "Parola en az 8 karakter olmalı", type: "error" });
                return;
              }
              void resetPasswordMutation.mutateAsync({ userId: resetModal.user.id, password });
            }}
          >
            <p className="form-grid__field--full" style={{ color: "#475569" }}>
              <strong>{resetModal.user.email}</strong> kullanıcısının parolasını belirleyin. Yeni parola kaydedildiğinde
              kullanıcı eski parolasıyla giriş yapamayacaktır.
            </p>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Yeni Parola</span>
              <input
                name="password"
                type="password"
                placeholder="En az 8 karakter"
                disabled={isResetPending}
              />
            </label>
            <div className="form-actions form-grid__field--full">
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={handleResetModalClose}
                disabled={isResetPending}
              >
                Vazgeç
              </button>
              <button type="submit" className="btn btn--primary" disabled={isResetPending}>
                {isResetPending ? "Kaydediliyor..." : "Parolayı Güncelle"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
