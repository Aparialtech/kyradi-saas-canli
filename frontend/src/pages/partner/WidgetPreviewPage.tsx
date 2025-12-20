import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code,
  Eye,
  Loader2,
  AlertCircle,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Package,
  Briefcase,
  Weight,
  FileText,
  Shield,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
} from "../../lib/lucide";

import { env } from "../../config/env";
import { partnerWidgetService } from "../../services/partner/widgetConfig";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { useTranslation } from "../../hooks/useTranslation";
import { ModernCard } from "../../components/ui/ModernCard";
import { ModernButton } from "../../components/ui/ModernButton";
import { ModernInput } from "../../components/ui/ModernInput";

declare global {
  interface Window {
    KyradiReserve?: {
      config: Record<string, string>;
      mount: () => void;
    };
  }
}

const buildSnippet = (
  cdnBase: string,
  apiBase: string,
  tenantId: string,
  widgetKey: string,
  locale: string
) => `<script src="${cdnBase}/widgets/kyradi-reserve.js"
  data-api-base="${apiBase}"
  data-tenant-id="${tenantId}"
  data-widget-key="${widgetKey}"
  data-locale="${locale}"
  data-theme="light"
  defer></script>
<kyradi-reserve></kyradi-reserve>`;

// Step definitions
const steps = [
  { id: 1, title: "Kişisel Bilgiler", icon: User },
  { id: 2, title: "Rezervasyon Bilgileri", icon: Calendar },
  { id: 3, title: "Bavul & Sözleşme", icon: Package },
];

interface FormData {
  // Step 1: Personal Info
  fullName: string;
  email: string;
  phone: string;
  // Step 2: Reservation Info
  checkIn: string;
  checkOut: string;
  // Step 3: Luggage Info
  baggageCount: number;
  baggageType: string;
  weightKg: string;
  notes: string;
  // Agreements
  kvkkAccepted: boolean;
  termsAccepted: boolean;
}

export function WidgetPreviewPage() {
  const { messages, push } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [snippet, setSnippet] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const { t, locale } = useTranslation();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    checkIn: "",
    checkOut: "",
    baggageCount: 1,
    baggageType: "",
    weightKg: "",
    notes: "",
    kvkkAccepted: false,
    termsAccepted: false,
  });

  // Scroll states for auto-accept
  const [kvkkScrolled, setKvkkScrolled] = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const kvkkRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);

  const tenantQuery = useQuery({
    queryKey: ["partner", "widget-config"],
    queryFn: () => partnerWidgetService.getWidgetConfig(),
  });

  useEffect(() => {
    if (!tenantQuery.data || !containerRef.current) return;
    const { tenant_id, widget_public_key } = tenantQuery.data;
    const cdnBase = env.PUBLIC_CDN_BASE || window.location.origin;
    const code = buildSnippet(cdnBase, env.API_URL, tenant_id, widget_public_key, locale);
    setSnippet(code);
  }, [tenantQuery.data, locale]);

  useEffect(() => {
    if (tenantQuery.error) {
      push({
        title: t("widget.preview.toastError"),
        description: getErrorMessage(tenantQuery.error),
        type: "error",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantQuery.isError]);

  // Handle KVKK scroll
  const handleKvkkScroll = useCallback(() => {
    const el = kvkkRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    if (atBottom && !kvkkScrolled) {
      setKvkkScrolled(true);
      setFormData((prev) => ({ ...prev, kvkkAccepted: true }));
    }
  }, [kvkkScrolled]);

  // Handle Terms scroll
  const handleTermsScroll = useCallback(() => {
    const el = termsRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    if (atBottom && !termsScrolled) {
      setTermsScrolled(true);
      setFormData((prev) => ({ ...prev, termsAccepted: true }));
    }
  }, [termsScrolled]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    if (activeStep === 1) {
      return formData.fullName.trim() && formData.email.trim() && formData.phone.trim();
    }
    if (activeStep === 2) {
      return formData.checkIn && formData.checkOut;
    }
    if (activeStep === 3) {
      return formData.kvkkAccepted && formData.termsAccepted && formData.baggageCount > 0;
    }
    return false;
  };

  const handleNext = () => {
    if (activeStep < 3 && canProceed()) {
      setActiveStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (activeStep > 1) {
      setActiveStep((s) => s - 1);
    }
  };

  const handleSubmit = () => {
    if (!canProceed()) {
      push({ title: "Lütfen tüm alanları doldurun", type: "error" });
      return;
    }
    push({ title: "Rezervasyon oluşturuldu!", description: "Demo formu başarıyla tamamlandı.", type: "success" });
    // Reset form
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      checkIn: "",
      checkOut: "",
      baggageCount: 1,
      baggageType: "",
      weightKg: "",
      notes: "",
      kvkkAccepted: false,
      termsAccepted: false,
    });
    setActiveStep(1);
    setKvkkScrolled(false);
    setTermsScrolled(false);
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      push({ title: "Kod kopyalandı!", type: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push({ title: "Kopyalama başarısız", type: "error" });
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: "var(--space-6)" }}>
              <h3
                style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: "var(--font-bold)",
                  color: "var(--text-primary)",
                  margin: "0 0 var(--space-2) 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <User className="h-5 w-5" style={{ color: "var(--primary)" }} />
                Kişisel Bilgiler
              </h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                Rezervasyon için iletişim bilgilerinizi girin.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <ModernInput
                label="Ad Soyad"
                value={formData.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder="Adınız ve soyadınız"
                leftIcon={<User className="h-4 w-4" />}
                fullWidth
                required
              />
              <ModernInput
                label="E-posta"
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="ornek@email.com"
                leftIcon={<Mail className="h-4 w-4" />}
                fullWidth
                required
              />
              <ModernInput
                label="Telefon"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+90 5XX XXX XX XX"
                leftIcon={<Phone className="h-4 w-4" />}
                fullWidth
                required
              />
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: "var(--space-6)" }}>
              <h3
                style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: "var(--font-bold)",
                  color: "var(--text-primary)",
                  margin: "0 0 var(--space-2) 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <Calendar className="h-5 w-5" style={{ color: "var(--primary)" }} />
                Rezervasyon Bilgileri
              </h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                Bavulunuzu bırakacağınız ve alacağınız tarihleri seçin.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <ModernInput
                label="Bırakış Tarihi & Saati"
                type="datetime-local"
                value={formData.checkIn}
                onChange={(e) => updateField("checkIn", e.target.value)}
                leftIcon={<Clock className="h-4 w-4" />}
                fullWidth
                required
              />
              <ModernInput
                label="Alış Tarihi & Saati"
                type="datetime-local"
                value={formData.checkOut}
                onChange={(e) => updateField("checkOut", e.target.value)}
                leftIcon={<Clock className="h-4 w-4" />}
                fullWidth
                required
              />

              {/* Duration display */}
              {formData.checkIn && formData.checkOut && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "var(--space-4)",
                    background: "linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--primary-200)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <Calendar className="h-4 w-4" style={{ color: "var(--primary-600)" }} />
                    <span style={{ fontWeight: "var(--font-semibold)", color: "var(--primary-700)" }}>
                      Rezervasyon Süresi
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--primary-600)" }}>
                    {(() => {
                      const start = new Date(formData.checkIn);
                      const end = new Date(formData.checkOut);
                      const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                      const days = Math.floor(hours / 24);
                      const remainingHours = hours % 24;
                      if (hours <= 0) return "Geçersiz tarih aralığı";
                      if (days > 0) return `${days} gün ${remainingHours} saat`;
                      return `${hours} saat`;
                    })()}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: "var(--space-6)" }}>
              <h3
                style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: "var(--font-bold)",
                  color: "var(--text-primary)",
                  margin: "0 0 var(--space-2) 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <Package className="h-5 w-5" style={{ color: "var(--primary)" }} />
                Bavul Bilgileri & Sözleşme
              </h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                Bavul detaylarınızı girin ve sözleşmeleri onaylayın.
              </p>
            </div>

            {/* Luggage Info */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
              <ModernInput
                label="Bavul Sayısı"
                type="number"
                min={1}
                max={10}
                value={formData.baggageCount.toString()}
                onChange={(e) => updateField("baggageCount", parseInt(e.target.value) || 1)}
                leftIcon={<Briefcase className="h-4 w-4" />}
                fullWidth
              />
              <ModernInput
                label="Bavul Tipi"
                value={formData.baggageType}
                onChange={(e) => updateField("baggageType", e.target.value)}
                placeholder="Kabin / Büyük"
                leftIcon={<Package className="h-4 w-4" />}
                fullWidth
              />
              <ModernInput
                label="Tahmini Ağırlık (kg)"
                type="number"
                value={formData.weightKg}
                onChange={(e) => updateField("weightKg", e.target.value)}
                placeholder="15"
                leftIcon={<Weight className="h-4 w-4" />}
                fullWidth
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "var(--space-2)",
                  fontWeight: "var(--font-medium)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                Notlar (Opsiyonel)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Özel istekleriniz varsa belirtin..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-sm)",
                  fontFamily: "inherit",
                  resize: "vertical",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              />
            </div>

            {/* Agreements Section */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                <Shield className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <h4 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                  Sözleşmeler
                </h4>
              </div>

              {/* KVKK Agreement */}
              <div
                style={{
                  marginBottom: "var(--space-4)",
                  padding: "var(--space-4)",
                  background: formData.kvkkAccepted
                    ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)"
                    : "var(--bg-tertiary)",
                  borderRadius: "var(--radius-lg)",
                  border: formData.kvkkAccepted ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border-primary)",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                    KVKK Aydınlatma Metni
                  </span>
                  {formData.kvkkAccepted && <CheckCircle2 className="h-5 w-5" style={{ color: "#16a34a" }} />}
                </div>
                {!kvkkScrolled && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--info-600)", margin: "0 0 var(--space-2) 0" }}>
                    📜 Sözleşmeyi okumak için aşağı kaydırın. Sonuna ulaştığınızda otomatik kabul edilecektir.
                  </p>
                )}
                <div
                  ref={kvkkRef}
                  onScroll={handleKvkkScroll}
                  style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    padding: "var(--space-3)",
                    background: "var(--bg-primary)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>1. Veri Sorumlusu</strong><br />
                    Kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla Kyradi tarafından işlenmektedir.
                  </p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>2. İşlenen Kişisel Veriler</strong><br />
                    Ad, soyad, telefon numarası, e-posta adresi gibi kişisel verileriniz işlenmektedir.
                  </p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>3. İşleme Amaçları</strong><br />
                    Kişisel verileriniz rezervasyon yönetimi ve hizmet kalitesinin artırılması amaçlarıyla işlenmektedir.
                  </p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>4. Veri Güvenliği</strong><br />
                    Kişisel verileriniz, teknik ve idari güvenlik önlemleri alınarak korunmaktadır.
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>5. Haklarınız</strong><br />
                    KVKK'nın 11. maddesi uyarınca kişisel verileriniz hakkında bilgi talep etme haklarınız bulunmaktadır.
                  </p>
                </div>
              </div>

              {/* Terms Agreement */}
              <div
                style={{
                  padding: "var(--space-4)",
                  background: formData.termsAccepted
                    ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)"
                    : "var(--bg-tertiary)",
                  borderRadius: "var(--radius-lg)",
                  border: formData.termsAccepted ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border-primary)",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                    Kullanım Şartları
                  </span>
                  {formData.termsAccepted && <CheckCircle2 className="h-5 w-5" style={{ color: "#16a34a" }} />}
                </div>
                {!termsScrolled && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--info-600)", margin: "0 0 var(--space-2) 0" }}>
                    📜 Sözleşmeyi okumak için aşağı kaydırın. Sonuna ulaştığınızda otomatik kabul edilecektir.
                  </p>
                )}
                <div
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    padding: "var(--space-3)",
                    background: "var(--bg-primary)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>1. Hizmet Kapsamı</strong><br />
                    Bu platform, bavul depolama hizmetleri için rezervasyon yapmanıza olanak sağlar.
                  </p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>2. Kullanıcı Yükümlülükleri</strong><br />
                    Kullanıcılar, doğru ve güncel bilgi sağlamakla yükümlüdür.
                  </p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>3. Ödeme ve İptal</strong><br />
                    Rezervasyon ücretleri belirtilen fiyatlandırma kurallarına göre hesaplanır.
                  </p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}>
                    <strong>4. Sorumluluk Sınırlaması</strong><br />
                    Platform, bavulların kaybolması durumunda sınırlı sorumluluk taşır.
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>5. Gizlilik</strong><br />
                    Kişisel verileriniz KVKK uyarınca korunmaktadır.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "1400px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Code className="h-6 w-6" style={{ color: "white" }} />
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
              {t("widget.preview.title")}
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              {t("widget.preview.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Left: Live Preview */}
        <ModernCard variant="glass" padding="lg">
          <div style={{ marginBottom: "var(--space-4)" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: "0 0 var(--space-1) 0" }}>
              Canlı Önizleme
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
              Widget'ın web sitenizde nasıl görüneceğini test edin.
            </p>
          </div>

          {tenantQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-tertiary)" }}>
              <Loader2
                className="h-10 w-10"
                style={{ margin: "0 auto var(--space-3) auto", color: "var(--primary)", animation: "spin 1s linear infinite" }}
              />
              <p style={{ fontSize: "var(--text-base)", margin: 0 }}>{t("widget.preview.loading")}</p>
            </div>
          ) : tenantQuery.isError ? (
            <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--danger-500)" }}>
              <AlertCircle className="h-10 w-10" style={{ margin: "0 auto var(--space-3) auto" }} />
              <p style={{ fontSize: "var(--text-base)", margin: 0 }}>{getErrorMessage(tenantQuery.error)}</p>
            </div>
          ) : (
            <div ref={containerRef} style={{ minHeight: "400px", padding: "var(--space-4)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}></div>
          )}

          {/* Embed Code Section */}
          <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", margin: 0 }}>
                Embed Kodu
              </h3>
              <ModernButton
                variant="outline"
                size="sm"
                onClick={copySnippet}
                leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              >
                {copied ? "Kopyalandı!" : "Kopyala"}
              </ModernButton>
            </div>
            <textarea
              readOnly
              value={snippet}
              rows={6}
              style={{
                width: "100%",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontFamily: "monospace",
                fontSize: "var(--text-xs)",
                resize: "none",
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        </ModernCard>

        {/* Right: Form Preview */}
        <ModernCard variant="glass" padding="none" style={{ overflow: "hidden" }}>
          {/* Form Header with gradient */}
          <div
            style={{
              padding: "var(--space-5)",
              background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative elements */}
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-30px",
                left: "-30px",
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
              }}
            />

            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "white", margin: "0 0 var(--space-1) 0", position: "relative" }}>
              Rezervasyon Formu
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.8)", margin: 0, position: "relative" }}>
              Form Önizlemesi
            </p>
          </div>

          {/* Stepper */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "var(--space-4) var(--space-5)",
              background: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-primary)",
            }}
          >
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              const isCompleted = activeStep > step.id;

              return (
                <div
                  key={step.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    flex: 1,
                    justifyContent: index === 1 ? "center" : index === 0 ? "flex-start" : "flex-end",
                  }}
                >
                  {/* Step Indicator */}
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      background: isCompleted
                        ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                        : isActive
                        ? "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)"
                        : "var(--bg-tertiary)",
                    }}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: isActive || isCompleted ? "none" : "2px solid var(--border-primary)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: "white" }} />
                    ) : (
                      <Icon className="h-4 w-4" style={{ color: isActive ? "white" : "var(--text-tertiary)" }} />
                    )}
                  </motion.div>

                  {/* Step Label - Only show on larger screens */}
                  <div style={{ display: "none" }}>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: isActive ? "var(--font-semibold)" : "var(--font-medium)",
                        color: isActive || isCompleted ? "var(--text-primary)" : "var(--text-tertiary)",
                      }}
                    >
                      {step.title}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: "2px",
                        background: isCompleted ? "#16a34a" : "var(--border-primary)",
                        margin: "0 var(--space-2)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Title */}
          <div style={{ padding: "var(--space-3) var(--space-5)", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
              Adım {activeStep}: {steps[activeStep - 1].title}
            </span>
          </div>

          {/* Form Content */}
          <div style={{ padding: "var(--space-5)", minHeight: "400px" }}>
            <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "var(--space-4) var(--space-5)",
              borderTop: "1px solid var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <ModernButton
              variant="ghost"
              onClick={handlePrev}
              disabled={activeStep === 1}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Geri
            </ModernButton>

            {activeStep < 3 ? (
              <ModernButton
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                İleri
              </ModernButton>
            ) : (
              <ModernButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!canProceed()}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                Rezervasyonu Tamamla
              </ModernButton>
            )}
          </div>
        </ModernCard>
      </div>
    </div>
  );
}
