import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../../../hooks/useTranslation";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { getErrorMessage } from "../../../lib/httpError";
import type { UserRole } from "../../../types/auth";

interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  tenant_id?: string;
  created_at: string;
  last_login_at?: string;
}

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

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", selectedTenantId, selectedRole, isActiveFilter],
    queryFn: async (): Promise<User[]> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (selectedRole) params.role = selectedRole;
      if (isActiveFilter !== "") params.is_active = isActiveFilter;
      const response = await http.get<User[]>("/admin/users", { params });
      return response.data;
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: Partial<User> }) => {
      const response = await http.patch<User>(`/admin/users/${userId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      push({ title: "Kullanıcı güncellendi", type: "success" });
      setShowEditModal(false);
      setEditingUser(null);
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const tenantsById = new Map(tenantsQuery.data?.map((tenant) => [tenant.id, tenant]) ?? []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleSave = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      userId: editingUser.id,
      payload: {
        role: editingUser.role,
        is_active: editingUser.is_active,
      },
    });
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.globalUsers")}</h1>
          <p className="page-subtitle">Tüm sistem kullanıcılarını görüntüle ve yönet</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">Filtreler</h3>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <label className="form-field">
            <span className="form-field__label">{t("common.hotel")} Seç</span>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Tüm {t("common.hotel")}lar</option>
              {tenantsQuery.data?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Rol</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Tüm Roller</option>
              {Object.entries(userRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field__label">Durum</span>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Tüm Durumlar</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">Kullanıcılar</h3>
            <p className="panel__subtitle">
              {usersQuery.data?.length ?? 0} kullanıcı bulundu
            </p>
          </div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>{t("common.hotel")}</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Son Giriş</th>
                <th>Oluşturulma</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
                      <p>Veriler yükleniyor...</p>
                    </div>
                  </td>
                </tr>
              ) : usersQuery.data && usersQuery.data.length > 0 ? (
                usersQuery.data.map((user) => {
                  const tenant = user.tenant_id ? tenantsById.get(user.tenant_id) : null;
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                      </td>
                      <td>
                        {tenant ? (
                          <>
                            <strong>{tenant.name}</strong>
                            <div className="table-cell-muted">#{tenant.slug}</div>
                          </>
                        ) : (
                          <span style={{ color: "var(--color-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="badge">{userRoleLabels[user.role] ?? user.role}</span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: user.is_active ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: user.is_active ? "#10b981" : "#ef4444",
                          }}
                        >
                          {user.is_active ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td>
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleString("tr-TR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td>
                        {new Date(user.created_at).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleEdit(user)}
                          style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ margin: "2rem 0" }}>
                      <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>👥</div>
                      <h3 className="empty-state__title">Kullanıcı bulunamadı</h3>
                      <p>Seçili filtrelerle eşleşen kullanıcı bulunamadı. Filtreleri değiştirerek tekrar deneyin.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && editingUser && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingUser(null);
          }}
          title="Kullanıcı Düzenle"
          footer={
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <label className="form-field">
              <span className="form-field__label">Email</span>
              <input type="email" value={editingUser.email} disabled style={{ opacity: 0.6 }} />
            </label>
            <label className="form-field">
              <span className="form-field__label">Rol</span>
              <select
                value={editingUser.role}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                }
              >
                {Object.entries(userRoleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  type="checkbox"
                  checked={editingUser.is_active}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, is_active: e.target.checked })
                  }
                />
                <span className="form-field__label">Aktif</span>
              </div>
            </label>
          </div>
        </Modal>
      )}

      {usersQuery.isError && (
        <div className="panel">
          <p className="field-error">Kullanıcı verileri alınamadı. Lütfen daha sonra tekrar deneyin.</p>
        </div>
      )}
    </section>
  );
}

