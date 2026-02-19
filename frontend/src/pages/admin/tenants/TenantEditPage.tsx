import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Building2, 
  ArrowLeft, 
  Save, 
  MapPin, 
  Clock, 
  Phone, 
  Mail, 
  Globe,
  Palette,
  ImageIcon,
  Loader2
} from "../../../lib/lucide";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { GoogleMapPicker } from "../../../components/maps/GoogleMapPicker";
import { adminTenantService, type TenantUpdatePayload } from "../../../services/admin/tenants";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

type WorkingHours = Record<string, { open: string; close: string; closed: boolean }>;

const defaultWorkingHours: WorkingHours = {
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "16:00", closed: false },
  sunday: { open: "10:00", close: "16:00", closed: true },
};

const dayLabels: Record<string, string> = {
  monday: "Pazartesi",
  tuesday: "Salı",
  wednesday: "Çarşamba",
  thursday: "Perşembe",
  friday: "Cuma",
  saturday: "Cumartesi",
  sunday: "Pazar",
};

export function TenantEditPage() {
  const { t: _t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  // Basic info
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("standard");
  const [brandColor, setBrandColor] = useState("#00a389");
  const [logoUrl, setLogoUrl] = useState("");

  // Contact info
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");

  // Location info
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  // Working hours
  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);

  // Legal info
  const [legalName, setLegalName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");

  // Fetch tenant data
  const tenantQuery = useQuery({
    queryKey: ["admin", "tenants", id],
    queryFn: async () => {
      // Get tenant from list
      const tenants = await adminTenantService.list();
      const tenant = tenants.find(t => t.id === id);
      if (!tenant) throw new Error("Tenant not found");
      return tenant;
    },
    enabled: Boolean(id),
  });

  // Load tenant data when available
  useEffect(() => {
    if (tenantQuery.data) {
      const tenant = tenantQuery.data;
      setName(tenant.name || "");
      setPlan(tenant.plan || "standard");
      setBrandColor(tenant.brand_color || "#00a389");
      setLogoUrl(tenant.logo_url || "");
      setLegalName(tenant.legal_name || "");

      // Metadata fields will be initialized as empty
      // Backend will merge with existing metadata on update

      // Metadata will be loaded from backend when we update
      // For now, initialize with defaults - backend will merge on update
    }
  }, [tenantQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: TenantUpdatePayload) => adminTenantService.update(id!, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants", id, "detail"] });
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
      brand_color: brandColor || undefined,
      logo_url: logoUrl || undefined,
      legal_name: legalName || undefined,
      metadata: {
        contact: {
          email: contactEmail || undefined,
          phone: contactPhone || undefined,
          website: website || undefined,
        },
        location: {
          address: address || undefined,
          city: city || undefined,
          district: district || undefined,
          latitude: latitude,
          longitude: longitude,
        },
        working_hours: workingHours,
        tax_number: taxNumber || undefined,
      },
    };

    updateMutation.mutate(payload);
  };

  const updateWorkingHours = (day: string, field: string, value: string | boolean) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
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
        <div style={{ marginTop: "var(--space-4)" }}>
          <ModernButton
            variant="ghost"
            onClick={() => navigate(`/admin/tenants/${tenant.id}/domains`)}
            leftIcon={<Globe className="h-4 w-4" />}
          >
            Domain Yönetimi
          </ModernButton>
        </div>
      </motion.div>

      {/* Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
        {/* Left Column */}
        <div>
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
            </div>
          </ModernCard>

          {/* Legal Info */}
          <ModernCard variant="glass" padding="lg" style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Building2 className="h-5 w-5" style={{ color: "var(--primary)" }} />
              Yasal Bilgiler
            </div>
            <div style={gridStyle}>
              <ModernInput
                label="Ticari Ünvan"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Örn: Grand Hotel Turizm A.Ş."
                fullWidth
              />
              <ModernInput
                label="Vergi Numarası"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="Örn: 1234567890"
                fullWidth
              />
            </div>
          </ModernCard>

          {/* Contact Info */}
          <ModernCard variant="glass" padding="lg" style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Phone className="h-5 w-5" style={{ color: "var(--primary)" }} />
              İletişim Bilgileri
            </div>
            <div style={gridStyle}>
              <ModernInput
                label="E-posta"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="info@hotel.com"
                leftIcon={<Mail className="h-4 w-4" />}
                fullWidth
              />
              <ModernInput
                label="Telefon"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+90 212 123 4567"
                leftIcon={<Phone className="h-4 w-4" />}
                fullWidth
              />
              <ModernInput
                label="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.hotel.com"
                leftIcon={<Globe className="h-4 w-4" />}
                fullWidth
              />
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

        {/* Right Column */}
        <div>
          {/* Location Info */}
          <ModernCard variant="glass" padding="lg" style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <MapPin className="h-5 w-5" style={{ color: "var(--primary)" }} />
              Konum Bilgileri
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <GoogleMapPicker
                initialLat={latitude}
                initialLng={longitude}
                onLocationSelect={(location) => {
                  setLatitude(location.lat);
                  setLongitude(location.lng);
                  if (location.address) {
                    setAddress(location.address);
                  }
                  if (location.city) {
                    setCity(location.city);
                  }
                  if (location.district) {
                    setDistrict(location.district);
                  }
                }}
              />
              <div>
                <ModernInput
                  label="Adres"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Tam adres (haritadan otomatik doldurulur)"
                  fullWidth
                />
              </div>
              <div style={gridStyle}>
                <ModernInput
                  label="Şehir"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="İstanbul (haritadan otomatik doldurulur)"
                  fullWidth
                />
                <ModernInput
                  label="İlçe"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Beşiktaş (haritadan otomatik doldurulur)"
                  fullWidth
                />
              </div>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                💡 Haritadan konum seçtiğinizde adres ve koordinatlar otomatik doldurulacak
              </p>
            </div>
          </ModernCard>

          {/* Working Hours */}
          <ModernCard variant="glass" padding="lg" style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Clock className="h-5 w-5" style={{ color: "var(--primary)" }} />
              Çalışma Saatleri
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {Object.keys(workingHours).map((day) => (
                <div
                  key={day}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 1fr auto",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-2)",
                    background: workingHours[day].closed ? "var(--bg-tertiary)" : "transparent",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {dayLabels[day]}
                  </span>
                  <input
                    type="time"
                    value={workingHours[day].open}
                    onChange={(e) => updateWorkingHours(day, "open", e.target.value)}
                    disabled={workingHours[day].closed}
                    style={{
                      padding: "var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                      opacity: workingHours[day].closed ? 0.5 : 1,
                      background: "var(--bg-primary)",
                    }}
                  />
                  <input
                    type="time"
                    value={workingHours[day].close}
                    onChange={(e) => updateWorkingHours(day, "close", e.target.value)}
                    disabled={workingHours[day].closed}
                    style={{
                      padding: "var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                      opacity: workingHours[day].closed ? 0.5 : 1,
                      background: "var(--bg-primary)",
                    }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={workingHours[day].closed}
                      onChange={(e) => updateWorkingHours(day, "closed", e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Kapalı
                  </label>
                </div>
              ))}
            </div>
          </ModernCard>
        </div>
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
