import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { adminTenantService, type TenantCreatePayload } from "../../../services/admin/tenants";
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

export function TenantCreatePage() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messages, push } = useToast();

  // Basic info
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
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
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Working hours
  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);

  // Legal info
  const [legalName, setLegalName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: TenantCreatePayload) => adminTenantService.create(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      push({
        title: "Otel oluşturuldu",
        description: `${data.name} (${data.slug}) başarıyla oluşturuldu.`,
        type: "success",
      });
      navigate("/admin/tenants");
    },
    onError: (error: unknown) => {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes("demo environment") || errorMsg.includes("DEMO_MODE")) {
        push({
          title: "Demo Modu Aktif",
          description: "Demo ortamında yeni tenant oluşturma devre dışı bırakılmıştır.",
          type: "error",
        });
      } else {
        push({ title: "Hata", description: errorMsg, type: "error" });
      }
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      push({ title: "Hata", description: "Otel adı ve slug zorunludur.", type: "error" });
      return;
    }

    const payload: TenantCreatePayload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      plan,
      is_active: true,
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
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
        },
        working_hours: workingHours,
        tax_number: taxNumber || undefined,
      },
    };

    createMutation.mutate(payload);
  };

  const handleSlugGenerate = () => {
    const generatedSlug = name
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generatedSlug);
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
              Yeni Otel Ekle
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              Sisteme yeni bir otel/tenant ekleyin
            </p>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
        {/* Left Column */}
        <div>
          {/* Basic Info */}
          <ModernCard style={sectionStyle}>
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
              />
              <div>
                <ModernInput
                  label="Slug (URL)"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="Örn: grand-hotel"
                  required
                />
                <button
                  type="button"
                  onClick={handleSlugGenerate}
                  style={{
                    marginTop: "var(--space-1)",
                    fontSize: "var(--text-xs)",
                    color: "var(--primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  İsimden otomatik oluştur
                </button>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "var(--space-1)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)" }}>
                  Plan
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-primary)",
                    fontSize: "var(--text-sm)",
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
          <ModernCard style={sectionStyle}>
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
              />
              <ModernInput
                label="Vergi Numarası"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="Örn: 1234567890"
              />
            </div>
          </ModernCard>

          {/* Contact Info */}
          <ModernCard style={sectionStyle}>
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
              />
              <ModernInput
                label="Telefon"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+90 212 123 4567"
                leftIcon={<Phone className="h-4 w-4" />}
              />
              <ModernInput
                label="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.hotel.com"
                leftIcon={<Globe className="h-4 w-4" />}
              />
            </div>
          </ModernCard>

          {/* Branding */}
          <ModernCard style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Palette className="h-5 w-5" style={{ color: "var(--primary)" }} />
              Marka & Görünüm
            </div>
            <div style={gridStyle}>
              <div>
                <label style={{ display: "block", marginBottom: "var(--space-1)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)" }}>
                  Marka Rengi
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    style={{ width: "48px", height: "48px", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-primary)",
                      fontSize: "var(--text-sm)",
                    }}
                  />
                </div>
              </div>
              <ModernInput
                label="Logo URL"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                leftIcon={<ImageIcon className="h-4 w-4" />}
              />
            </div>
          </ModernCard>
        </div>

        {/* Right Column */}
        <div>
          {/* Location Info */}
          <ModernCard style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <MapPin className="h-5 w-5" style={{ color: "var(--primary)" }} />
              Konum Bilgileri
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <ModernInput
                label="Adres"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Tam adres"
              />
              <div style={gridStyle}>
                <ModernInput
                  label="Şehir"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="İstanbul"
                />
                <ModernInput
                  label="İlçe"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Beşiktaş"
                />
              </div>
              <div style={gridStyle}>
                <ModernInput
                  label="Enlem (Latitude)"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="41.0082"
                />
                <ModernInput
                  label="Boylam (Longitude)"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="28.9784"
                />
              </div>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                💡 İpucu: Google Maps'ten koordinatları alabilirsiniz
              </p>
            </div>
          </ModernCard>

          {/* Working Hours */}
          <ModernCard style={sectionStyle}>
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
                  <span style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)" }}>
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
                    }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={workingHours[day].closed}
                      onChange={(e) => updateWorkingHours(day, "closed", e.target.checked)}
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
          disabled={createMutation.isPending}
          leftIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {createMutation.isPending ? "Kaydediliyor..." : "Oteli Kaydet"}
        </ModernButton>
      </motion.div>
    </div>
  );
}
