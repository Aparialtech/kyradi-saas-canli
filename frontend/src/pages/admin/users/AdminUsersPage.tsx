import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Search, Shield, CheckCircle2, XCircle, Edit, Loader2, AlertCircle } from "../../../lib/lucide";
import { useTranslation } from "../../../hooks/useTranslation";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { getErrorMessage } from "../../../lib/httpError";
import type { UserRole } from "../../../types/auth";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernInput } from "../../../components/ui/ModernInput";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernTable, type ModernTableColumn } from "../../../components/ui/ModernTable";

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
  const [searchTerm, setSearchTerm] = useState<string>("");

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

  const tenantsById = useMemo(() => 
    new Map(tenantsQuery.data?.map((tenant) => [tenant.id, tenant]) ?? []),
    [tenantsQuery.data]
  );

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    if (!searchTerm.trim()) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter((user) => {
      const tenant = user.tenant_id ? tenantsById.get(user.tenant_id) : null;
      const tenantName = (tenant?.name ?? "").toLowerCase();
      const email = user.email.toLowerCase();
      const role = (userRoleLabels[user.role] ?? user.role).toLowerCase();
      
      return email.includes(term) || tenantName.includes(term) || role.includes(term);
    });
  }, [usersQuery.data, searchTerm, tenantsById]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

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
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
          {t("nav.globalUsers")}
        </h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          Tüm sistem kullanıcılarını görüntüle ve yönet
        </p>
      </motion.div>

      <ModernCard variant="glass" padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
            Filtreler
          </h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              {t("common.hotel")} Seç
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
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
              <option value="">{t("common.allHotels" as any)}</option>
              {tenantsQuery.data?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              Rol
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
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
              <option value="">Tüm Roller</option>
              {Object.entries(userRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
              Durum
            </label>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
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
              <option value="">Tüm Durumlar</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </div>
        </div>
      </ModernCard>

      <ModernCard variant="glass" padding="lg">
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
              Kullanıcılar
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
              {filteredUsers.length} / {usersQuery.data?.length ?? 0} kullanıcı gösteriliyor
            </p>
          </div>
          <div style={{ minWidth: "250px", flex: '1', maxWidth: '400px' }}>
            <ModernInput
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="E-posta, otel veya rol ile ara..."
              leftIcon={<Search className="h-4 w-4" />}
              fullWidth
            />
          </div>
        </div>
        {usersQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Veriler yükleniyor...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <ModernTable
            columns={[
              {
                key: 'email',
                label: 'Email',
                render: (value) => <strong>{value}</strong>,
              },
              {
                key: 'tenant_id',
                label: t("common.hotel"),
                render: (value) => {
                  const tenant = value ? tenantsById.get(value) : null;
                  return tenant ? (
                    <div>
                      <strong>{tenant.name}</strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                        #{tenant.slug}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-tertiary)" }}>—</span>
                  );
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
                    {userRoleLabels[value as UserRole] ?? value}
                  </span>
                ),
              },
              {
                key: 'is_active',
                label: 'Durum',
                render: (value) => (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: value ? 'rgba(34, 197, 94, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                    color: value ? '#16a34a' : '#dc2626',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-medium)',
                  }}>
                    {value ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {value ? "Aktif" : "Pasif"}
                  </span>
                ),
                align: 'center',
              },
              {
                key: 'last_login_at',
                label: 'Son Giriş',
                render: (value) => value
                  ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
                  : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
              },
              {
                key: 'created_at',
                label: 'Oluşturulma',
                render: (value) => new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
              },
              {
                key: 'actions',
                label: t("common.actions"),
                align: 'right',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(row)}
                      leftIcon={<Edit className="h-4 w-4" />}
                    >
                      Düzenle
                    </ModernButton>
                  </div>
                ),
              },
            ] as ModernTableColumn<User>[]}
            data={filteredUsers}
            loading={usersQuery.isLoading}
            striped
            hoverable
            stickyHeader
          />
        ) : (
          <div style={{ textAlign: "center", padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Users className="h-16 w-16" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-2) 0', color: 'var(--text-primary)' }}>
              Kullanıcı bulunamadı
            </h3>
            <p style={{ margin: 0 }}>Seçili filtrelerle eşleşen kullanıcı bulunamadı. Filtreleri değiştirerek tekrar deneyin.</p>
          </div>
        )}
      </ModernCard>

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
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: "center", padding: 'var(--space-8)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: '#dc2626' }} />
            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: "0.5rem", fontSize: 'var(--text-lg)' }}>
              Kullanıcı verileri alınamadı
            </p>
            <p style={{ margin: 0 }}>Lütfen daha sonra tekrar deneyin.</p>
          </div>
        </ModernCard>
      )}
    </div>
  );
}

