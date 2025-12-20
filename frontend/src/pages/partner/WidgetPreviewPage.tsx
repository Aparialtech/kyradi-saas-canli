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

  return (
    <div style={{ 
      width: "100%",
      minHeight: "100%",
      background: "var(--bg-primary)",
    }}>
      <ToastContainer messages={messages} />

      {/* Page Header */}
      <div style={{ 
        padding: "24px 32px",
        borderBottom: "1px solid var(--border-primary)",
        background: "var(--bg-secondary)",
      }}>
        <h1 style={{ 
          fontSize: "24px", 
          fontWeight: 700, 
          color: "var(--text-primary)", 
          margin: "0 0 4px 0" 
        }}>
          Online Rezervasyon Formu
        </h1>
        <p style={{ 
          fontSize: "14px", 
          color: "var(--text-tertiary)", 
          margin: 0 
        }}>
          Web sitenize entegre edeceğiniz rezervasyon formunu buradan test edebilirsiniz.
        </p>
      </div>

      {/* Main Content */}
      <div style={{ padding: "24px 32px" }}>
        {/* Stepper - Horizontal Steps */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
          padding: "24px",
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-primary)",
        }}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isCompleted = activeStep > step.id;

            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                {/* Step Circle */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "100px" }}>
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                    }}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isCompleted
                        ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                        : isActive
                        ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                        : "#f1f5f9",
                      border: isActive || isCompleted ? "none" : "2px solid #e2e8f0",
                      boxShadow: isActive ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "none",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {isCompleted ? (
                      <Check style={{ width: "20px", height: "20px", color: "white" }} />
                    ) : (
                      <Icon style={{ width: "20px", height: "20px", color: isActive ? "white" : "#94a3b8" }} />
                    )}
                  </motion.div>
                  <div style={{ marginTop: "8px", textAlign: "center" }}>
                    <div style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: isActive ? "#3b82f6" : isCompleted ? "#16a34a" : "#94a3b8",
                    }}>
                      Adım {step.id}
                    </div>
                    <div style={{
                      fontSize: "13px",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive || isCompleted ? "var(--text-primary)" : "var(--text-tertiary)",
                      marginTop: "2px",
                    }}>
                      {step.title}
                    </div>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div style={{
                    width: "80px",
                    height: "3px",
                    margin: "0 8px",
                    marginBottom: "40px",
                    background: isCompleted ? "#16a34a" : "#e2e8f0",
                    borderRadius: "2px",
                    transition: "background 0.3s ease",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <div style={{
          maxWidth: "600px",
          margin: "0 auto",
          background: "white",
          borderRadius: "16px",
          border: "1px solid var(--border-primary)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
        }}>
          {/* Form Header */}
          <div style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "white",
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
              {steps[activeStep - 1].title}
            </h2>
            <p style={{ fontSize: "13px", opacity: 0.9, margin: "4px 0 0 0" }}>
              {activeStep === 1 && "İletişim bilgilerinizi girin"}
              {activeStep === 2 && "Tarih ve saat seçin"}
              {activeStep === 3 && "Bavul bilgilerini girin ve sözleşmeleri onaylayın"}
            </p>
          </div>

          {/* Form Content */}
          <AnimatePresence mode="wait">
            {activeStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ padding: "24px" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <ModernInput
                    label="Ad Soyad"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    placeholder="Adınız ve soyadınız"
                    leftIcon={<User style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="E-posta"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="ornek@email.com"
                    leftIcon={<Mail style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="Telefon"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+90 5XX XXX XX XX"
                    leftIcon={<Phone style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                </div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ padding: "24px" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <ModernInput
                    label="Bırakış Tarihi & Saati"
                    type="datetime-local"
                    value={formData.checkIn}
                    onChange={(e) => updateField("checkIn", e.target.value)}
                    leftIcon={<Clock style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="Alış Tarihi & Saati"
                    type="datetime-local"
                    value={formData.checkOut}
                    onChange={(e) => updateField("checkOut", e.target.value)}
                    leftIcon={<Clock style={{ width: "16px", height: "16px" }} />}
                    fullWidth
                    required
                  />

                  {formData.checkIn && formData.checkOut && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: "16px",
                        background: "#f0fdf4",
                        borderRadius: "12px",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <CheckCircle2 style={{ width: "20px", height: "20px", color: "#16a34a" }} />
                        <div>
                          <span style={{ fontWeight: 600, color: "#15803d", fontSize: "14px" }}>
                            Rezervasyon Süresi:
                          </span>
                          <span style={{ marginLeft: "8px", color: "#16a34a", fontSize: "14px" }}>
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
            )}

            {activeStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ padding: "24px" }}
              >
                {/* Luggage Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
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
                    placeholder="Kabin"
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
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: 500, fontSize: "14px", color: "var(--text-primary)" }}>
                    Notlar (Opsiyonel)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Özel istekleriniz..."
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      resize: "none",
                    }}
                  />
                </div>

                {/* Agreements Section */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <Shield style={{ width: "16px", height: "16px", color: "#3b82f6" }} />
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      Sözleşmeler
                    </span>
                  </div>

                  {/* KVKK */}
                  <div style={{
                    marginBottom: "12px",
                    padding: "12px",
                    background: formData.kvkkAccepted ? "#f0fdf4" : "#f8fafc",
                    borderRadius: "10px",
                    border: formData.kvkkAccepted ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 500, fontSize: "13px", color: "var(--text-primary)" }}>
                        KVKK Aydınlatma Metni
                      </span>
                      {formData.kvkkAccepted && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#16a34a" }} />}
                    </div>
                    {!kvkkScrolled && (
                      <p style={{ fontSize: "11px", color: "#3b82f6", margin: "0 0 8px 0" }}>
                        ↓ Aşağı kaydırarak okuyun ve otomatik kabul edin
                      </p>
                    )}
                    <div
                      ref={kvkkRef}
                      onScroll={handleKvkkScroll}
                      style={{
                        maxHeight: "80px",
                        overflowY: "auto",
                        padding: "8px",
                        background: "white",
                        borderRadius: "6px",
                        fontSize: "11px",
                        lineHeight: 1.5,
                        color: "#64748b",
                      }}
                    >
                      <p style={{ margin: "0 0 6px 0" }}><strong>1.</strong> Kişisel verileriniz Kyradi tarafından işlenmektedir.</p>
                      <p style={{ margin: "0 0 6px 0" }}><strong>2.</strong> Ad, soyad, telefon, e-posta verileri işlenir.</p>
                      <p style={{ margin: "0 0 6px 0" }}><strong>3.</strong> Amaç: Rezervasyon yönetimi ve hizmet kalitesi.</p>
                      <p style={{ margin: "0 0 6px 0" }}><strong>4.</strong> Verileriniz güvenli şekilde korunur.</p>
                      <p style={{ margin: 0 }}><strong>5.</strong> KVKK 11. madde kapsamında haklarınız saklıdır.</p>
                    </div>
                  </div>

                  {/* Terms */}
                  <div style={{
                    padding: "12px",
                    background: formData.termsAccepted ? "#f0fdf4" : "#f8fafc",
                    borderRadius: "10px",
                    border: formData.termsAccepted ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 500, fontSize: "13px", color: "var(--text-primary)" }}>
                        Kullanım Şartları
                      </span>
                      {formData.termsAccepted && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#16a34a" }} />}
                    </div>
                    {!termsScrolled && (
                      <p style={{ fontSize: "11px", color: "#3b82f6", margin: "0 0 8px 0" }}>
                        ↓ Aşağı kaydırarak okuyun ve otomatik kabul edin
                      </p>
                    )}
                    <div
                      ref={termsRef}
                      onScroll={handleTermsScroll}
                      style={{
                        maxHeight: "80px",
                        overflowY: "auto",
                        padding: "8px",
                        background: "white",
                        borderRadius: "6px",
                        fontSize: "11px",
                        lineHeight: 1.5,
                        color: "#64748b",
                      }}
                    >
                      <p style={{ margin: "0 0 6px 0" }}><strong>1.</strong> Bavul depolama rezervasyonu yapabilirsiniz.</p>
                      <p style={{ margin: "0 0 6px 0" }}><strong>2.</strong> Doğru bilgi sağlamakla yükümlüsünüz.</p>
                      <p style={{ margin: "0 0 6px 0" }}><strong>3.</strong> Fiyatlar belirtilen kurallara göre hesaplanır.</p>
                      <p style={{ margin: "0 0 6px 0" }}><strong>4.</strong> Sınırlı sorumluluk uygulanır.</p>
                      <p style={{ margin: 0 }}><strong>5.</strong> Verileriniz KVKK kapsamında korunur.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}>
            <ModernButton
              variant="ghost"
              onClick={handlePrev}
              disabled={activeStep === 1}
              leftIcon={<ChevronLeft style={{ width: "16px", height: "16px" }} />}
            >
              Geri
            </ModernButton>

            {activeStep < 3 ? (
              <ModernButton
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
                rightIcon={<ChevronRight style={{ width: "16px", height: "16px" }} />}
              >
                İleri
              </ModernButton>
            ) : (
              <ModernButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!canProceed()}
                leftIcon={<CheckCircle2 style={{ width: "16px", height: "16px" }} />}
              >
                Rezervasyonu Tamamla
              </ModernButton>
            )}
          </div>
        </div>

        {/* Embed Code Section */}
        <div style={{
          maxWidth: "600px",
          margin: "24px auto 0",
          padding: "20px",
          background: "var(--bg-secondary)",
          borderRadius: "12px",
          border: "1px solid var(--border-primary)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Code style={{ width: "18px", height: "18px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                  Embed Kodu
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: 0 }}>
                  Web sitenize ekleyin
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
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
              style={{ marginTop: "16px" }}
            >
              {tenantQuery.isLoading ? (
                <div style={{ textAlign: "center", padding: "16px", color: "var(--text-tertiary)" }}>
                  <Loader2 style={{ width: "24px", height: "24px", margin: "0 auto", animation: "spin 1s linear infinite" }} />
                </div>
              ) : tenantQuery.isError ? (
                <div style={{ textAlign: "center", padding: "16px", color: "#dc2626" }}>
                  <AlertCircle style={{ width: "24px", height: "24px", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, fontSize: "13px" }}>{getErrorMessage(tenantQuery.error)}</p>
                </div>
              ) : (
                <textarea
                  readOnly
                  value={snippet}
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                    color: "var(--text-primary)",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    resize: "none",
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
