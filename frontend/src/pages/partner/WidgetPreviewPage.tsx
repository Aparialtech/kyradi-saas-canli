import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code,
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
  { id: 1, title: "Kişisel Bilgiler", shortTitle: "Kişisel", icon: User },
  { id: 2, title: "Rezervasyon Bilgileri", shortTitle: "Rezervasyon", icon: Calendar },
  { id: 3, title: "Bavul & Sözleşme", shortTitle: "Bavul", icon: Package },
];

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  baggageCount: number;
  baggageType: string;
  weightKg: string;
  notes: string;
  kvkkAccepted: boolean;
  termsAccepted: boolean;
}

export function WidgetPreviewPage() {
  const { messages, push } = useToast();
  const [snippet, setSnippet] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const { t, locale } = useTranslation();

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

  const [kvkkScrolled, setKvkkScrolled] = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const kvkkRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);

  const tenantQuery = useQuery({
    queryKey: ["partner", "widget-config"],
    queryFn: () => partnerWidgetService.getWidgetConfig(),
  });

  useEffect(() => {
    if (!tenantQuery.data) return;
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
  }, [tenantQuery.isError]);

  const handleKvkkScroll = useCallback(() => {
    const el = kvkkRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    if (atBottom && !kvkkScrolled) {
      setKvkkScrolled(true);
      setFormData((prev) => ({ ...prev, kvkkAccepted: true }));
    }
  }, [kvkkScrolled]);

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

  const renderStepContent = () => {
    switch (activeStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            style={{ padding: "var(--space-6)" }}
          >
            <div style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <User className="h-5 w-5" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", margin: 0 }}>
                    Kişisel Bilgiler
                  </h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                    İletişim bilgilerinizi girin
                  </p>
                </div>
              </div>
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
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            style={{ padding: "var(--space-6)" }}
          >
            <div style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Calendar className="h-5 w-5" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", margin: 0 }}>
                    Rezervasyon Bilgileri
                  </h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                    Tarih ve saat seçin
                  </p>
                </div>
              </div>
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

              {formData.checkIn && formData.checkOut && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "var(--space-4)",
                    background: "linear-gradient(135deg, var(--success-50) 0%, var(--success-100) 100%)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--success-200)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <CheckCircle2 className="h-5 w-5" style={{ color: "var(--success-600)" }} />
                    <div>
                      <span style={{ fontWeight: "var(--font-semibold)", color: "var(--success-700)", fontSize: "var(--text-sm)" }}>
                        Rezervasyon Süresi:
                      </span>
                      <span style={{ marginLeft: "var(--space-2)", color: "var(--success-600)", fontSize: "var(--text-sm)" }}>
                        {(() => {
                          const start = new Date(formData.checkIn);
                          const end = new Date(formData.checkOut);
                          const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                          const days = Math.floor(hours / 24);
                          const remainingHours = hours % 24;
                          if (hours <= 0) return "Geçersiz tarih";
                          if (days > 0) return `${days} gün ${remainingHours} saat`;
                          return `${hours} saat`;
                        })()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            style={{ padding: "var(--space-6)" }}
          >
            <div style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Package className="h-5 w-5" style={{ color: "white" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", margin: 0 }}>
                    Bavul & Sözleşme
                  </h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                    Bavul bilgilerini girin ve sözleşmeleri onaylayın
                  </p>
                </div>
              </div>
            </div>

            {/* Luggage Info */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
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
                label="Ağırlık (kg)"
                type="number"
                value={formData.weightKg}
                onChange={(e) => updateField("weightKg", e.target.value)}
                placeholder="15"
                leftIcon={<Weight className="h-4 w-4" />}
                fullWidth
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: "var(--space-5)" }}>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                Notlar (Opsiyonel)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Özel istekleriniz..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-sm)",
                  fontFamily: "inherit",
                  resize: "none",
                }}
              />
            </div>

            {/* Agreements */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                <Shield className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
                  Sözleşmeler
                </span>
              </div>

              {/* KVKK */}
              <div style={{
                marginBottom: "var(--space-3)",
                padding: "var(--space-3)",
                background: formData.kvkkAccepted ? "var(--success-50)" : "var(--bg-tertiary)",
                borderRadius: "var(--radius-lg)",
                border: formData.kvkkAccepted ? "1px solid var(--success-300)" : "1px solid var(--border-primary)",
                transition: "all 0.3s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    KVKK Aydınlatma Metni
                  </span>
                  {formData.kvkkAccepted && <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success-500)" }} />}
                </div>
                {!kvkkScrolled && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--info-600)", margin: "0 0 var(--space-2) 0" }}>
                    ↓ Aşağı kaydırarak okuyun ve otomatik kabul edin
                  </p>
                )}
                <div
                  ref={kvkkRef}
                  onScroll={handleKvkkScroll}
                  style={{
                    maxHeight: "100px",
                    overflowY: "auto",
                    padding: "var(--space-2)",
                    background: "var(--bg-primary)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    lineHeight: 1.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>1. Veri Sorumlusu:</strong> Kişisel verileriniz Kyradi tarafından işlenmektedir.</p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>2. İşlenen Veriler:</strong> Ad, soyad, telefon, e-posta.</p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>3. Amaç:</strong> Rezervasyon yönetimi ve hizmet kalitesi.</p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>4. Güvenlik:</strong> Verileriniz güvenli şekilde korunur.</p>
                  <p style={{ margin: 0 }}><strong>5. Haklarınız:</strong> KVKK 11. madde kapsamında haklarınız saklıdır.</p>
                </div>
              </div>

              {/* Terms */}
              <div style={{
                padding: "var(--space-3)",
                background: formData.termsAccepted ? "var(--success-50)" : "var(--bg-tertiary)",
                borderRadius: "var(--radius-lg)",
                border: formData.termsAccepted ? "1px solid var(--success-300)" : "1px solid var(--border-primary)",
                transition: "all 0.3s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    Kullanım Şartları
                  </span>
                  {formData.termsAccepted && <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success-500)" }} />}
                </div>
                {!termsScrolled && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--info-600)", margin: "0 0 var(--space-2) 0" }}>
                    ↓ Aşağı kaydırarak okuyun ve otomatik kabul edin
                  </p>
                )}
                <div
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  style={{
                    maxHeight: "100px",
                    overflowY: "auto",
                    padding: "var(--space-2)",
                    background: "var(--bg-primary)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    lineHeight: 1.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>1. Hizmet:</strong> Bavul depolama rezervasyonu yapabilirsiniz.</p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>2. Yükümlülük:</strong> Doğru bilgi sağlamakla yükümlüsünüz.</p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>3. Ödeme:</strong> Fiyatlar belirtilen kurallara göre hesaplanır.</p>
                  <p style={{ margin: "0 0 var(--space-2) 0" }}><strong>4. Sorumluluk:</strong> Sınırlı sorumluluk uygulanır.</p>
                  <p style={{ margin: 0 }}><strong>5. Gizlilik:</strong> Verileriniz KVKK kapsamında korunur.</p>
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
    <div style={{ padding: "var(--space-6)", maxWidth: "900px", margin: "0 auto" }}>
      <ToastContainer messages={messages} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", margin: "0 0 var(--space-1) 0" }}>
          Online Rezervasyon Formu
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
          Web sitenize entegre edeceğiniz rezervasyon formunu buradan test edebilirsiniz.
        </p>
      </motion.div>

      {/* Stepper Card */}
      <ModernCard variant="glass" padding="none" style={{ marginBottom: "var(--space-6)", overflow: "hidden" }}>
        {/* Stepper Header */}
        <div style={{
          padding: "var(--space-4) var(--space-6)",
          background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: "-30px",
            right: "-30px",
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }} />
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: "white", margin: 0 }}>
            Rezervasyon Formu
          </h2>
        </div>

        {/* Steps Indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-4) var(--space-6)",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-primary)",
          gap: "var(--space-2)",
        }}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isCompleted = activeStep > step.id;

            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <motion.div
                  animate={{
                    scale: isActive ? 1.05 : 1,
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
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" style={{ color: "white" }} />
                  ) : (
                    <Icon className="h-4 w-4" style={{ color: isActive ? "white" : "var(--text-tertiary)" }} />
                  )}
                </motion.div>
                <span style={{
                  marginLeft: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  fontWeight: isActive ? "var(--font-semibold)" : "var(--font-medium)",
                  color: isActive || isCompleted ? "var(--text-primary)" : "var(--text-tertiary)",
                  display: "none",
                }}>
                  {step.shortTitle}
                </span>
                {index < steps.length - 1 && (
                  <div style={{
                    width: "40px",
                    height: "2px",
                    margin: "0 var(--space-2)",
                    background: isCompleted ? "#16a34a" : "var(--border-primary)",
                    transition: "background 0.3s ease",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Title */}
        <div style={{ padding: "var(--space-3) var(--space-6)", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-primary)" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
            Adım {activeStep} / 3: {steps[activeStep - 1].title}
          </span>
        </div>

        {/* Form Content */}
        <div style={{ minHeight: "380px" }}>
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>

        {/* Navigation */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "var(--space-4) var(--space-6)",
          borderTop: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
        }}>
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
              Tamamla
            </ModernButton>
          )}
        </div>
      </ModernCard>

      {/* Embed Code Section */}
      <ModernCard variant="glass" padding="lg">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Code className="h-4 w-4" style={{ color: "white" }} />
            </div>
            <div>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", margin: 0, color: "var(--text-primary)" }}>
                Embed Kodu
              </h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                Web sitenize ekleyin
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => setShowEmbedCode(!showEmbedCode)}
            >
              {showEmbedCode ? "Gizle" : "Göster"}
            </ModernButton>
            {showEmbedCode && (
              <ModernButton
                variant="outline"
                size="sm"
                onClick={copySnippet}
                leftIcon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              >
                {copied ? "Kopyalandı" : "Kopyala"}
              </ModernButton>
            )}
          </div>
        </div>

        {showEmbedCode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {tenantQuery.isLoading ? (
              <div style={{ textAlign: "center", padding: "var(--space-4)", color: "var(--text-tertiary)" }}>
                <Loader2 className="h-6 w-6" style={{ margin: "0 auto", animation: "spin 1s linear infinite" }} />
              </div>
            ) : tenantQuery.isError ? (
              <div style={{ textAlign: "center", padding: "var(--space-4)", color: "var(--danger-500)" }}>
                <AlertCircle className="h-6 w-6" style={{ margin: "0 auto var(--space-2) auto" }} />
                <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>{getErrorMessage(tenantQuery.error)}</p>
              </div>
            ) : (
              <textarea
                readOnly
                value={snippet}
                rows={5}
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
            )}
          </motion.div>
        )}
      </ModernCard>
    </div>
  );
}
