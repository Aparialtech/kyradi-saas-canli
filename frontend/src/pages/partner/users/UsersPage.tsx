import { useState, useCallback, useMemo, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  tenantUserService,
  type TenantUser,
  type TenantUserCreatePayload,
  type TenantUserUpdatePayload,
} from "../../../services/partner/users";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { SearchInput } from "../../../components/common/SearchInput";
import { getErrorMessage } from "../../../lib/httpError";
import type { UserRole } from "../../../types/auth";
import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../hooks/useTranslation";

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
  const queryClient = useQueryClient();
  const { messages, push } = useToast();
  const { user: currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [resetUser, setResetUser] = useState<TenantUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetShouldSendInvite, setResetShouldSendInvite] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const usersQuery = useQuery({
    queryKey: ["tenant", "users"],
    queryFn: tenantUserService.list,
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

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const createMutation = useMutation({
    mutationFn: (payload: TenantUserCreatePayload) => tenantUserService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: "Kullanıcı eklendi", type: "success" });
      reset({ email: "", password: "", role: "storage_operator", is_active: true, phone_number: "" });
      setEditingUser(null);
    },
    onError: (error: unknown) => {
      push({ title: "Kayıt başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TenantUserUpdatePayload }) =>
      tenantUserService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: "Kullanıcı güncellendi", type: "success" });
      reset({ email: "", password: "", role: "storage_operator", is_active: true, phone_number: "" });
      setEditingUser(null);
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => tenantUserService.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "users"] });
      push({ title: "Kullanıcı pasifleştirildi", type: "info" });
    },
    onError: (error: unknown) => {
      push({ title: "İşlem başarısız", description: getErrorMessage(error), type: "error" });
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

  const handleNew = () => {
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
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.users")}</h1>
          <p className="page-subtitle">
            Bu oteldeki personel yönetimi. Yeni personel ekleyebilir, mevcut personelin rollerini değiştirebilirsiniz.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={handleNew}>
            Yeni Personel
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">
              {editingUser ? "Personel Düzenle" : "Yeni Personel Ekle"}
            </h2>
            <p className="panel__subtitle">
              Personel bilgilerini doldurun ve kaydedin.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label className="form-field">
            <span className="form-field__label">E-posta</span>
            <input
              {...register("email")}
              type="email"
              placeholder="kullanici@ornek.com"
              disabled={Boolean(editingUser)}
            />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">
              Parola {editingUser ? "(opsiyonel)" : ""}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                {...register("password")}
                type="text"
                placeholder="En az 8 karakter"
                style={{ flex: 1 }}
              />
              {!editingUser && (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => {
                    const temp = generatePassword();
                    setValue("password", temp);
                    push({ title: "Parola oluşturuldu", description: temp, type: "info" });
                    copyToClipboard(temp).catch(() => undefined);
                  }}
                >
                  Oluştur
                </button>
              )}
            </div>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">Telefon Numarası</span>
            <input
              {...register("phone_number")}
              type="tel"
              placeholder="0 545 219 68 63 veya 905452196863"
            />
            <small className="form-field__hint">
              SMS doğrulama için telefon numarası (opsiyonel)
            </small>
            {errors.phone_number && <span className="field-error">{errors.phone_number.message}</span>}
          </label>

          <label className="form-field">
            <span className="form-field__label">Rol</span>
            <select {...register("role")}>
              {staffRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field form-field--inline">
            <span className="form-field__label">Aktif</span>
            <input type="checkbox" {...register("is_active")} />
          </label>

          <div className="form-actions form-grid__field--full">
            {editingUser && (
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={handleNew}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                İptal
              </button>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingUser
                ? updateMutation.isPending
                  ? "Güncelleniyor..."
                  : "Güncelle"
                : createMutation.isPending
                  ? "Kaydediliyor..."
                  : "Kaydet"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Personel Listesi</h2>
            <p className="panel__subtitle">
              {filteredUsers.length} / {usersQuery.data?.length ?? 0} personel gösteriliyor
            </p>
          </div>
          <div style={{ minWidth: "250px" }}>
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="E-posta, telefon veya rol ile ara..."
            />
          </div>
        </div>

        {usersQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">Personel yükleniyor</h3>
            <p>Lütfen bekleyin...</p>
          </div>
        ) : usersQuery.isError ? (
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">Personel listesi alınamadı</h3>
            <p>Sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>E-posta</th>
                  <th>Telefon</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>{t("common.lastLogin")}</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
      const isActive = user.is_active;
      const isCurrentUser = currentUser?.id === user.id;
      return (
        <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                        {isCurrentUser && (
                          <div className="table-cell-muted">(Siz)</div>
                        )}
                      </td>
                      <td>
                        {user.phone_number ? (
                          <span>{user.phone_number}</span>
                        ) : (
                          <span className="table-cell-muted">-</span>
                        )}
                      </td>
                      <td>
                        <span className="badge">{roleLabels[user.role] ?? user.role}</span>
                      </td>
                      <td>
                        <span
                          className={isActive ? "badge badge--success" : "badge badge--danger"}
                        >
              {isActive ? "Aktif" : "Pasif"}
            </span>
          </td>
                      <td>
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleString("tr-TR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
          </td>
                      <td>
                        <div className="table-actions">
              <button
                type="button"
                            className="action-link"
                onClick={() => {
                  setEditingUser(user);
                  reset({
                    email: user.email,
                    password: "",
                    phone_number: user.phone_number || "",
                    role: user.role as FormValues["role"],
                    is_active: user.is_active,
                  });
                }}
              >
                Düzenle
              </button>
              <button
                type="button"
                            className="action-link"
                onClick={() => {
                  setResetUser(user);
                  setResetPassword(generatePassword());
                }}
              >
                Parola Sıfırla
              </button>
              {isActive ? (
                <button
                  type="button"
                              className="action-link action-link--danger"
                              disabled={isCurrentUser}
                              onClick={() => {
                                if (!isCurrentUser && confirm(`${user.email} kullanıcısını pasifleştirmek istediğinize emin misiniz?`)) {
                                  deactivateMutation.mutate(user.id);
                                }
                              }}
                  title={isCurrentUser ? "Kendi hesabınızı pasifleştiremezsiniz" : undefined}
                >
                  Pasifleştir
                </button>
              ) : (
                <button
                  type="button"
                              className="action-link"
                  onClick={() =>
                    updateMutation.mutate({ id: user.id, payload: { is_active: true } })
                  }
                >
                  Aktif Et
                </button>
              )}
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
            <h3 className="empty-state__title">Henüz personel kaydı yok</h3>
            <p>Yukarıdaki formu kullanarak yeni personel ekleyebilirsiniz.</p>
          </div>
        )}
      </div>

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
    </section>
  );
}
