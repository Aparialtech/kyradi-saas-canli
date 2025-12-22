import { useState, useCallback, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, Edit, Key, UserCheck, UserX, Loader2, AlertCircle, Search, Mail, Phone, Shield, CheckCircle2, XCircle, AlertTriangle } from "../../../lib/lucide";

import {
  tenantUserService,
  type TenantUser,
  type TenantUserCreatePayload,
  type TenantUserUpdatePayload,
} from "../../../services/partner/users";
import { quotaService } from "../../../services/partner/reports";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { usePagination, calculatePaginationMeta } from "../../../components/common/Pagination";
import { getErrorMessage } from "../../../lib/httpError";
import { useConfirm } from "../../../components/common/ConfirmDialog";
import type { UserRole } from "../../../types/auth";
import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../hooks/useTranslation";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";
import { PasswordStrength } from "../../../components/common/PasswordStrength";

// Partner panelde sadece personel (staff) rolleri yönetilebilir
const staffRoles = ["storage_operator", "hotel_manager", "accounting"] as const satisfies readonly UserRole[];

const formSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.union([z.string().min(8, "Parola en az 8 karakter olmalı"), z.literal("")]),
  role: z.enum(staffRoles),
  is_active: z.boolean(),
  phone_number: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const roleLabels: Record<UserRole, string> = {
  storage_operator: "Depo Görevlisi",
  hotel_manager: "Otel Yöneticisi",
  accounting: "Muhasebe",
  super_admin: "Süper Admin",
  support: "Destek",
  tenant_admin: "Tenant Admin",
  staff: "Personel",
  viewer: "İzleyici",
};

export function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const { user: currentUser } = useAuth();
  const confirmDialog = useConfirm();
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [resetUser, setResetUser] = useState<TenantUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetShouldSendInvite, setResetShouldSendInvite] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const usersQuery = useQuery({
    queryKey: ["tenant", "users"],
    queryFn: tenantUserService.list,
  });

  const quotaQuery = useQuery({
    queryKey: ["quota"],
    queryFn: quotaService.getQuotaInfo,
  });

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    if (!searchTerm.trim()) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter((user) => {
      const email = (user.email ?? "").toLowerCase();
      const phone = (user.phone_number ?? "").toLowerCase();
      const role = (roleLabels[user.role] ?? user.role).toLowerCase();
      
      return email.includes(term) || phone.includes(term) || role.includes(term);
    });
  }, [usersQuery.data, searchTerm]);

  // Paginate data
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredUsers.slice(start, end);
  }, [filteredUsers, page, pageSize]);

  const paginationMeta = useMemo(() => {
    return calculatePaginationMeta(filteredUsers.length, page, pageSize);
  }, [filteredUsers.length, page, pageSize]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page on search
  }, [setPage]);

  const handleNewUser = useCallback(() => {
    navigate('/app/users/new');
  }, [navigate]);

  const handleEditUser = useCallback((user: TenantUser) => {
    navigate(`/app/users/${user.id}/edit`);
  }, [navigate]);

  const createMutation = useMutation({
    mutationFn: (payload: TenantUserCreatePayload) => tenantUserService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: t("users.created"), type: "success" });
      reset({ email: "", password: "", role: "storage_operator", is_active: true, phone_number: "" });
      setEditingUser(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: t("users.createError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenantUserUpdatePayload }) =>
      tenantUserService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: t("users.updated"), type: "success" });
      reset({ email: "", password: "", role: "storage_operator", is_active: true, phone_number: "" });
      setEditingUser(null);
      setShowForm(false);
    },
    onError: (error: unknown) => {
      push({ title: t("users.updateError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => tenantUserService.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: t("users.deactivated"), type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: t("users.deleteError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const passwordResetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      tenantUserService.update(id, { password }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: "Parola güncellendi", description: variables.password, type: "success" });
      copyToClipboard(variables.password).catch(() => undefined);
      if (resetUser && resetShouldSendInvite) {
        openInviteEmail(resetUser.email, variables.password);
      }
      setResetUser(null);
      setResetPassword("");
      setResetShouldSendInvite(true);
    },
    onError: (error: unknown) => {
      push({ title: "Parola güncellenemedi", description: getErrorMessage(error), type: "error" });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "storage_operator",
      is_active: true,
      phone_number: "",
    },
  });

  const generatePassword = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$&";
    let value = "";
    for (let i = 0; i < 12; i += 1) {
      value += chars[Math.floor(Math.random() * chars.length)];
    }
    return value;
  }, []);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          push({ title: "Panoya kopyalandı", type: "success" });
        }
      } catch {
        // ignore
      }
    },
    [push],
  );

  const openInviteEmail = useCallback((email: string, tempPassword?: string) => {
    const subject = encodeURIComponent("KYRADİ panel daveti");
    const body = encodeURIComponent(
      [
        "Merhaba,",
        "",
        "Seni KYRADİ partner paneline davet ettik.",
        `Giriş e-postası: ${email}`,
        tempPassword ? `Geçici parola: ${tempPassword}` : "Parolanı yönetici iletecektir.",
        "",
        "Panel adresi: https://app.kyradi.com/login",
        "",
        "Teşekkürler.",
      ].join("\n"),
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  }, []);

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingUser(null);
    reset({ email: "", password: "", role: "storage_operator", is_active: true, phone_number: "" });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (editingUser) {
      const payload: TenantUserUpdatePayload = {
        role: values.role,
        is_active: values.is_active,
      };
      if (values.password) {
        payload.password = values.password;
      }
      if (values.phone_number) {
        // Telefon numarasını temizle ve formatla
        let phone = values.phone_number.trim().replace(/\s+/g, "").replace(/[^\d+]/g, "");
        if (phone.startsWith("0")) {
          phone = "90" + phone.substring(1);
        } else if (!phone.startsWith("90") && phone.length === 10) {
          phone = "90" + phone;
        }
        payload.phone_number = phone || null;
      } else {
        payload.phone_number = null;
      }
      await updateMutation.mutateAsync({ id: editingUser.id, payload });
    } else {
      let password = values.password;
      let autogenerated = false;
      if (!password) {
        password = generatePassword();
        autogenerated = true;
      }
      const payload: TenantUserCreatePayload = {
        email: values.email,
        password,
        role: values.role,
        is_active: values.is_active,
      };
      await createMutation.mutateAsync(payload);
      if (autogenerated) {
        push({ title: "Geçici parola oluşturuldu", description: password, type: "info" });
        copyToClipboard(password).catch(() => undefined);
        openInviteEmail(payload.email, password);
      }
    }
  });

  const handleResetClose = () => {
    if (passwordResetMutation.isPending) {
      return;
    }
    setResetUser(null);
    setResetPassword("");
    setResetShouldSendInvite(true);
  };

  const handleResetSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!resetUser) {
        return;
      }
      if (resetPassword.trim().length < 8) {
        push({ title: "Parola geçersiz", description: "En az 8 karakter girin.", type: "error" });
        return;
      }
      passwordResetMutation.mutate({
        id: resetUser.id,
        password: resetPassword.trim(),
      });
    },
    [passwordResetMutation, resetPassword, resetUser, push],
  );

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
            {t("users.title")}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("users.subtitle")}
          </p>
        </div>
        <ModernButton
          variant="primary"
          onClick={handleNewUser}
          leftIcon={<UserPlus className="h-4 w-4" />}
        >
          {t("users.newUser")}
        </ModernButton>
      </motion.div>

      {/* Quota Warning Banner */}
      {quotaQuery.data?.users && quotaQuery.data.users.limit !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            marginBottom: 'var(--space-6)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            background: quotaQuery.data.users.percentage >= 100
              ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)'
              : quotaQuery.data.users.percentage >= 80
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            border: `1px solid ${
              quotaQuery.data.users.percentage >= 100
                ? 'rgba(220, 38, 38, 0.3)'
                : quotaQuery.data.users.percentage >= 80
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(34, 197, 94, 0.3)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <AlertTriangle 
            className="h-5 w-5" 
            style={{ 
              color: quotaQuery.data.users.percentage >= 100
                ? '#dc2626'
                : quotaQuery.data.users.percentage >= 80
                ? '#f59e0b'
                : '#22c55e',
              flexShrink: 0
            }} 
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>
              {quotaQuery.data.users.percentage >= 100
                ? t("quota.users.full")
                : quotaQuery.data.users.percentage >= 80
                ? t("quota.users.nearLimit")
                : t("quota.users.title")}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {t("quota.users.usage", { current: quotaQuery.data.users.current, limit: quotaQuery.data.users.limit })}
              {quotaQuery.data.users.percentage >= 100 && t("quota.users.cannotCreate")}
              {quotaQuery.data.users.percentage >= 80 && quotaQuery.data.users.percentage < 100 && t("quota.users.nearLimitHint")}
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden', marginBottom: 'var(--space-6)' }}
          >
            <ModernCard variant="glass" padding="lg">
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                  {editingUser ? t("users.editUser") : t("users.newUser")}
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  {t("users.formSubtitle")}
                </p>
              </div>

              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <ModernInput
            label={t("users.email")}
            type="email"
            placeholder="kullanici@ornek.com"
            {...register("email")}
            disabled={Boolean(editingUser)}
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            fullWidth
            required
          />

          <div>
            <ModernInput
              label={`${t("users.password")} ${editingUser ? `(${t("common.optional")})` : ""}`}
              type="text"
              placeholder="En az 8 karakter"
              {...register("password")}
              error={errors.password?.message}
              fullWidth
              required={!editingUser}
            />
            <PasswordStrength password={watch("password") || ""} showRequirements={!editingUser} />
            {!editingUser && (
              <ModernButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const temp = generatePassword();
                  setValue("password", temp);
                  push({ title: t("users.passwordGenerated"), description: temp, type: "info" });
                  copyToClipboard(temp).catch(() => undefined);
                }}
                style={{ marginTop: 'var(--space-2)' }}
              >
                {t("users.generatePassword")}
              </ModernButton>
            )}
          </div>

          <ModernInput
            label={t("users.phone")}
            type="tel"
            placeholder="0 545 219 68 63"
            {...register("phone_number")}
            leftIcon={<Phone className="h-4 w-4" />}
            error={errors.phone_number?.message}
            fullWidth
          />

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              {t("users.role")}
            </label>
            <select
              {...register("role")}
              style={{
                width: "100%",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              {staffRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input type="checkbox" {...register("is_active")} style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>{t("users.active")}</span>
          </label>

                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", marginTop: 'var(--space-2)' }}>
                  <ModernButton
                    type="button"
                    variant="ghost"
                    onClick={handleCancelForm}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {t("common.cancel")}
                  </ModernButton>
                  <ModernButton
                    type="submit"
                    variant="primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    isLoading={createMutation.isPending || updateMutation.isPending}
                    loadingText={t("common.saving")}
                  >
                    {editingUser ? t("common.update") : t("common.save")}
                  </ModernButton>
                </div>
              </form>
            </ModernCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              {t("users.listTitle")}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {filteredUsers.length} / {usersQuery.data?.length ?? 0} {t("common.records")}
            </p>
          </div>
          <div style={{ minWidth: "250px", flex: '1', maxWidth: '400px' }}>
            <ModernInput
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("common.search")}
              leftIcon={<Search className="h-4 w-4" />}
              fullWidth
            />
          </div>
        </div>

        {usersQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0' }}>Personel yükleniyor</h3>
            <p style={{ margin: 0 }}>Lütfen bekleyin...</p>
          </div>
        ) : usersQuery.isError ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: '#dc2626' }}>Personel listesi alınamadı</h3>
            <p style={{ margin: 0 }}>Sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <ModernTable
            columns={[
              {
                key: 'email',
                label: 'E-posta',
                render: (value, row) => {
                  const isCurrentUser = currentUser?.id === row.id;
                  return (
                    <div>
                      <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                        {value}
                      </div>
                      {isCurrentUser && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                          (Siz)
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'phone_number',
                label: 'Telefon',
                render: (value, row) => {
                  const phoneNumber = row.phone_number || value;
                  return phoneNumber ? <span>{phoneNumber}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                },
              },
              {
                key: 'role',
                label: 'Rol',
                render: (value) => (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-1)', 
                    padding: 'var(--space-1) var(--space-2)', 
                    borderRadius: 'var(--radius-sm)', 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    color: '#6366f1', 
                    fontSize: 'var(--text-xs)', 
                    fontWeight: 'var(--font-medium)' 
                  }}>
                    <Shield className="h-3 w-3" />
                    {roleLabels[value as UserRole] ?? value}
                  </span>
                ),
              },
              {
                key: 'is_active',
                label: 'Durum',
                render: (value) => {
                  const isActive = value;
                  return (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                      color: isActive ? '#16a34a' : '#dc2626',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--font-medium)',
                    }}>
                      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {isActive ? "Aktif" : "Pasif"}
                    </span>
                  );
                },
                align: 'center',
              },
              {
                key: 'last_login_at',
                label: t("common.lastLogin"),
                render: (value) => value
                  ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
                  : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
              },
              {
                key: 'actions',
                label: t("common.actions"),
                align: 'right',
                render: (_, row) => {
                  const isActive = row.is_active;
                  const isCurrentUser = currentUser?.id === row.id;
                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(row)}
                        leftIcon={<Edit className="h-4 w-4" />}
                      >
                        Düzenle
                      </ModernButton>
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResetUser(row);
                          setResetPassword(generatePassword());
                        }}
                        leftIcon={<Key className="h-4 w-4" />}
                      >
                        Parola
                      </ModernButton>
                      {isActive ? (
                        <ModernButton
                          variant="danger"
                          size="sm"
                          disabled={isCurrentUser}
                          onClick={async () => {
                            if (isCurrentUser) return;
                            const confirmed = await confirmDialog({
                              title: 'Kullanıcı Pasifleştirme',
                              message: `${row.email} kullanıcısını pasifleştirmek istediğinize emin misiniz?`,
                              confirmText: 'Pasifleştir',
                              cancelText: 'İptal',
                              variant: 'warning',
                            });
                            if (confirmed) {
                              deactivateMutation.mutate(row.id);
                            }
                          }}
                          title={isCurrentUser ? "Kendi hesabınızı pasifleştiremezsiniz" : undefined}
                          leftIcon={<UserX className="h-4 w-4" />}
                        >
                          Pasif
                        </ModernButton>
                      ) : (
                        <ModernButton
                          variant="success"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: row.id, payload: { is_active: true } })}
                          leftIcon={<UserCheck className="h-4 w-4" />}
                        >
                          Aktif
                        </ModernButton>
                      )}
                    </div>
                  );
                },
              },
            ] as ModernTableColumn<TenantUser>[]}
            data={paginatedUsers}
            loading={usersQuery.isLoading}
            striped
            hoverable
            stickyHeader
            showRowNumbers
            pagination={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Users className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>Henüz personel kaydı yok</h3>
            <p style={{ margin: 0 }}>Yukarıdaki formu kullanarak yeni personel ekleyebilirsiniz.</p>
          </div>
        )}
      </ModernCard>

      {resetUser && (
        <Modal
          isOpen
          disableClose={passwordResetMutation.isPending}
          onClose={handleResetClose}
          title="Parola Sıfırla"
          width="520px"
        >
          <form onSubmit={handleResetSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--color-muted)" }}>
              <strong style={{ color: "#0f172a" }}>{resetUser.email}</strong> kullanıcısının parolasını
              sıfırlamak üzeresiniz. Yeni parolayı kullanıcıya güvenli bir kanalla ilettiğinizden emin olun.
            </div>
            <label className="form-field">
              <span className="form-field__label">Yeni Parola</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  minLength={8}
                  required
                  disabled={passwordResetMutation.isPending}
                  style={{ flex: 1, fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setResetPassword(generatePassword())}
                  disabled={passwordResetMutation.isPending}
                >
                  Yenile
                </button>
              </div>
              <PasswordStrength password={resetPassword} showRequirements={false} />
            </label>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => copyToClipboard(resetPassword).catch(() => undefined)}
                disabled={!resetPassword || passwordResetMutation.isPending}
              >
                Panoya Kopyala
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => openInviteEmail(resetUser.email, resetPassword)}
                disabled={!resetPassword || passwordResetMutation.isPending}
              >
                Davet Taslağı Aç
              </button>
            </div>
            <label className="form-field form-field--inline">
              <input
                type="checkbox"
                checked={resetShouldSendInvite}
                onChange={(event) => setResetShouldSendInvite(event.target.checked)}
                disabled={passwordResetMutation.isPending}
              />
              <span className="form-field__label">
                Parola güncelleme tamamlanınca davet e-postası taslağı oluştur
              </span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={handleResetClose}
                disabled={passwordResetMutation.isPending}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={passwordResetMutation.isPending}
              >
                {passwordResetMutation.isPending ? "Güncelleniyor..." : "Parolayı Güncelle"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
