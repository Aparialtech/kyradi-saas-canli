import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Edit, Building2, Loader2, AlertCircle, Users, UserPlus, Settings } from "../../../lib/lucide";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { ModernInput } from "../../../components/ui/ModernInput";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";

import {
  adminTenantService,
  type Tenant,
  type TenantCreatePayload,
  type TenantUpdatePayload,
  type TenantDetail,
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [quotaEditingTenantId, setQuotaEditingTenantId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

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

  // Paginate filtered data
  const paginatedTenants = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredTenants.slice(start, end);
  }, [filteredTenants, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredTenants.length, page, pageSize);
  }, [filteredTenants.length, page, pageSize]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, [setPage]);

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
      setShowForm(false);
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
      setEditingTenant(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });


  const {
    register,
    handleSubmit,
    reset,
    setError,
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
    const slugPattern = /^[a-z0-9][a-z0-9_-]*$/;
    const normalizedSlug = values.slug?.trim().toLowerCase() || "";

    if (!slugPattern.test(normalizedSlug)) {
      setError("slug", {
        type: "pattern",
        message: "Sadece küçük harf, rakam, tire (-) ve alt çizgi (_) kullanılabilir.",
      });
      return;
    }

    const payload = { ...values, slug: normalizedSlug };

    if (editingTenant) {
      const { slug, ...updatePayload } = payload;
      await updateMutation.mutateAsync({ id: editingTenant.id, payload: updatePayload });
      setEditingTenant(null);
      reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
    } else {
      await createMutation.mutateAsync(payload);
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
                  onClick={() => navigate("/admin/tenants/new")}
                  leftIcon={<Building2 className="h-4 w-4" />}
                >
                  Yeni Otel Ekle
                </ModernButton>
              ),
            },
          ]}
        />
      </motion.div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
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
                    {...register("slug", {
                      required: `${t("common.shortName")}`,
                      pattern: {
                        value: /^[a-z0-9][a-z0-9_-]*$/,
                        message: "Küçük harf, rakam, tire (-) ve alt çizgi (_) kullanın.",
                      },
                      setValueAs: (value: string) => (value ? value.trim().toLowerCase() : ""),
                    })}
                    error={errors.slug?.message}
                    helperText={`${t("common.shortNameHint")} (küçük harf, rakam, - , _)`}
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
                  <ModernButton
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingTenant(null);
                      reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
                      setShowForm(false);
                    }}
                  >
                    {t("common.cancel")}
                  </ModernButton>
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
          </motion.div>
        )}
      </AnimatePresence>

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <DataToolbar
            searchValue={searchTerm}
            onSearchChange={handleSearchChange}
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
                      onClick={() => setQuotaEditingTenantId(tenant.id)}
                      leftIcon={<Settings className="h-4 w-4" />}
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Kota
                    </ModernButton>
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
                        setShowForm(true);
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
            data={paginatedTenants}
            loading={tenantsQuery.isLoading}
            striped
            hoverable
            stickyHeader
            showRowNumbers
            pagination={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
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
          onClose={() => setSelectedTenantId(null)}
          notify={push}
        />
      )}

      {quotaEditingTenantId && (
        <TenantQuotaModal
          tenantId={quotaEditingTenantId}
          onClose={() => setQuotaEditingTenantId(null)}
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
  onClose: () => void;
  notify: (payload: ToastPayload) => void;
}

function TenantDetailCard({
  tenantId,
  tenantDetail,
  isLoading,
  onClose,
  notify,
}: TenantDetailCardProps) {
  const { t } = useTranslation();
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
    <div className="panel" style={{ position: 'relative', minHeight: '100vh', paddingBottom: '100px', maxHeight: '100vh', overflowY: 'auto' }}>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: 'var(--space-20)' }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-1) 0' }}>
              Tenant Ayarları – {tenantDetail.tenant.name}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Otel bilgilerini, kota ve finans ayarlarını yönetin
            </p>
          </div>

          {/* Card 1: Genel Otel Ayarları */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Genel Bilgiler
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Otel adı, kısa ad, plan, durum ve diğer genel bilgiler
              </p>
            </div>
            
            <div className="form-grid">
              <label className="form-field">
                <span className="form-field__label">Otel Adı</span>
                <input type="text" value={tenantDetail.tenant.name} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }} />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Otel adı değiştirmek için tenant düzenleme sayfasını kullanın
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Kısa Ad (Slug)</span>
                <input type="text" value={tenantDetail.tenant.slug} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }} />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  URL'de kullanılan benzersiz tanımlayıcı
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Plan</span>
                <input type="text" value={tenantDetail.tenant.plan} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }} />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Mevcut abonelik planı
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Durum</span>
                <input type="text" value={tenantDetail.tenant.is_active ? "Aktif" : "Pasif"} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }} />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Tenant'ın aktif/pasif durumu
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Oluşturulma Tarihi</span>
                <input type="text" value={new Date(tenantDetail.tenant.created_at).toLocaleDateString("tr-TR")} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }} />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Tenant kaydının oluşturulma tarihi
                </small>
              </label>
              
              {tenantDetail.tenant.logo_url && (
                <label className="form-field">
                  <span className="form-field__label">Logo URL</span>
                  <input type="text" value={tenantDetail.tenant.logo_url} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed' }} />
                  <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                    Otel logosu URL'i
                  </small>
                </label>
              )}
              
              {tenantDetail.tenant.brand_color && (
                <label className="form-field">
                  <span className="form-field__label">Marka Rengi</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input type="text" value={tenantDetail.tenant.brand_color} readOnly style={{ background: 'var(--bg-tertiary)', cursor: 'not-allowed', flex: 1 }} />
                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: tenantDetail.tenant.brand_color, border: '1px solid var(--border-primary)' }} />
                  </div>
                  <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                    Otel marka rengi (hex)
                  </small>
                </label>
              )}
            </div>
          </ModernCard>
          {/* Card 2: Kota Ayarları */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Kota Ayarları
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Tenant'ın oluşturabileceği maksimum kaynak sayılarını belirleyin
              </p>
            </div>
            
            <div className="form-grid">
              <label className="form-field">
                <span className="form-field__label">Maks. Lokasyon Sayısı</span>
                <input
                  type="number"
                  min={0}
                  value={quotaLocationCount}
                  onChange={(e) => setQuotaLocationCount(e.target.value)}
                  placeholder="Sınırsız için boş bırakın"
                />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Tenant'ın oluşturabileceği maksimum lokasyon sayısı
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Maks. Depo Sayısı</span>
                <input
                  type="number"
                  min={0}
                  value={quotaStorageCount}
                  onChange={(e) => setQuotaStorageCount(e.target.value)}
                  placeholder="Sınırsız için boş bırakın"
                />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Tenant'ın oluşturabileceği maksimum depo sayısı
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Maks. Kullanıcı Sayısı</span>
                <input
                  type="number"
                  min={0}
                  value={quotaUserCount}
                  onChange={(e) => setQuotaUserCount(e.target.value)}
                  placeholder="Sınırsız için boş bırakın"
                />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Tenant'ın oluşturabileceği maksimum aktif kullanıcı sayısı
                </small>
              </label>
              
              <label className="form-field">
                <span className="form-field__label">Maks. Rezervasyon Sayısı</span>
                <input
                  type="number"
                  min={0}
                  value={quotaReservationCount}
                  onChange={(e) => setQuotaReservationCount(e.target.value)}
                  placeholder="Sınırsız için boş bırakın"
                />
                <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                  Tenant'ın oluşturabileceği maksimum toplam rezervasyon sayısı
                </small>
              </label>
            </div>
          </ModernCard>

          {/* Card 3: Finans Ayarları */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Finans Ayarları
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Platform komisyon oranını ve finansal ayarları yapılandırın
              </p>
            </div>
            
            <div className="form-grid">
              <div className="form-grid__field--full">
                <label style={{ display: 'block', marginBottom: 'var(--space-3)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  Komisyon Oranı (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={financialCommissionRate || metadataQuery.data?.financial.commission_rate || 5.0}
                    onChange={(e) => setFinancialCommissionRate(e.target.value)}
                    style={{ flex: 1, height: '8px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)', outline: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={financialCommissionRate}
                    onChange={(e) => setFinancialCommissionRate(e.target.value)}
                    placeholder="5.0"
                    style={{ width: '120px', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', fontSize: 'var(--text-base)' }}
                  />
                  <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontWeight: 600, minWidth: '24px' }}>%</span>
                </div>
                <small style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', display: 'block', lineHeight: 1.5 }}>
                  Kyradi platform komisyon oranı (0-100%). Raporlar ve hakedişler bu orana göre hesaplanır.
                </small>
              </div>
            </div>
          </ModernCard>

          {/* Limit Kullanımı Tablosu (Bilgilendirme) */}
          {limitUsage.length > 0 && (
            <ModernCard variant="glass" padding="lg">
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-1) 0' }}>
                  Limit Kullanımı
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Mevcut kaynak kullanım durumu
                </p>
              </div>
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
              <p className="table-cell-muted" style={{ marginTop: "var(--space-3)", fontSize: 'var(--text-xs)' }}>
                * Self-service ve rapor export limitleri kaydırmalı 24 saatlik pencerede takip edilir.
              </p>
            </ModernCard>
          )}

          {/* Sabit Action Bar */}
          <div style={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            background: 'var(--bg-primary)', 
            borderTop: '1px solid var(--border-primary)', 
            padding: 'var(--space-4) var(--space-6)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            zIndex: 100,
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)'
          }}>
            <button
              type="button"
              className="btn btn--ghost-dark"
              onClick={onClose}
              disabled={updateMetadataMutation.isPending}
            >
              İptal
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={(e) => {
                e.preventDefault();
                handleMetadataUpdate(e);
              }}
              disabled={updateMetadataMutation.isPending}
            >
              {updateMetadataMutation.isPending ? "Güncelleniyor..." : "Kaydet"}
            </button>
          </div>

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
          </div>
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

interface TenantQuotaModalProps {
  tenantId: string;
  onClose: () => void;
  notify: (payload: ToastPayload) => void;
}

function TenantQuotaModal({ tenantId, onClose, notify }: TenantQuotaModalProps) {
  const queryClient = useQueryClient();
  
  // Metadata state
  const [quotaLocationCount, setQuotaLocationCount] = useState("");
  const [quotaStorageCount, setQuotaStorageCount] = useState("");
  const [quotaUserCount, setQuotaUserCount] = useState("");
  const [quotaReservationCount, setQuotaReservationCount] = useState("");
  const [financialCommissionRate, setFinancialCommissionRate] = useState("");
  const [featureAiEnabled, setFeatureAiEnabled] = useState(true);
  const [featureAdvancedReportsEnabled, setFeatureAdvancedReportsEnabled] = useState(true);
  const [featurePaymentGatewayEnabled, setFeaturePaymentGatewayEnabled] = useState(true);
  
  const tenantQuery = useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () => adminTenantService.list().then(tenants => tenants.find(t => t.id === tenantId)),
    enabled: Boolean(tenantId),
  });
  
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
      onClose();
    },
    onError: (error: unknown) => {
      notify({
        title: "Güncelleme başarısız",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });
  
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
  
  const tenant = tenantQuery.data;
  
  return (
    <Modal
      isOpen
      title={tenant ? `Kota ve Finans Ayarları - ${tenant.name}` : "Kota ve Finans Ayarları"}
      onClose={onClose}
      disableClose={updateMetadataMutation.isPending}
      width="900px"
    >
      {metadataQuery.isLoading ? (
        <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
          <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
            Ayarlar yükleniyor
          </h3>
          <p style={{ margin: 0 }}>Lütfen bekleyin...</p>
        </div>
      ) : metadataQuery.isError ? (
        <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
          <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>
            Ayarlar yüklenemedi
          </h3>
          <p style={{ margin: 0 }}>{getErrorMessage(metadataQuery.error)}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => metadataQuery.refetch()}
            style={{ marginTop: 'var(--space-4)' }}
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <form className="form-grid" onSubmit={handleMetadataUpdate} style={{ marginTop: 'var(--space-4)' }}>
          <div className="form-grid__field--full" style={{ marginBottom: 'var(--space-4)' }}>
            <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              Kota Ayarları
            </h4>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Tenant'ın oluşturabileceği maksimum kaynak sayılarını belirleyin
            </p>
          </div>
          
          <label className="form-field">
            <span className="form-field__label">Maks. Lokasyon Sayısı</span>
            <input
              type="number"
              min={0}
              value={quotaLocationCount}
              onChange={(e) => setQuotaLocationCount(e.target.value)}
              placeholder="Sınırsız için boş bırakın"
            />
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Tenant'ın oluşturabileceği maksimum lokasyon sayısı
            </small>
          </label>
          
          <label className="form-field">
            <span className="form-field__label">Maks. Depo Sayısı</span>
            <input
              type="number"
              min={0}
              value={quotaStorageCount}
              onChange={(e) => setQuotaStorageCount(e.target.value)}
              placeholder="Sınırsız için boş bırakın"
            />
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Tenant'ın oluşturabileceği maksimum depo sayısı
            </small>
          </label>
          
          <label className="form-field">
            <span className="form-field__label">Maks. Kullanıcı Sayısı</span>
            <input
              type="number"
              min={0}
              value={quotaUserCount}
              onChange={(e) => setQuotaUserCount(e.target.value)}
              placeholder="Sınırsız için boş bırakın"
            />
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Tenant'ın oluşturabileceği maksimum aktif kullanıcı sayısı
            </small>
          </label>
          
          <label className="form-field">
            <span className="form-field__label">Maks. Rezervasyon Sayısı</span>
            <input
              type="number"
              min={0}
              value={quotaReservationCount}
              onChange={(e) => setQuotaReservationCount(e.target.value)}
              placeholder="Sınırsız için boş bırakın"
            />
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Tenant'ın oluşturabileceği maksimum toplam rezervasyon sayısı
            </small>
          </label>
          
          <div className="form-grid__field--full" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              Finans Ayarları
            </h4>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Platform komisyon oranını ayarlayın
            </p>
          </div>
          
          <div className="form-grid__field--full">
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
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={financialCommissionRate}
                onChange={(e) => setFinancialCommissionRate(e.target.value)}
                placeholder="5.0"
                style={{ width: '120px', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}
              />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>%</span>
            </div>
            <small style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', display: 'block', marginTop: 'var(--space-1)' }}>
              Kyradi platform komisyon oranı (0-100%). Raporlar ve hakedişler bu orana göre hesaplanır.
            </small>
          </div>
          
          <div className="form-grid__field--full" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>
              Özellik Bayrakları
            </h4>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              Tenant için kullanılabilir özellikleri etkinleştirin veya devre dışı bırakın
            </p>
          </div>
          
          <div className="form-grid__field--full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
              <input
                type="checkbox"
                checked={featureAiEnabled}
                onChange={(e) => setFeatureAiEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
                  AI Asistanı
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                  KYRADI AI Asistanı özelliğini etkinleştir/devre dışı bırak
                </div>
              </div>
            </label>
          </div>
          
          <div className="form-grid__field--full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
              <input
                type="checkbox"
                checked={featureAdvancedReportsEnabled}
                onChange={(e) => setFeatureAdvancedReportsEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
                  Gelişmiş Raporlar
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                  Gelişmiş analiz ve raporlama özelliklerini etkinleştir/devre dışı bırak
                </div>
              </div>
            </label>
          </div>
          
          <div className="form-grid__field--full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
              <input
                type="checkbox"
                checked={featurePaymentGatewayEnabled}
                onChange={(e) => setFeaturePaymentGatewayEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
                  Ödeme Gateway
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                  Online ödeme gateway entegrasyonunu etkinleştir/devre dışı bırak
                </div>
              </div>
            </label>
          </div>
          
          <div className="form-actions form-grid__field--full" style={{ marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="btn btn--ghost-dark"
              onClick={onClose}
              disabled={updateMetadataMutation.isPending}
            >
              İptal
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={updateMetadataMutation.isPending}
            >
              {updateMetadataMutation.isPending ? "Güncelleniyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
