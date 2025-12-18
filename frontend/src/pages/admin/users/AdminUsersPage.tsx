import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Search, Shield, CheckCircle2, XCircle, Edit, Loader2, AlertCircle, UserPlus, Key, Trash2, Copy, Eye } from "../../../lib/lucide";
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
  full_name?: string;
  phone_number?: string;
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ new_password?: string; current_password?: string; message?: string } | null>(null);
  const [currentPasswordLoading, setCurrentPasswordLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Create user form state
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone_number: "",
    role: "staff" as UserRole,
    is_active: true,
    tenant_id: "",
    auto_generate_password: false,
  });

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", selectedTenantId, selectedRole, isActiveFilter, searchTerm],
    queryFn: async (): Promise<User[]> => {
      const params: Record<string, string> = {};
      if (selectedTenantId) params.tenant_id = selectedTenantId;
      if (selectedRole) params.role = selectedRole;
      if (isActiveFilter !== "") params.is_active = isActiveFilter;
      if (searchTerm) params.email = searchTerm;
      const response = await http.get<User[]>("/admin/users", { params });
      return response.data;
    },
  });

  const tenantsById = useMemo(() => 
    new Map(tenantsQuery.data?.map((tenant) => [tenant.id, tenant]) ?? []),
    [tenantsQuery.data]
  );

  // Filter users by search term (client-side for full_name, phone_number)
  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    if (!searchTerm.trim()) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter((user) => {
      const tenant = user.tenant_id ? tenantsById.get(user.tenant_id) : null;
      const tenantName = (tenant?.name ?? "").toLowerCase();
      const email = user.email.toLowerCase();
      const fullName = (user.full_name ?? "").toLowerCase();
      const phone = (user.phone_number ?? "").toLowerCase();
      const role = (userRoleLabels[user.role] ?? user.role).toLowerCase();
      
      return email.includes(term) || tenantName.includes(term) || role.includes(term) || fullName.includes(term) || phone.includes(term);
    });
  }, [usersQuery.data, searchTerm, tenantsById]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await http.post<User>("/admin/users", payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      push({ title: t("users.created"), type: "success" });
      setShowCreateModal(false);
      setNewUser({ email: "", password: "", full_name: "", phone_number: "", role: "staff", is_active: true, tenant_id: "", auto_generate_password: false });
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("already registered") || errorMsg.includes("Email already")) {
        push({ title: t("users.createError"), description: t("users.emailAlreadyExists"), type: "error" });
      } else {
        push({ title: t("users.createError"), description: errorMsg, type: "error" });
      }
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
      push({ title: t("users.updateError"), description: getErrorMessage(error), type: "error" });
    },
  });


  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await http.delete(`/admin/users/${userId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      push({ title: t("users.deactivated"), type: "success" });
    },
    onError: (error: unknown) => {
      push({ title: t("users.deactivateError"), description: getErrorMessage(error), type: "error" });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser({ ...user });
    setShowEditModal(true);
  };

  const handleCreate = () => {
    if (!newUser.email || !newUser.email.trim()) {
      push({ title: "Eksik bilgi", description: "Email adresi gereklidir", type: "error" });
      return;
    }
    if (!newUser.auto_generate_password && (!newUser.password || newUser.password.length < 8)) {
      push({ title: "Eksik bilgi", description: "Parola en az 8 karakter olmalıdır veya otomatik oluşturulmalıdır", type: "error" });
      return;
    }
    const payload: any = {
      email: newUser.email.trim(),
      role: newUser.role,
      is_active: newUser.is_active,
      auto_generate_password: newUser.auto_generate_password,
    };
    if (newUser.full_name?.trim()) payload.full_name = newUser.full_name.trim();
    if (newUser.phone_number?.trim()) payload.phone_number = newUser.phone_number.trim();
    if (newUser.tenant_id) payload.tenant_id = newUser.tenant_id;
    if (!newUser.auto_generate_password && newUser.password) payload.password = newUser.password;
    
    // Ensure role is valid enum value
    const validRoles = ["super_admin", "support", "tenant_admin", "staff", "viewer", "accounting"];
    if (!validRoles.includes(payload.role)) {
      push({ title: "Geçersiz rol", description: "Seçilen rol geçerli değil", type: "error" });
      return;
    }
    
    createUserMutation.mutate(payload, {
      onError: (error: unknown) => {
        console.error("Create user error:", error);
        // Error handling is already in mutation definition, but ensure modal stays open on error
      },
    });
  };

  const handleSave = () => {
    if (!editingUser) return;
    const payload: any = {
      role: editingUser.role,
      is_active: editingUser.is_active,
    };
    if (editingUser.full_name !== undefined) payload.full_name = editingUser.full_name || null;
    if (editingUser.phone_number !== undefined) payload.phone_number = editingUser.phone_number || null;
    if (editingUser.tenant_id !== undefined) payload.tenant_id = editingUser.tenant_id || null;
    updateUserMutation.mutate({
      userId: editingUser.id,
      payload,
    });
  };

  const handleDelete = (user: User) => {
    if (window.confirm(`${user.email} kullanıcısını devre dışı bırakmak istediğinizden emin misiniz?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password).then(() => {
      push({ title: "Kopyalandı", description: "Parola panoya kopyalandı", type: "success" });
    });
  };

  const handleShowPassword = async (user: User) => {
    setResetPasswordUser(user);
    setResetPasswordResult(null);
    setCurrentPasswordLoading(user.id);
    setShowResetPasswordModal(true);
    
    // Try to get current password only - don't generate new one
    try {
      const response = await http.get<{ password: string | null; has_password: boolean; message?: string }>(`/admin/users/${user.id}/password`);
      if (response.data.password) {
        setResetPasswordResult({ current_password: response.data.password });
      } else {
        // If no current password, just show message - don't generate new one
        setResetPasswordResult({ 
          current_password: undefined,
          message: response.data.message || "Şifre bulunamadı"
        });
      }
    } catch (error) {
      // If error, just show error message - don't generate new password
      const errorMessage = getErrorMessage(error);
      setResetPasswordResult({ 
        current_password: undefined,
        message: errorMessage || "Şifre alınamadı"
      });
    } finally {
      setCurrentPasswordLoading(null);
    }
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
            {t("nav.globalUsers")}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            Tüm sistem kullanıcılarını görüntüle ve yönet
          </p>
        </div>
        <ModernButton
          variant="primary"
          onClick={() => {
            setNewUser({ email: "", password: "", full_name: "", phone_number: "", role: "staff", is_active: true, tenant_id: "", auto_generate_password: false });
            setShowCreateModal(true);
          }}
          leftIcon={<UserPlus className="h-4 w-4" />}
        >
          Yeni Kullanıcı
        </ModernButton>
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
              placeholder="Ad, soyad, e-posta, telefon, otel veya rol ile ara..."
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
                key: 'full_name',
                label: 'Ad Soyad',
                render: (value) => value ? <strong>{value}</strong> : <span style={{ color: "var(--text-tertiary)" }}>—</span>,
              },
              {
                key: 'phone_number',
                label: 'Telefon',
                render: (value) => value || <span style={{ color: "var(--text-tertiary)" }}>—</span>,
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
                key: 'password',
                label: 'Şifre',
                align: 'center',
                render: (_, row) => (
                  <button
                    onClick={() => handleShowPassword(row)}
                    disabled={currentPasswordLoading === row.id}
                    title="Şifreyi göster"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: '#6366f1',
                      cursor: currentPasswordLoading === row.id ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: currentPasswordLoading === row.id ? 0.6 : 1,
                    }}
                    onMouseOver={(e) => {
                      if (currentPasswordLoading !== row.id) {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                    }}
                  >
                    {currentPasswordLoading === row.id ? (
                      <Loader2 className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                ),
              },
              {
                key: 'actions',
                label: t("common.actions"),
                align: 'right',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(row)}
                      leftIcon={<Edit className="h-4 w-4" />}
                    >
                      Düzenle
                    </ModernButton>
                    <ModernButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetPasswordUser(row);
                        setResetPasswordResult(null);
                        setShowResetPasswordModal(true);
                      }}
                      leftIcon={<Key className="h-4 w-4" />}
                    >
                      Parola Sıfırla
                    </ModernButton>
                    {row.is_active && (
                      <ModernButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(row)}
                        leftIcon={<Trash2 className="h-4 w-4" />}
                      >
                        Devre Dışı Bırak
                      </ModernButton>
                    )}
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

      {/* Create User Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewUser({ email: "", password: "", full_name: "", phone_number: "", role: "staff", is_active: true, tenant_id: "", auto_generate_password: false });
          }}
          title={t("users.createTitle")}
          footer={
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({ email: "", password: "", full_name: "", phone_number: "", role: "staff", is_active: true, tenant_id: "", auto_generate_password: false });
                }}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleCreate}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <label className="form-field">
              <span className="form-field__label">Email <span style={{ color: "#dc2626" }}>*</span></span>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="kullanici@ornek.com"
                required
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Ad Soyad</span>
              <input
                type="text"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Kullanıcının tam adı"
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Telefon</span>
              <input
                type="tel"
                value={newUser.phone_number}
                onChange={(e) => setNewUser({ ...newUser, phone_number: e.target.value })}
                placeholder="905551234567"
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Tenant (Otel)</span>
              <select
                value={newUser.tenant_id}
                onChange={(e) => setNewUser({ ...newUser, tenant_id: e.target.value })}
              >
                <option value="">Tenant seçilmedi</option>
                {tenantsQuery.data?.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-field__label">Rol <span style={{ color: "#dc2626" }}>*</span></span>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
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
                  checked={newUser.auto_generate_password}
                  onChange={(e) => setNewUser({ ...newUser, auto_generate_password: e.target.checked, password: "" })}
                />
                <span className="form-field__label">Parolayı otomatik oluştur</span>
              </div>
            </label>
            {!newUser.auto_generate_password && (
              <label className="form-field">
                <span className="form-field__label">Parola <span style={{ color: "#dc2626" }}>*</span></span>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="En az 8 karakter"
                  minLength={8}
                  required={!newUser.auto_generate_password}
                />
                <small style={{ color: "var(--text-tertiary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  Minimum 8 karakter olmalıdır
                </small>
              </label>
            )}
            <label className="form-field">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  type="checkbox"
                  checked={newUser.is_active}
                  onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })}
                />
                <span className="form-field__label">Aktif</span>
              </div>
            </label>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
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
              <span className="form-field__label">Ad Soyad</span>
              <input
                type="text"
                value={editingUser.full_name || ""}
                onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                placeholder="Kullanıcının tam adı"
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Telefon</span>
              <input
                type="tel"
                value={editingUser.phone_number || ""}
                onChange={(e) => setEditingUser({ ...editingUser, phone_number: e.target.value })}
                placeholder="905551234567"
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Tenant (Otel)</span>
              <select
                value={editingUser.tenant_id || ""}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, tenant_id: e.target.value || undefined })
                }
              >
                <option value="">Tenant atanmamış</option>
                {tenantsQuery.data?.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
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
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-primary)" }}>
              <ModernButton
                variant="ghost"
                onClick={() => {
                  setResetPasswordUser(editingUser);
                  setResetPasswordResult(null);
                  setShowResetPasswordModal(true);
                }}
                leftIcon={<Key className="h-4 w-4" />}
              >
                Parola Sıfırla
              </ModernButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUser && (
        <Modal
          isOpen={showResetPasswordModal}
          onClose={() => {
            setShowResetPasswordModal(false);
            setResetPasswordUser(null);
            setResetPasswordResult(null);
          }}
          title="Şifre Göster"
          footer={
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordUser(null);
                  setResetPasswordResult(null);
                }}
              >
                Kapat
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <p style={{ margin: 0, color: "var(--text-tertiary)" }}>
              <strong>{resetPasswordUser.email}</strong> kullanıcısının şifresi.
            </p>
            {currentPasswordLoading === resetPasswordUser?.id ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <Loader2 className="h-8 w-8" style={{ margin: "0 auto", color: "var(--primary)", animation: "spin 1s linear infinite" }} />
                <p style={{ marginTop: "1rem", color: "var(--text-tertiary)" }}>Şifre yükleniyor...</p>
              </div>
            ) : resetPasswordResult?.current_password ? (
              <div style={{ padding: "1rem", background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-primary)" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>Mevcut Şifre:</p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <code style={{ flex: 1, padding: "0.5rem", background: "var(--bg-primary)", borderRadius: "var(--radius-sm)", fontFamily: "monospace" }}>
                    {resetPasswordResult.current_password}
                  </code>
                  <ModernButton
                    variant="ghost"
                    size="sm"
                    onClick={() => copyPassword(resetPasswordResult.current_password!)}
                    leftIcon={<Copy className="h-4 w-4" />}
                  >
                    Kopyala
                  </ModernButton>
                </div>
              </div>
            ) : resetPasswordResult?.message ? (
              <div style={{ padding: "1rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius-lg)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#b45309" }}>Şifre Bulunamadı</p>
                <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "#b45309" }}>
                  {resetPasswordResult.message}
                </p>
                <p style={{ margin: "1rem 0 0 0", fontSize: "0.875rem", color: "var(--text-tertiary)" }}>
                  Bu kullanıcının şifresi şifrelenmiş formatta saklanmamış. Şifreyi görmek için kullanıcıya yeni şifre oluşturmasını söyleyin.
                </p>
              </div>
            ) : null}
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


