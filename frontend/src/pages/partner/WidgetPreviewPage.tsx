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

  return (
    <div className="page-container">
      <ToastContainer messages={messages} />
      
      {/* Page Header */}
      <header className="page-header">
        <h1 className="page-title">Online Rezervasyon Formu</h1>
        <p className="page-subtitle">Web sitenize entegre edeceğiniz rezervasyon formunu test edin.</p>
      </header>

      {/* Main Content */}
      <div className="page-content">
        {/* Stepper */}
        <div className="stepper-container">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isCompleted = activeStep > step.id;
            return (
              <div key={step.id} className="stepper-item">
                <motion.div
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  className={`stepper-circle ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                >
                  {isCompleted ? <Check className="stepper-icon" /> : <Icon className="stepper-icon" />}
                </motion.div>
                <div className="stepper-text">
                  <span className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                    Adım {step.id}
                  </span>
                  <span className={`stepper-title ${isActive || isCompleted ? 'active' : ''}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`stepper-line ${isCompleted ? 'completed' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <div className="form-card">
          <div className="form-card-header">
            <h2>{steps[activeStep - 1].title}</h2>
            <p>
              {activeStep === 1 && "İletişim bilgilerinizi girin"}
              {activeStep === 2 && "Tarih ve saat seçin"}
              {activeStep === 3 && "Bavul bilgilerini girin ve sözleşmeleri onaylayın"}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {activeStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="form-step">
                <div className="form-fields">
                  <ModernInput label="Ad Soyad" value={formData.fullName} onChange={(e) => updateField("fullName", e.target.value)} placeholder="Adınız ve soyadınız" leftIcon={<User className="input-icon" />} fullWidth required />
                  <ModernInput label="E-posta" type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="ornek@email.com" leftIcon={<Mail className="input-icon" />} fullWidth required />
                  <ModernInput label="Telefon" type="tel" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+90 5XX XXX XX XX" leftIcon={<Phone className="input-icon" />} fullWidth required />
                </div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="form-step">
                <div className="form-fields">
                  <ModernInput label="Bırakış Tarihi & Saati" type="datetime-local" value={formData.checkIn} onChange={(e) => updateField("checkIn", e.target.value)} leftIcon={<Clock className="input-icon" />} fullWidth required />
                  <ModernInput label="Alış Tarihi & Saati" type="datetime-local" value={formData.checkOut} onChange={(e) => updateField("checkOut", e.target.value)} leftIcon={<Clock className="input-icon" />} fullWidth required />
                  {formData.checkIn && formData.checkOut && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="duration-badge">
                      <CheckCircle2 className="duration-icon" />
                      <span>Süre: {(() => {
                        const hours = Math.round((new Date(formData.checkOut).getTime() - new Date(formData.checkIn).getTime()) / (1000 * 60 * 60));
                        const days = Math.floor(hours / 24);
                        if (hours <= 0) return "Geçersiz";
                        if (days > 0) return `${days} gün ${hours % 24} saat`;
                        return `${hours} saat`;
                      })()}</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {activeStep === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="form-step">
                <div className="form-fields-grid">
                  <ModernInput label="Bavul Sayısı" type="number" min={1} max={10} value={formData.baggageCount.toString()} onChange={(e) => updateField("baggageCount", parseInt(e.target.value) || 1)} leftIcon={<Briefcase className="input-icon" />} fullWidth />
                  <ModernInput label="Bavul Tipi" value={formData.baggageType} onChange={(e) => updateField("baggageType", e.target.value)} placeholder="Kabin" leftIcon={<Package className="input-icon" />} fullWidth />
                  <ModernInput label="Ağırlık (kg)" type="number" value={formData.weightKg} onChange={(e) => updateField("weightKg", e.target.value)} placeholder="15" leftIcon={<Weight className="input-icon" />} fullWidth />
                </div>
                <div className="form-textarea-wrapper">
                  <label>Notlar (Opsiyonel)</label>
                  <textarea value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Özel istekleriniz..." rows={2} />
                </div>
                <div className="agreements-section">
                  <div className="agreements-header"><Shield className="agreements-icon" /><span>Sözleşmeler</span></div>
                  <div className={`agreement-box ${formData.kvkkAccepted ? 'accepted' : ''}`}>
                    <div className="agreement-title"><span>KVKK Aydınlatma Metni</span>{formData.kvkkAccepted && <CheckCircle2 className="check-icon" />}</div>
                    {!kvkkScrolled && <p className="scroll-hint">↓ Aşağı kaydırarak okuyun ve otomatik kabul edin</p>}
                    <div ref={kvkkRef} onScroll={handleKvkkScroll} className="agreement-content">
                      <p><strong>1.</strong> Kişisel verileriniz Kyradi tarafından işlenmektedir.</p>
                      <p><strong>2.</strong> Ad, soyad, telefon, e-posta verileri işlenir.</p>
                      <p><strong>3.</strong> Amaç: Rezervasyon yönetimi ve hizmet kalitesi.</p>
                      <p><strong>4.</strong> Verileriniz güvenli şekilde korunur.</p>
                      <p><strong>5.</strong> KVKK 11. madde kapsamında haklarınız saklıdır.</p>
                    </div>
                  </div>
                  <div className={`agreement-box ${formData.termsAccepted ? 'accepted' : ''}`}>
                    <div className="agreement-title"><span>Kullanım Şartları</span>{formData.termsAccepted && <CheckCircle2 className="check-icon" />}</div>
                    {!termsScrolled && <p className="scroll-hint">↓ Aşağı kaydırarak okuyun ve otomatik kabul edin</p>}
                    <div ref={termsRef} onScroll={handleTermsScroll} className="agreement-content">
                      <p><strong>1.</strong> Bavul depolama rezervasyonu yapabilirsiniz.</p>
                      <p><strong>2.</strong> Doğru bilgi sağlamakla yükümlüsünüz.</p>
                      <p><strong>3.</strong> Fiyatlar belirtilen kurallara göre hesaplanır.</p>
                      <p><strong>4.</strong> Sınırlı sorumluluk uygulanır.</p>
                      <p><strong>5.</strong> Verileriniz KVKK kapsamında korunur.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="form-navigation">
            <ModernButton variant="ghost" onClick={handlePrev} disabled={activeStep === 1} leftIcon={<ChevronLeft className="btn-icon" />}>Geri</ModernButton>
            {activeStep < 3 ? (
              <ModernButton variant="primary" onClick={handleNext} disabled={!canProceed()} rightIcon={<ChevronRight className="btn-icon" />}>İleri</ModernButton>
            ) : (
              <ModernButton variant="primary" onClick={handleSubmit} disabled={!canProceed()} leftIcon={<CheckCircle2 className="btn-icon" />}>Rezervasyonu Tamamla</ModernButton>
            )}
          </div>
        </div>

        {/* Embed Code */}
        <div className="embed-section">
          <div className="embed-header">
            <div className="embed-title-wrapper">
              <div className="embed-icon-wrapper"><Code className="embed-icon" /></div>
              <div><h3>Embed Kodu</h3><p>Web sitenize ekleyin</p></div>
            </div>
            <div className="embed-actions">
              <ModernButton variant="ghost" size="sm" onClick={() => setShowEmbedCode(!showEmbedCode)}>{showEmbedCode ? "Gizle" : "Göster"}</ModernButton>
              {showEmbedCode && <ModernButton variant="outline" size="sm" onClick={copySnippet} leftIcon={copied ? <Check className="btn-icon-sm" /> : <Copy className="btn-icon-sm" />}>{copied ? "Kopyalandı" : "Kopyala"}</ModernButton>}
            </div>
          </div>
          {showEmbedCode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="embed-content">
              {tenantQuery.isLoading ? (
                <div className="embed-loading"><Loader2 className="spinner" /></div>
              ) : tenantQuery.isError ? (
                <div className="embed-error"><AlertCircle /><p>{getErrorMessage(tenantQuery.error)}</p></div>
              ) : (
                <textarea readOnly value={snippet} rows={5} onFocus={(e) => e.currentTarget.select()} />
              )}
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        .page-container {
          width: 100%;
          min-width: 0;
          min-height: 100%;
          background: var(--bg-primary);
        }
        .page-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-primary);
          background: var(--bg-secondary);
        }
        .page-title {
          font-size: clamp(20px, 3vw, 24px);
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px 0;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .page-subtitle {
          font-size: 13px;
          color: var(--text-tertiary);
          margin: 0;
        }
        .page-content {
          padding: 20px 24px;
          max-width: 640px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .page-content { padding: 16px; max-width: 100%; }
        }
        
        /* Stepper */
        .stepper-container {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 8px;
          margin-bottom: 24px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border-primary);
          flex-wrap: wrap;
        }
        .stepper-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .stepper-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          border: 2px solid #e2e8f0;
          flex-shrink: 0;
          transition: all 0.3s;
        }
        .stepper-circle.active {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: none;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .stepper-circle.completed {
          background: linear-gradient(135deg, #16a34a, #15803d);
          border: none;
        }
        .stepper-circle .stepper-icon {
          width: 18px;
          height: 18px;
          color: #94a3b8;
        }
        .stepper-circle.active .stepper-icon,
        .stepper-circle.completed .stepper-icon {
          color: white;
        }
        .stepper-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .stepper-step {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
        }
        .stepper-step.active { color: #3b82f6; }
        .stepper-step.completed { color: #16a34a; }
        .stepper-title {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-tertiary);
          white-space: nowrap;
        }
        .stepper-title.active { color: var(--text-primary); font-weight: 600; }
        .stepper-line {
          width: 32px;
          height: 2px;
          background: #e2e8f0;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .stepper-line.completed { background: #16a34a; }
        @media (max-width: 600px) {
          .stepper-container { flex-direction: column; align-items: stretch; }
          .stepper-item { justify-content: flex-start; }
          .stepper-line { width: 2px; height: 20px; margin-left: 19px; }
        }
        
        /* Form Card */
        .form-card {
          background: white;
          border-radius: 12px;
          border: 1px solid var(--border-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          overflow: hidden;
          margin-bottom: 20px;
        }
        .form-card-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }
        .form-card-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
        .form-card-header p { font-size: 12px; opacity: 0.9; margin: 4px 0 0; }
        .form-step { padding: 20px; }
        .form-fields { display: flex; flex-direction: column; gap: 16px; }
        .form-fields-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .form-textarea-wrapper { margin-bottom: 16px; }
        .form-textarea-wrapper label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px; color: var(--text-primary); }
        .form-textarea-wrapper textarea { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 14px; font-family: inherit; resize: none; }
        .form-navigation { display: flex; justify-content: space-between; padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
        .input-icon { width: 16px; height: 16px; }
        .btn-icon { width: 16px; height: 16px; }
        .btn-icon-sm { width: 14px; height: 14px; }
        
        /* Duration Badge */
        .duration-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #f0fdf4;
          border-radius: 10px;
          border: 1px solid #bbf7d0;
          font-size: 14px;
          font-weight: 500;
          color: #16a34a;
        }
        .duration-icon { width: 20px; height: 20px; color: #16a34a; }
        
        /* Agreements */
        .agreements-section { margin-top: 8px; }
        .agreements-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .agreements-icon { width: 16px; height: 16px; color: #3b82f6; }
        .agreement-box { padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 12px; transition: all 0.3s; }
        .agreement-box.accepted { background: #f0fdf4; border-color: #bbf7d0; }
        .agreement-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; font-weight: 500; }
        .check-icon { width: 16px; height: 16px; color: #16a34a; }
        .scroll-hint { font-size: 11px; color: #3b82f6; margin: 0 0 8px; }
        .agreement-content { max-height: 80px; overflow-y: auto; padding: 8px; background: white; border-radius: 6px; font-size: 11px; line-height: 1.5; color: #64748b; }
        .agreement-content p { margin: 0 0 6px; }
        .agreement-content p:last-child { margin: 0; }
        
        /* Embed Section */
        .embed-section { padding: 16px; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--border-primary); }
        .embed-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .embed-title-wrapper { display: flex; align-items: center; gap: 12px; }
        .embed-icon-wrapper { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; }
        .embed-icon { width: 18px; height: 18px; color: white; }
        .embed-title-wrapper h3 { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); }
        .embed-title-wrapper p { font-size: 12px; color: var(--text-tertiary); margin: 0; }
        .embed-actions { display: flex; gap: 8px; }
        .embed-content { margin-top: 16px; }
        .embed-content textarea { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f1f5f9; font-family: monospace; font-size: 12px; resize: none; }
        .embed-loading { text-align: center; padding: 16px; }
        .embed-error { text-align: center; padding: 16px; color: #dc2626; }
        .spinner { width: 24px; height: 24px; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
