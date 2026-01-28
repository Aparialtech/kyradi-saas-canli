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
  Package,
  Briefcase,
  Weight,
  Shield,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  FileText,
} from "../../lib/lucide";

import { getApiBase } from "../../utils/apiBase";
import { partnerWidgetService } from "../../services/partner/widgetConfig";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { getErrorMessage } from "../../lib/httpError";
import { useTranslation } from "../../hooks/useTranslation";
import { ModernButton } from "../../components/ui/ModernButton";
import { ModernInput } from "../../components/ui/ModernInput";
import { ModernCard } from "../../components/ui/ModernCard";
import { DateTimeField } from "../../components/ui/DateField";

declare global {
  interface Window {
    KyradiReserve?: {
      config: Record<string, string>;
      mount: () => void;
    };
  }
}

// Responsive hook
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
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

const steps = [
  { id: 1, title: "Kişisel Bilgiler", shortTitle: "Kişisel", icon: User, description: "İletişim bilgilerinizi girin" },
  { id: 2, title: "Rezervasyon Bilgileri", shortTitle: "Tarihler", icon: Calendar, description: "Tarih ve saat seçin" },
  { id: 3, title: "Bavul & Sözleşme", shortTitle: "Onay", icon: Package, description: "Bilgileri tamamlayın" },
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
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  
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
    const code = buildSnippet(cdnBase, getApiBase(), tenant_id, widget_public_key, locale);
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
    if (activeStep === 1) return formData.fullName.trim() && formData.email.trim() && formData.phone.trim();
    if (activeStep === 2) return formData.checkIn && formData.checkOut;
    if (activeStep === 3) return formData.kvkkAccepted && formData.termsAccepted && formData.baggageCount > 0;
    return false;
  };

  const handleNext = () => { if (activeStep < 3 && canProceed()) setActiveStep((s) => s + 1); };
  const handlePrev = () => { if (activeStep > 1) setActiveStep((s) => s - 1); };

  const handleSubmit = () => {
    if (!canProceed()) {
      push({ title: "Lütfen tüm alanları doldurun", type: "error" });
      return;
    }
    push({ title: "Rezervasyon oluşturuldu!", description: "Demo formu başarıyla tamamlandı.", type: "success" });
    setFormData({ fullName: "", email: "", phone: "", checkIn: "", checkOut: "", baggageCount: 1, baggageType: "", weightKg: "", notes: "", kvkkAccepted: false, termsAccepted: false });
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
    } catch { push({ title: "Kopyalama başarısız", type: "error" }); }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: isMobile ? "var(--space-4)" : isTablet ? "var(--space-6)" : "var(--space-8)",
    maxWidth: "900px",
    margin: "0 auto",
    minHeight: "100vh",
    background: "var(--bg-primary)",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: isMobile ? "var(--space-6)" : "var(--space-8)",
    textAlign: "center",
  };

  return (
    <div style={containerStyle}>
      <ToastContainer messages={messages} />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={headerStyle}
      >
        <div style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          justifyContent: "center",
          width: isMobile ? "64px" : "80px",
          height: isMobile ? "64px" : "80px",
          borderRadius: "var(--radius-2xl)",
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          marginBottom: "var(--space-4)",
          boxShadow: "0 8px 32px rgba(59, 130, 246, 0.25)",
        }}>
          <FileText style={{ width: isMobile ? "28px" : "36px", height: isMobile ? "28px" : "36px", color: "white" }} />
        </div>
        <h1 style={{ 
          fontSize: isMobile ? "var(--text-2xl)" : "var(--text-3xl)",
          fontWeight: "var(--font-black)",
          color: "var(--text-primary)",
          margin: "0 0 var(--space-2) 0",
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Online Rezervasyon Formu
        </h1>
        <p style={{ 
          fontSize: isMobile ? "var(--text-sm)" : "var(--text-base)", 
          color: "var(--text-tertiary)", 
          margin: 0,
          maxWidth: "500px",
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.6,
        }}>
          Web sitenize entegre edeceğiniz rezervasyon formunu test edin
        </p>
      </motion.div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div style={{
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "center",
          gap: isMobile ? "var(--space-2)" : "var(--space-4)",
          padding: isMobile ? "var(--space-3)" : "var(--space-4)",
          background: "var(--bg-secondary)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-primary)",
          flexDirection: isMobile ? "column" : "row",
        }}>
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
                  gap: "var(--space-3)",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                <motion.button
                  onClick={() => isCompleted && setActiveStep(step.id)}
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: isMobile ? "var(--space-3)" : "var(--space-2) var(--space-4)",
                    background: isActive 
                      ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                      : isCompleted 
                      ? "rgba(34, 197, 94, 0.1)" 
                      : "transparent",
                    border: isActive ? "none" : isCompleted ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border-secondary)",
                    borderRadius: "var(--radius-lg)",
                    cursor: isCompleted ? "pointer" : "default",
                    transition: "all 0.3s",
                    flex: isMobile ? 1 : "none",
                    boxShadow: isActive ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "none",
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-full)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isActive ? "rgba(255,255,255,0.2)" : isCompleted ? "rgba(34, 197, 94, 0.15)" : "var(--bg-tertiary)",
                    flexShrink: 0,
                  }}>
                    {isCompleted ? (
                      <Check style={{ width: "18px", height: "18px", color: "#16a34a" }} />
                    ) : (
                      <Icon style={{ width: "18px", height: "18px", color: isActive ? "white" : "var(--text-tertiary)" }} />
                    )}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ 
                      fontSize: "10px", 
                      fontWeight: 600, 
                      color: isActive ? "rgba(255,255,255,0.8)" : isCompleted ? "#16a34a" : "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                      Adım {step.id}
                    </div>
                    <div style={{ 
                      fontSize: "var(--text-sm)", 
                      fontWeight: 600, 
                      color: isActive ? "white" : isCompleted ? "var(--text-primary)" : "var(--text-secondary)",
                    }}>
                      {isMobile ? step.shortTitle : step.title}
                    </div>
                  </div>
                </motion.button>
                
                {index < steps.length - 1 && !isMobile && (
                  <div style={{
                    width: "40px",
                    height: "2px",
                    background: isCompleted ? "#16a34a" : "var(--border-secondary)",
                    borderRadius: "2px",
                    transition: "background 0.3s",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ModernCard variant="elevated" padding="none" style={{ 
          overflow: "hidden",
          border: "1px solid var(--border-primary)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          {/* Card Header */}
          <div style={{
            padding: isMobile ? "var(--space-4)" : "var(--space-5)",
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "white",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {(() => {
                  const StepIcon = steps[activeStep - 1].icon;
                  return <StepIcon style={{ width: "20px", height: "20px", color: "white" }} />;
                })()}
              </div>
              <div>
                <h2 style={{ fontSize: isMobile ? "var(--text-lg)" : "var(--text-xl)", fontWeight: 700, margin: 0 }}>
                  {steps[activeStep - 1].title}
                </h2>
                <p style={{ fontSize: "var(--text-sm)", opacity: 0.9, margin: "4px 0 0" }}>
                  {steps[activeStep - 1].description}
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div style={{ padding: isMobile ? "var(--space-4)" : "var(--space-6)" }}>
            <AnimatePresence mode="wait">
              {/* Step 1: Personal Info */}
              {activeStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
                >
                  <ModernInput
                    label="Ad Soyad *"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    placeholder="Adınız ve soyadınız"
                    leftIcon={<User style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="E-posta *"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="ornek@email.com"
                    leftIcon={<Mail style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="Telefon *"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+90 5XX XXX XX XX"
                    leftIcon={<Phone style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                </motion.div>
              )}

              {/* Step 2: Dates */}
              {activeStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
                >
                  <DateTimeField
                    label="Bırakış Tarihi & Saati"
                    value={formData.checkIn}
                    onChange={(value) => updateField("checkIn", value || "")}
                    fullWidth
                    required
                  />
                  <DateTimeField
                    label="Alış Tarihi & Saati"
                    value={formData.checkOut}
                    onChange={(value) => updateField("checkOut", value || "")}
                    fullWidth
                    required
                  />
                  
                  {formData.checkIn && formData.checkOut && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-4)",
                        background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid rgba(34, 197, 94, 0.2)",
                      }}
                    >
                      <CheckCircle2 style={{ width: "24px", height: "24px", color: "#16a34a", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "#16a34a" }}>
                          Süre Hesaplandı
                        </div>
                        <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                          {(() => {
                            const hours = Math.round((new Date(formData.checkOut).getTime() - new Date(formData.checkIn).getTime()) / (1000 * 60 * 60));
                            const days = Math.floor(hours / 24);
                            if (hours <= 0) return "Geçersiz tarih aralığı";
                            if (days > 0) return `${days} gün ${hours % 24} saat`;
                            return `${hours} saat`;
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Baggage & Agreements */}
              {activeStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
                >
                  {/* Baggage Fields */}
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", 
                    gap: "var(--space-3)" 
                  }}>
                    <ModernInput
                      label="Bavul Sayısı"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.baggageCount.toString()}
                      onChange={(e) => updateField("baggageCount", parseInt(e.target.value) || 1)}
                      leftIcon={<Briefcase style={{ width: "16px", height: "16px" }} />}
                      fullWidth
                    />
                    <ModernInput
                      label="Bavul Tipi"
                      value={formData.baggageType}
                      onChange={(e) => updateField("baggageType", e.target.value)}
                      placeholder="Kabin / Büyük"
                      leftIcon={<Package style={{ width: "16px", height: "16px" }} />}
                      fullWidth
                    />
                    <ModernInput
                      label="Ağırlık (kg)"
                      type="number"
                      value={formData.weightKg}
                      onChange={(e) => updateField("weightKg", e.target.value)}
                      placeholder="15"
                      leftIcon={<Weight style={{ width: "16px", height: "16px" }} />}
                      fullWidth
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "var(--space-2)", 
                      fontWeight: 600, 
                      fontSize: "var(--text-sm)", 
                      color: "var(--text-primary)" 
                    }}>
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
                        fontSize: "var(--text-sm)",
                        fontFamily: "inherit",
                        resize: "none",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  {/* Agreements Section */}
                  <div style={{
                    padding: "var(--space-4)",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-xl)",
                    border: "1px solid var(--border-primary)",
                  }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "var(--space-2)", 
                      marginBottom: "var(--space-4)" 
                    }}>
                      <Shield style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>
                        Sözleşmeler
                      </span>
                    </div>

                    {/* KVKK */}
                    <div style={{
                      padding: "var(--space-3)",
                      background: formData.kvkkAccepted ? "rgba(34, 197, 94, 0.05)" : "var(--bg-tertiary)",
                      borderRadius: "var(--radius-lg)",
                      border: formData.kvkkAccepted ? "2px solid #22c55e" : "1px solid var(--border-primary)",
                      marginBottom: "var(--space-3)",
                      transition: "all 0.3s",
                    }}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        marginBottom: "var(--space-2)" 
                      }}>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                          KVKK Aydınlatma Metni
                        </span>
                        {formData.kvkkAccepted && <CheckCircle2 style={{ width: "20px", height: "20px", color: "#16a34a" }} />}
                      </div>
                      {!kvkkScrolled && (
                        <div style={{
                          fontSize: "var(--text-xs)",
                          color: "#3b82f6",
                          padding: "var(--space-2) var(--space-3)",
                          background: "rgba(59, 130, 246, 0.1)",
                          borderRadius: "var(--radius-md)",
                          marginBottom: "var(--space-2)",
                        }}>
                          ↓ Sonuna kadar kaydırın - otomatik onaylanacak
                        </div>
                      )}
                      <div
                        ref={kvkkRef}
                        onScroll={handleKvkkScroll}
                        style={{
                          height: "100px",
                          overflowY: "auto",
                          padding: "var(--space-3)",
                          background: "white",
                          borderRadius: "var(--radius-md)",
                          fontSize: "var(--text-xs)",
                          lineHeight: 1.6,
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-secondary)",
                        }}
                      >
                        <p style={{ margin: "0 0 8px" }}><strong>1. VERİ SORUMLUSU</strong></p>
                        <p style={{ margin: "0 0 8px" }}>Kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla Kyradi tarafından işlenmektedir.</p>
                        <p style={{ margin: "0 0 8px" }}><strong>2. İŞLENEN VERİLER</strong></p>
                        <p style={{ margin: "0 0 8px" }}>Rezervasyon sürecinde ad, soyad, telefon, e-posta gibi kişisel verileriniz işlenmektedir.</p>
                        <p style={{ margin: "0 0 8px" }}><strong>3. AMAÇLAR</strong></p>
                        <p style={{ margin: "0 0 8px" }}>Verileriniz rezervasyon yönetimi ve müşteri hizmetleri amaçlarıyla işlenmektedir.</p>
                        <p style={{ margin: "16px 0 0", paddingTop: "8px", borderTop: "1px dashed #e2e8f0", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>
                          ✓ Sözleşmenin sonuna ulaştınız
                        </p>
                      </div>
                    </div>

                    {/* Terms */}
                    <div style={{
                      padding: "var(--space-3)",
                      background: formData.termsAccepted ? "rgba(34, 197, 94, 0.05)" : "var(--bg-tertiary)",
                      borderRadius: "var(--radius-lg)",
                      border: formData.termsAccepted ? "2px solid #22c55e" : "1px solid var(--border-primary)",
                      transition: "all 0.3s",
                    }}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        marginBottom: "var(--space-2)" 
                      }}>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                          Kullanım Şartları
                        </span>
                        {formData.termsAccepted && <CheckCircle2 style={{ width: "20px", height: "20px", color: "#16a34a" }} />}
                      </div>
                      {!termsScrolled && (
                        <div style={{
                          fontSize: "var(--text-xs)",
                          color: "#3b82f6",
                          padding: "var(--space-2) var(--space-3)",
                          background: "rgba(59, 130, 246, 0.1)",
                          borderRadius: "var(--radius-md)",
                          marginBottom: "var(--space-2)",
                        }}>
                          ↓ Sonuna kadar kaydırın - otomatik onaylanacak
                        </div>
                      )}
                      <div
                        ref={termsRef}
                        onScroll={handleTermsScroll}
                        style={{
                          height: "100px",
                          overflowY: "auto",
                          padding: "var(--space-3)",
                          background: "white",
                          borderRadius: "var(--radius-md)",
                          fontSize: "var(--text-xs)",
                          lineHeight: 1.6,
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-secondary)",
                        }}
                      >
                        <p style={{ margin: "0 0 8px" }}><strong>1. HİZMET KAPSAMI</strong></p>
                        <p style={{ margin: "0 0 8px" }}>Bu platform, bavul depolama hizmetleri için rezervasyon yapmanıza olanak sağlar.</p>
                        <p style={{ margin: "0 0 8px" }}><strong>2. KULLANICI YÜKÜMLÜLÜKLERİ</strong></p>
                        <p style={{ margin: "0 0 8px" }}>Kullanıcılar, doğru ve güncel bilgi sağlamakla yükümlüdür.</p>
                        <p style={{ margin: "0 0 8px" }}><strong>3. ÖDEME VE İPTAL</strong></p>
                        <p style={{ margin: "0 0 8px" }}>Rezervasyon ücretleri belirtilen kurallara göre hesaplanır.</p>
                        <p style={{ margin: "16px 0 0", paddingTop: "8px", borderTop: "1px dashed #e2e8f0", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>
                          ✓ Sözleşmenin sonuna ulaştınız
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Form Navigation */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: isMobile ? "var(--space-4)" : "var(--space-4) var(--space-6)",
            borderTop: "1px solid var(--border-secondary)",
            background: "var(--bg-secondary)",
            gap: "var(--space-3)",
          }}>
            <ModernButton
              variant="ghost"
              onClick={handlePrev}
              disabled={activeStep === 1}
              leftIcon={<ChevronLeft style={{ width: "18px", height: "18px" }} />}
              style={{ flex: isMobile ? 1 : "none" }}
            >
              Geri
            </ModernButton>
            
            {activeStep < 3 ? (
              <ModernButton
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
                rightIcon={<ChevronRight style={{ width: "18px", height: "18px" }} />}
                style={{ flex: isMobile ? 1 : "none" }}
              >
                İleri
              </ModernButton>
            ) : (
              <ModernButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!canProceed()}
                leftIcon={<CheckCircle2 style={{ width: "18px", height: "18px" }} />}
                style={{ flex: isMobile ? 1 : "none" }}
              >
                Rezervasyonu Tamamla
              </ModernButton>
            )}
          </div>
        </ModernCard>
      </motion.div>

      {/* Embed Code Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: "var(--space-6)" }}
      >
        <ModernCard variant="glass" padding="md" style={{ 
          border: "1px solid var(--border-primary)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Code style={{ width: "20px", height: "20px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                  Embed Kodu
                </h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
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
                  leftIcon={copied ? <Check style={{ width: "14px", height: "14px" }} /> : <Copy style={{ width: "14px", height: "14px" }} />}
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
              style={{ marginTop: "var(--space-4)" }}
            >
              {tenantQuery.isLoading ? (
                <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
                  <Loader2 style={{ width: "24px", height: "24px", animation: "spin 1s linear infinite", color: "var(--primary)" }} />
                </div>
              ) : tenantQuery.isError ? (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "var(--space-2)", 
                  padding: "var(--space-4)", 
                  color: "#dc2626" 
                }}>
                  <AlertCircle style={{ width: "20px", height: "20px" }} />
                  <p style={{ margin: 0 }}>{getErrorMessage(tenantQuery.error)}</p>
                </div>
              ) : (
                <textarea
                  readOnly
                  value={snippet}
                  rows={5}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    fontFamily: "monospace",
                    fontSize: "var(--text-xs)",
                    resize: "none",
                    color: "var(--text-primary)",
                  }}
                />
              )}
            </motion.div>
          )}
        </ModernCard>
      </motion.div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
