import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import {
  adminTenantService,
  type Tenant,
  type TenantCreatePayload,
  type TenantUpdatePayload,
  type TenantDetail,
  type TenantPlanLimitsUpdatePayload,
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

  const tenantsQuery = useQuery({ queryKey: ["admin", "tenants"], queryFn: adminTenantService.list });
  const tenantDetailQuery = useQuery({
    queryKey: ["admin", "tenants", selectedTenantId, "detail"],
    queryFn: () => adminTenantService.detail(selectedTenantId!),
    enabled: Boolean(selectedTenantId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TenantCreatePayload) => adminTenantService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      push({ title: "Tenant eklendi", type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: "Kayıt başarısız", description: getErrorMessage(error), type: "error" });
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
      const { slug: _slug, ...payload } = values;
      await updateMutation.mutateAsync({ id: editingTenant.id, payload });
      setEditingTenant(null);
    } else {
      await createMutation.mutateAsync(values);
    }
    reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
  });

  return (
    <section className="page">
      <ToastContainer messages={messages} />

      <header className="page-header">
        <div>
          <h1 className="page-title">Tenant Yönetimi</h1>
          <p className="page-subtitle">
            Tenant bilgilerini, lisans planlarını ve markalama ayarlarını buradan yönetebilirsiniz.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditingTenant(null);
              reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
            }}
          >
            Yeni Tenant
          </button>
        </div>
      </header>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">
              {editingTenant ? `${editingTenant.name} Tenantını Güncelle` : "Yeni Tenant Oluştur"}
            </h2>
            <p className="panel__subtitle">
              Slug ve ad gibi temel bilgileri doldurun. Dilerseniz marka rengi ve logo URL’i ekleyebilirsiniz.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={submit}>
          {!editingTenant && (
            <label className="form-field">
              <span className="form-field__label">{t("common.shortName")}</span>
              <input
                {...register("slug", { required: `${t("common.shortName")} zorunlu` })}
                placeholder="demo-hotel"
              />
              <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                {t("common.shortNameHint")}
              </small>
              {errors.slug && <span className="field-error">{errors.slug.message}</span>}
            </label>
          )}

          <label className="form-field">
            <span className="form-field__label">{t("admin.tenants.hotelName")}</span>
            <input {...register("name", { required: "Ad zorunlu" })} placeholder="Otel Adı" />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">Plan</span>
            <input {...register("plan")} placeholder="pro" />
          </label>

          <label className="form-field form-field--inline">
            <span className="form-field__label">Aktif</span>
            <input type="checkbox" {...register("is_active")} />
          </label>

          <label className="form-field">
            <span className="form-field__label">Marka Rengi</span>
            <input {...register("brand_color")} placeholder="#00A389" />
          </label>

          <label className="form-field">
            <span className="form-field__label">Logo URL</span>
            <input {...register("logo_url")} placeholder="https://..." />
          </label>

          <div className="form-actions form-grid__field--full">
            {editingTenant && (
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={() => {
                  setEditingTenant(null);
                  reset({ slug: "", name: "", plan: "standard", is_active: true, brand_color: "", logo_url: "" });
                }}
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTenant
                ? updateMutation.isPending
                  ? "Güncelleniyor..."
                  : "Tenantı Güncelle"
                : createMutation.isPending
                  ? "Kaydediliyor..."
                  : "Tenant Oluştur"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">{t("admin.tenants.title")} - Liste</h2>
            <p className="panel__subtitle">
              Sisteme kayıtlı {t("common.hotel")}lar, plan durumları ve limitler.
            </p>
          </div>
        </div>

        {tenantsQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">{t("admin.tenants.title")} listesi yükleniyor</h3>
            <p>Liste birkaç saniye içinde görüntülenecektir.</p>
          </div>
        ) : tenantsQuery.isError ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">{t("admin.tenants.title")} listesi alınamadı</h3>
            <p>Lütfen sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        ) : tenantsQuery.data && tenantsQuery.data.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("common.hotel")}</th>
                  <th>{t("common.shortName")}</th>
                  <th>{t("admin.tenants.plan")}</th>
                  <th>{t("admin.tenants.status")}</th>
                  <th>{t("common.createdAt")}</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {tenantsQuery.data.map((tenant) => {
                  const statusClass = tenant.is_active ? "badge badge--success" : "badge badge--danger";
                  const statusLabel = tenant.is_active ? "Aktif" : "Pasif";
                  return (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.name}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>
                          {tenant.slug}
                        </code>
                      </td>
                      <td>{tenant.plan}</td>
                      <td>
                        <span className={statusClass}>{statusLabel}</span>
                      </td>
                      <td>{new Date(tenant.created_at).toLocaleString("tr-TR")}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="action-link"
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
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => {
                              setSelectedTenantId(tenant.id);
                            }}
                          >
                            Detay
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
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
            <h3 className="empty-state__title">Henüz {t("common.hotel")} kaydı yok</h3>
            <p>Henüz hiç {t("common.hotel")} kaydı yok. Yukarıdaki formu kullanarak yeni bir {t("common.hotel")} oluşturabilirsiniz.</p>
          </div>
        )}
      </div>

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
    </section>
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
  const [commissionRate, setCommissionRate] = useState("");
  const [maxActiveReservations, setMaxActiveReservations] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [maxSelfServiceDaily, setMaxSelfServiceDaily] = useState("");
  const [maxTotalReservations, setMaxTotalReservations] = useState("");
  const [maxReportExports, setMaxReportExports] = useState("");
  const [maxStorageMb, setMaxStorageMb] = useState("");
  const [userModal, setUserModal] = useState<{ mode: "create" | "edit"; user?: AdminTenantUser } | null>(null);
  const [resetModal, setResetModal] = useState<{ user: AdminTenantUser } | null>(null);

  const queryClient = useQueryClient();
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
        <div className="empty-state">
          <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
          <h3 className="empty-state__title">Detaylar yükleniyor</h3>
          <p>Lütfen bekleyin...</p>
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
              <p className="stat-card__value">{commissionRate || "5.0"}%</p>
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
              <span className="form-field__label">{t("admin.tenants.commissionRate")} (%)</span>
              <input
                value={commissionRate}
                onChange={(event) => setCommissionRate(event.target.value)}
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder="5.0"
              />
              <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                Kyradi komisyon oranı (placeholder - henüz backend'e bağlı değil)
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
            <div className="empty-state">
              <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
              <h3 className="empty-state__title">Kullanıcılar yükleniyor</h3>
              <p>Lütfen birkaç saniye bekleyin.</p>
            </div>
          ) : usersQuery.isError ? (
            <div className="empty-state">
              <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
              <h3 className="empty-state__title">Kullanıcı bilgileri alınamadı</h3>
              <p>Sayfayı yenileyip tekrar deneyebilirsiniz.</p>
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
            <div className="empty-state">
              <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>👥</div>
              <h3 className="empty-state__title">Kullanıcı bulunmuyor</h3>
              <p>{t("common.hotel")} için yeni kullanıcı ekleyerek erişim tanımlayabilirsiniz.</p>
            </div>
          )}
        </>
      )}

      {!isLoading && !tenantDetail && (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h3 className="empty-state__title">{t("common.hotel")} bilgisi bulunamadı</h3>
          <p>Detaylar yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>
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
