import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  UserPlus, 
  ArrowLeft, 
  Save, 
  Mail, 
  Phone,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw
} from "../../../lib/lucide";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { adminTenantService } from "../../../services/admin/tenants";
import { http } from "../../../lib/http";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import type { UserRole } from "../../../types/auth";

const userRoleOptions: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "super_admin", label: "Süper Admin", description: "Tüm sisteme tam erişim" },
  { value: "support", label: "Destek", description: "Destek işlemleri için erişim" },
  { value: "tenant_admin", label: "Tenant Admin", description: "Otel yönetimi için tam erişim" },
  { value: "hotel_manager", label: "Otel Yöneticisi", description: "Otel operasyonları yönetimi" },
  { value: "staff", label: "Personel", description: "Günlük işlemler için erişim" },
  { value: "storage_operator", label: "Depo Görevlisi", description: "Sadece depo işlemleri" },
  { value: "accounting", label: "Muhasebe", description: "Finansal raporlar ve işlemler" },
  { value: "viewer", label: "İzleyici", description: "Sadece görüntüleme yetkisi" },
];

function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function AdminUserCreatePage() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [tenantId, setTenantId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(false);

  // Tenants query
  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantService.list,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      full_name?: string;
      phone_number?: string;
      role: UserRole;
      tenant_id?: string;
      is_active: boolean;
    }) => {
      const response = await http.post("/admin/users", payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      push({ title: "Kullanıcı oluşturuldu", type: "success" });
      navigate("/admin/users");
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("already registered") || errorMsg.includes("Email already")) {
        push({ title: "Hata", description: "Bu e-posta adresi zaten kayıtlı.", type: "error" });
      } else {
        push({ title: "Hata", description: errorMsg, type: "error" });
      }
    },
  });

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    setPassword(newPassword);
    setShowPassword(true);
  };

  const handleSubmit = () => {
    if (!email.trim()) {
      push({ title: "Hata", description: "E-posta adresi zorunludur.", type: "error" });
      return;
    }

    const finalPassword = autoGeneratePassword ? generatePassword() : password;
    if (!finalPassword) {
      push({ title: "Hata", description: "Şifre zorunludur.", type: "error" });
      return;
    }

    // Tenant required for non-admin roles
    const needsTenant = !["super_admin", "support"].includes(role);
    if (needsTenant && !tenantId) {
      push({ title: "Hata", description: "Bu rol için otel seçimi zorunludur.", type: "error" });
      return;
    }

    createMutation.mutate({
      email: email.trim(),
      password: finalPassword,
      full_name: fullName.trim() || undefined,
      phone_number: phoneNumber.trim() || undefined,
      role,
      tenant_id: tenantId || undefined,
      is_active: isActive,
    });
  };

  const needsTenant = !["super_admin", "support"].includes(role);

  const sectionStyle = {
    marginBottom: "var(--space-6)",
  };

  const sectionTitleStyle = {
    fontSize: "var(--text-lg)",
    fontWeight: "var(--font-semibold)" as const,
    color: "var(--text-primary)",
    marginBottom: "var(--space-4)",
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "var(--space-4)",
  };

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "900px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <ModernButton
          variant="ghost"
          onClick={() => navigate("/admin/users")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          style={{ marginBottom: "var(--space-4)" }}
        >
          Geri Dön
        </ModernButton>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus className="h-6 w-6" style={{ color: "white" }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--font-bold)",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Yeni Kullanıcı Ekle
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              Sisteme yeni bir kullanıcı ekleyin
            </p>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Account Info */}
        <ModernCard style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Mail className="h-5 w-5" style={{ color: "#6366f1" }} />
            Hesap Bilgileri
          </div>
          <div style={gridStyle}>
            <ModernInput
              label="E-posta Adresi"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kullanici@ornek.com"
              required
              leftIcon={<Mail className="h-4 w-4" />}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <label style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)" }}>
                  Şifre <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoGeneratePassword}
                    onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                  />
                  Otomatik oluştur
                </label>
              </div>
              {!autoGeneratePassword && (
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Güçlü bir şifre girin"
                      style={{
                        width: "100%",
                        padding: "var(--space-3)",
                        paddingRight: "40px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-primary)",
                        fontSize: "var(--text-sm)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <ModernButton
                    variant="secondary"
                    onClick={handleGeneratePassword}
                    title="Şifre Oluştur"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </ModernButton>
                </div>
              )}
              {autoGeneratePassword && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "var(--space-2) 0 0 0" }}>
                  Şifre otomatik olarak oluşturulacak ve kullanıcıya e-posta ile gönderilecek.
                </p>
              )}
            </div>
          </div>
        </ModernCard>

        {/* Personal Info */}
        <ModernCard style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <UserPlus className="h-5 w-5" style={{ color: "#6366f1" }} />
            Kişisel Bilgiler
          </div>
          <div style={gridStyle}>
            <ModernInput
              label="Ad Soyad"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ahmet Yılmaz"
            />
            <ModernInput
              label="Telefon Numarası"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+90 555 123 4567"
              leftIcon={<Phone className="h-4 w-4" />}
            />
          </div>
        </ModernCard>

        {/* Role & Tenant */}
        <ModernCard style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Shield className="h-5 w-5" style={{ color: "#6366f1" }} />
            Rol & Yetki
          </div>
          <div style={gridStyle}>
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)" }}>
                Kullanıcı Rolü <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                style={{
                  width: "100%",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {userRoleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-1)" }}>
                {userRoleOptions.find((o) => o.value === role)?.description}
              </p>
            </div>

            {needsTenant && (
              <div>
                <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)" }}>
                  Otel <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <option value="">Otel Seçin</option>
                  {tenantsQuery.data?.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: "18px", height: "18px" }}
            />
            <label htmlFor="isActive" style={{ fontWeight: "var(--font-medium)" }}>
              Kullanıcı Aktif
            </label>
          </div>
        </ModernCard>
      </div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginTop: "var(--space-6)",
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-3)",
        }}
      >
        <ModernButton variant="secondary" onClick={() => navigate("/admin/users")}>
          İptal
        </ModernButton>
        <ModernButton
          variant="primary"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          leftIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {createMutation.isPending ? "Kaydediliyor..." : "Kullanıcıyı Kaydet"}
        </ModernButton>
      </motion.div>
    </div>
  );
}
