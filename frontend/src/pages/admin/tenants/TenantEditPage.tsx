import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Building2, 
  ArrowLeft, 
  Save, 
  Palette,
  ImageIcon,
  Loader2
} from "../../../lib/lucide";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { adminTenantService, type TenantUpdatePayload } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

export function TenantEditPage() {
  const { t: _t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  // Form state
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("standard");
  const [isActive, setIsActive] = useState(true);
  const [brandColor, setBrandColor] = useState("#00a389");
  const [logoUrl, setLogoUrl] = useState("");

  // Fetch tenant data
  const tenantQuery = useQuery({
    queryKey: ["admin", "tenants", id],
    queryFn: async () => {
      const tenants = await adminTenantService.list();
      return tenants.find(t => t.id === id);
    },
    enabled: Boolean(id),
  });

  // Load tenant data when available
  useEffect(() => {
    if (tenantQuery.data) {
      const tenant = tenantQuery.data;
      setName(tenant.name || "");
      setPlan(tenant.plan || "standard");
      setIsActive(tenant.is_active ?? true);
      setBrandColor(tenant.brand_color || "#00a389");
      setLogoUrl(tenant.logo_url || "");
    }
  }, [tenantQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: TenantUpdatePayload) => adminTenantService.update(id!, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      push({
        title: "Otel güncellendi",
        description: `${data.name} başarıyla güncellendi.`,
        type: "success",
      });
      navigate("/admin/tenants");
    },
    onError: (error: unknown) => {
      push({ title: "Hata", description: getErrorMessage(error), type: "error" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      push({ title: "Hata", description: "Otel adı zorunludur.", type: "error" });
      return;
    }

    const payload: TenantUpdatePayload = {
      name: name.trim(),
      plan,
      is_active: isActive,
      brand_color: brandColor || undefined,
      logo_url: logoUrl || undefined,
    };

    updateMutation.mutate(payload);
  };

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

  if (tenantQuery.isLoading) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
          <Loader2 className="h-12 w-12" style={{ margin: "0 auto var(--space-4) auto", color: "var(--primary)", animation: "spin 1s linear infinite" }} />
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", margin: "0 0 var(--space-2) 0" }}>
            Otel bilgileri yükleniyor
          </h3>
          <p style={{ margin: 0 }}>Lütfen bekleyin...</p>
        </div>
      </div>
    );
  }

  if (tenantQuery.isError || !tenantQuery.data) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "var(--space-16)" }}>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", margin: "0 0 var(--space-2) 0", color: "#dc2626" }}>
            Otel bulunamadı
          </h3>
          <p style={{ margin: "0 0 var(--space-4) 0" }}>{tenantQuery.error ? getErrorMessage(tenantQuery.error) : "Belirtilen ID ile otel bulunamadı."}</p>
          <ModernButton variant="primary" onClick={() => navigate("/admin/tenants")}>
            Oteller Listesine Dön
          </ModernButton>
        </div>
      </div>
    );
  }

  const tenant = tenantQuery.data;

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "1200px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <ModernButton
          variant="ghost"
          onClick={() => navigate("/admin/tenants")}
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
              background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 className="h-6 w-6" style={{ color: "white" }} />
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
              Oteli Düzenle
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              {tenant.name} otel bilgilerini güncelleyin
            </p>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <div style={{ maxWidth: "800px" }}>
        {/* Basic Info */}
        <ModernCard variant="glass" padding="lg" style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Building2 className="h-5 w-5" style={{ color: "var(--primary)" }} />
            Temel Bilgiler
          </div>
          <div style={gridStyle}>
            <ModernInput
              label="Otel Adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Grand Hotel"
              required
              fullWidth
            />
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-1)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                Plan
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                style={{
                  width: "100%",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-primary)",
                  fontSize: "var(--text-base)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <option value="free">Free</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                  Aktif
                </span>
              </label>
            </div>
          </div>
        </ModernCard>

        {/* Branding */}
        <ModernCard variant="glass" padding="lg" style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Palette className="h-5 w-5" style={{ color: "var(--primary)" }} />
            Marka & Görünüm
          </div>
          <div style={gridStyle}>
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                Marka Rengi
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  style={{ 
                    width: "56px", 
                    height: "56px", 
                    border: "2px solid var(--border-primary)", 
                    borderRadius: "var(--radius-lg)", 
                    cursor: "pointer",
                    background: "transparent"
                  }}
                />
                <ModernInput
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#00a389"
                  fullWidth
                />
              </div>
            </div>
            <ModernInput
              label="Logo URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              leftIcon={<ImageIcon className="h-4 w-4" />}
              fullWidth
            />
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
        <ModernButton variant="secondary" onClick={() => navigate("/admin/tenants")}>
          İptal
        </ModernButton>
        <ModernButton
          variant="primary"
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
          isLoading={updateMutation.isPending}
          loadingText="Güncelleniyor..."
          leftIcon={!updateMutation.isPending && <Save className="h-4 w-4" />}
        >
          Değişiklikleri Kaydet
        </ModernButton>
      </motion.div>
    </div>
  );
}
