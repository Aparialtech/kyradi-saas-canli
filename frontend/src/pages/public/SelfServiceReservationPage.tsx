import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  User, Phone, Calendar, Package, MapPin, DollarSign, FileText, CheckCircle2, AlertCircle, Loader2, Clock, Shield, Eye, Briefcase
} from "../../lib/lucide";
import {
  selfServiceReservationService,
  type SelfServiceReservation,
  type SelfServiceReservationCreatePayload,
  type SelfServiceReservationCreateResponse,
  type SelfServiceHandoverPayload,
  type SelfServiceReturnPayload,
} from "../../services/public/reservations";
import { pricingService, type PriceEstimateResponse } from "../../services/public/pricing";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { Modal } from "../../components/common/Modal";
import { getErrorMessage } from "../../lib/httpError";
import { ModernCard } from "../../components/ui/ModernCard";
import { ModernInput } from "../../components/ui/ModernInput";
import { ModernButton } from "../../components/ui/ModernButton";
import { ModernModal } from "../../components/ui/ModernModal";

const statusLabels: Record<string, string> = {
  active: "Aktif",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const statusColors: Record<string, { bg: string; color: string; border: string }> = {
  active: { bg: "rgba(34, 197, 94, 0.1)", color: "#16a34a", border: "rgba(34, 197, 94, 0.3)" },
  completed: { bg: "rgba(59, 130, 246, 0.1)", color: "#2563eb", border: "rgba(59, 130, 246, 0.3)" },
  cancelled: { bg: "rgba(239, 68, 68, 0.1)", color: "#dc2626", border: "rgba(239, 68, 68, 0.3)" },
};

// Custom hook for responsive design
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  return size;
}

export function SelfServiceReservationPage() {
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SelfServiceReservation | null>(null);
  const [createForm, setCreateForm] = useState<SelfServiceReservationCreatePayload>({
    tenant_slug: "",
    locker_code: "",
    start_at: "",
    end_at: "",
    customer_name: "",
    customer_phone: "",
    baggage_count: 1,
    baggage_type: "",
    weight_kg: undefined,
    notes: "",
  });
  const [createResult, setCreateResult] = useState<SelfServiceReservationCreateResponse | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [handoverForm, setHandoverForm] = useState({
    handover_by: "self-service",
    notes: "",
    evidence_url: "",
  });
  const [returnForm, setReturnForm] = useState({
    returned_by: "guest",
    notes: "",
    evidence_url: "",
  });
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimateResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  
  // Contract/Agreement states
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasReadKvkk, setHasReadKvkk] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [kvkkScrolledToBottom, setKvkkScrolledToBottom] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  
  // Active step for mobile stepper
  const [activeStep, setActiveStep] = useState(0);
  
  // Refs for scroll detection
  const kvkkScrollRef = useRef<HTMLDivElement>(null);
  const termsScrollRef = useRef<HTMLDivElement>(null);
  
  const { messages, push } = useToast();

  // Handle scroll to bottom detection for KVKK
  const handleKvkkScroll = useCallback(() => {
    const element = kvkkScrollRef.current;
    if (!element) return;
    
    const isAtBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    if (isAtBottom && !kvkkScrolledToBottom) {
      setKvkkScrolledToBottom(true);
      setHasReadKvkk(true);
      setKvkkAccepted(true);
    }
  }, [kvkkScrolledToBottom]);

  // Handle scroll to bottom detection for Terms
  const handleTermsScroll = useCallback(() => {
    const element = termsScrollRef.current;
    if (!element) return;
    
    const isAtBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    if (isAtBottom && !termsScrolledToBottom) {
      setTermsScrolledToBottom(true);
      setHasReadTerms(true);
      setTermsAccepted(true);
    }
  }, [termsScrolledToBottom]);

  // Reset scroll state when modals open
  useEffect(() => {
    if (showKvkkModal) {
      setKvkkScrolledToBottom(false);
    }
  }, [showKvkkModal]);

  useEffect(() => {
    if (showTermsModal) {
      setTermsScrolledToBottom(false);
    }
  }, [showTermsModal]);

  // Calculate price when dates or baggage count changes
  const calculatePrice = useCallback(async () => {
    if (!createForm.tenant_slug || !createForm.start_at || !createForm.end_at) {
      setPriceEstimate(null);
      setPriceError(null);
      return;
    }

    const startDate = new Date(createForm.start_at);
    const endDate = new Date(createForm.end_at);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      setPriceEstimate(null);
      setPriceError(null);
      return;
    }

    setPriceLoading(true);
    setPriceError(null);

    try {
      const estimate = await pricingService.estimatePrice({
        tenant_slug: createForm.tenant_slug,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        baggage_count: createForm.baggage_count ?? 1,
      });
      setPriceEstimate(estimate);
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      setPriceError(errorMsg);
      setPriceEstimate(null);
    } finally {
      setPriceLoading(false);
    }
  }, [createForm.tenant_slug, createForm.start_at, createForm.end_at, createForm.baggage_count]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculatePrice();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [calculatePrice]);

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      push({ title: "QR kodu girin", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const lookup = await selfServiceReservationService.lookup({ code: code.trim() });
      setResult(lookup);
      if (!lookup.valid) {
        push({ title: "Rezervasyon bulunamadı", type: "error" });
      }
    } catch (error) {
      push({ title: "Sorgu başarısız", description: getErrorMessage(error), type: "error" });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReservation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createForm.tenant_slug.trim() || !createForm.locker_code.trim()) {
      push({ title: "Otel ve depo kodu zorunlu", type: "error" });
      return;
    }
    if (!createForm.start_at || !createForm.end_at) {
      push({ title: "Başlangıç ve bitiş zamanı zorunlu", type: "error" });
      return;
    }
    if (!kvkkAccepted || !termsAccepted) {
      push({ title: "Lütfen tüm sözleşmeleri kabul edin", type: "error" });
      return;
    }
    setCreateLoading(true);
    setCreateResult(null);
    try {
      const payload: SelfServiceReservationCreatePayload = {
        ...createForm,
        start_at: new Date(createForm.start_at).toISOString(),
        end_at: new Date(createForm.end_at).toISOString(),
        customer_name: createForm.customer_name?.trim() || undefined,
        customer_phone: createForm.customer_phone?.trim() || undefined,
        baggage_type: createForm.baggage_type?.trim() || undefined,
        notes: createForm.notes?.trim() || undefined,
      };
      const response = await selfServiceReservationService.create(payload);
      setCreateResult(response);
      push({ title: "Rezervasyon oluşturuldu", type: "success" });
      setCode(response.qr_code);
      setCreateForm({
        tenant_slug: "",
        locker_code: "",
        start_at: "",
        end_at: "",
        customer_name: "",
        customer_phone: "",
        baggage_count: 1,
        baggage_type: "",
        weight_kg: undefined,
        notes: "",
      });
      setKvkkAccepted(false);
      setTermsAccepted(false);
      setHasReadKvkk(false);
      setHasReadTerms(false);
      setActiveStep(0);
    } catch (error) {
      push({ title: "Rezervasyon oluşturulamadı", description: getErrorMessage(error), type: "error" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSelfHandover = async (event: React.FormEvent) => {
    event.preventDefault();
    const qrCode = code.trim();
    if (!qrCode) {
      push({ title: "Önce QR kodunu girin", type: "error" });
      return;
    }
    if (!result || !result.valid) {
      push({ title: "Geçerli bir rezervasyon bulunamadı", type: "error" });
      return;
    }
    if (result.handover_at) {
      push({ title: "Teslim zaten kaydedilmiş", type: "info" });
      return;
    }
    setHandoverLoading(true);
    try {
      const payload: SelfServiceHandoverPayload = {
        handover_by: handoverForm.handover_by?.trim() || "self-service",
        handover_at: new Date().toISOString(),
        notes: handoverForm.notes?.trim() || undefined,
        evidence_url: handoverForm.evidence_url?.trim() || undefined,
      };
      const response = await selfServiceReservationService.handover(qrCode, payload);
      setResult(response);
      setHandoverForm({ handover_by: "self-service", notes: "", evidence_url: "" });
      push({ title: "Teslim kaydedildi", type: "success" });
      setHandoverModalOpen(false);
    } catch (error) {
      push({ title: "Teslim kaydedilemedi", description: getErrorMessage(error), type: "error" });
    } finally {
      setHandoverLoading(false);
    }
  };

  const handleSelfReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    const qrCode = code.trim();
    if (!qrCode) {
      push({ title: "Önce QR kodunu girin", type: "error" });
      return;
    }
    if (!result || !result.valid) {
      push({ title: "Geçerli bir rezervasyon bulunamadı", type: "error" });
      return;
    }
    if (!result.handover_at) {
      push({ title: "Önce depo teslimini tamamlayın", type: "error" });
      return;
    }
    if (result.returned_at) {
      push({ title: "İade zaten kaydedilmiş", type: "info" });
      return;
    }
    setReturnLoading(true);
    try {
      const payload: SelfServiceReturnPayload = {
        returned_by: returnForm.returned_by?.trim() || "guest",
        returned_at: new Date().toISOString(),
        notes: returnForm.notes?.trim() || undefined,
        evidence_url: returnForm.evidence_url?.trim() || undefined,
      };
      const response = await selfServiceReservationService.confirmReturn(qrCode, payload);
      setResult(response);
      setReturnForm({ returned_by: "guest", notes: "", evidence_url: "" });
      push({ title: "İade kaydedildi", type: "success" });
      setReturnModalOpen(false);
    } catch (error) {
      push({ title: "İade kaydedilemedi", description: getErrorMessage(error), type: "error" });
    } finally {
      setReturnLoading(false);
    }
  };

  // Step definitions for mobile stepper
  const steps = [
    { id: 0, title: "Misafir", icon: User },
    { id: 1, title: "Tarihler", icon: Calendar },
    { id: 2, title: "Depo", icon: MapPin },
    { id: 3, title: "Bavul", icon: Package },
    { id: 4, title: "Onay", icon: Shield },
  ];

  // Responsive styles
  const containerStyle: React.CSSProperties = {
    padding: isMobile ? "var(--space-4)" : isTablet ? "var(--space-6)" : "var(--space-8)",
    maxWidth: "1200px",
    margin: "0 auto",
    minHeight: "100vh",
    background: "var(--bg-primary)",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: isMobile ? "var(--space-6)" : "var(--space-8)",
    textAlign: "center",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: isMobile ? "var(--text-2xl)" : "var(--text-4xl)",
    fontWeight: "var(--font-black)",
    color: "var(--text-primary)",
    margin: "0 0 var(--space-2) 0",
    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-600) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr",
    gap: isMobile ? "var(--space-4)" : "var(--space-6)",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    marginBottom: "var(--space-4)",
    padding: "var(--space-3)",
    background: "linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(var(--primary-rgb), 0.03) 100%)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid rgba(var(--primary-rgb), 0.1)",
  };

  const formGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
    gap: "var(--space-4)",
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
          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-600) 100%)",
          marginBottom: "var(--space-4)",
          boxShadow: "0 8px 32px rgba(var(--primary-rgb), 0.25)",
        }}>
          <Briefcase style={{ width: isMobile ? "28px" : "36px", height: isMobile ? "28px" : "36px", color: "white" }} />
        </div>
        <h1 style={titleStyle}>Bavul Emanet Hizmeti</h1>
        <p style={{ 
          fontSize: isMobile ? "var(--text-sm)" : "var(--text-lg)", 
          color: "var(--text-tertiary)", 
          margin: 0,
          maxWidth: "600px",
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.6,
        }}>
          Bavulunuzu güvenle bırakın. Hızlı ve kolay rezervasyon yapın.
        </p>
      </motion.div>

      <div style={gridStyle}>
        {/* NEW RESERVATION FORM */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ModernCard variant="elevated" padding={isMobile ? "md" : "lg"} style={{ 
            border: "1px solid var(--border-primary)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}>
            {/* Card Header */}
            <div style={{ 
              marginBottom: "var(--space-6)",
              paddingBottom: "var(--space-4)",
              borderBottom: "1px solid var(--border-secondary)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-xl)",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-600) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <FileText style={{ width: "24px", height: "24px", color: "white" }} />
                </div>
                <div>
                  <h2 style={{ 
                    fontSize: isMobile ? "var(--text-xl)" : "var(--text-2xl)", 
                    fontWeight: "var(--font-bold)", 
                    color: "var(--text-primary)", 
                    margin: 0 
                  }}>
                    Yeni Rezervasyon
                  </h2>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                    Birkaç adımda rezervasyonunuzu oluşturun
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Step Indicator */}
            {isMobile && (
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                marginBottom: "var(--space-6)",
                padding: "var(--space-3)",
                background: "var(--bg-secondary)",
                borderRadius: "var(--radius-lg)",
                overflowX: "auto",
              }}>
                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isActive = activeStep === idx;
                  const isCompleted = activeStep > idx;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setActiveStep(idx)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        padding: "var(--space-2)",
                        border: "none",
                        background: isActive ? "var(--primary)" : isCompleted ? "rgba(34, 197, 94, 0.1)" : "transparent",
                        borderRadius: "var(--radius-md)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        minWidth: "52px",
                      }}
                    >
                      <Icon style={{ 
                        width: "18px", 
                        height: "18px", 
                        color: isActive ? "white" : isCompleted ? "#16a34a" : "var(--text-tertiary)" 
                      }} />
                      <span style={{ 
                        fontSize: "10px", 
                        fontWeight: 500,
                        color: isActive ? "white" : isCompleted ? "#16a34a" : "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}>
                        {step.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleCreateReservation} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              {/* SECTION 1: Guest Information */}
              {(!isMobile || activeStep === 0) && (
                <motion.div
                  initial={isMobile ? { opacity: 0, x: 20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div style={sectionHeaderStyle}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <User style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                        Misafir Bilgileri
                      </h3>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        İletişim bilgilerinizi girin
                      </p>
                    </div>
                  </div>
                  <div style={formGridStyle}>
                    <ModernInput
                      label="Müşteri Adı"
                      value={createForm.customer_name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                      placeholder="Ad Soyad (opsiyonel)"
                      leftIcon={<User className="h-4 w-4" />}
                      fullWidth
                    />
                    <ModernInput
                      label="Telefon"
                      type="tel"
                      value={createForm.customer_phone}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                      placeholder="0 555 ..."
                      leftIcon={<Phone className="h-4 w-4" />}
                      fullWidth
                    />
                  </div>
                </motion.div>
              )}

              {/* SECTION 2: Reservation Dates */}
              {(!isMobile || activeStep === 1) && (
                <motion.div
                  initial={isMobile ? { opacity: 0, x: 20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div style={sectionHeaderStyle}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Calendar style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                        Rezervasyon Tarihleri
                      </h3>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        Bırakış ve alış zamanını seçin
                      </p>
                    </div>
                  </div>
                  <div style={formGridStyle}>
                    <ModernInput
                      label="Başlangıç *"
                      type="datetime-local"
                      value={createForm.start_at}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, start_at: e.target.value }))}
                      leftIcon={<Clock className="h-4 w-4" />}
                      fullWidth
                      required
                    />
                    <ModernInput
                      label="Bitiş *"
                      type="datetime-local"
                      value={createForm.end_at}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, end_at: e.target.value }))}
                      leftIcon={<Clock className="h-4 w-4" />}
                      fullWidth
                      required
                    />
                  </div>
                </motion.div>
              )}

              {/* SECTION 3: Storage Selection */}
              {(!isMobile || activeStep === 2) && (
                <motion.div
                  initial={isMobile ? { opacity: 0, x: 20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div style={sectionHeaderStyle}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <MapPin style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                        Depo Seçimi
                      </h3>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        Hangi depoya bırakacaksınız?
                      </p>
                    </div>
                  </div>
                  <div style={formGridStyle}>
                    <ModernInput
                      label="Otel Kodu *"
                      value={createForm.tenant_slug}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, tenant_slug: e.target.value }))}
                      placeholder="örn. demo-hotel"
                      leftIcon={<MapPin className="h-4 w-4" />}
                      fullWidth
                      required
                    />
                    <ModernInput
                      label="Depo Kodu *"
                      value={createForm.locker_code}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, locker_code: e.target.value }))}
                      placeholder="örn. LK-01"
                      leftIcon={<Package className="h-4 w-4" />}
                      fullWidth
                      required
                    />
                  </div>
                </motion.div>
              )}

              {/* SECTION 4: Luggage Details */}
              {(!isMobile || activeStep === 3) && (
                <motion.div
                  initial={isMobile ? { opacity: 0, x: 20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div style={sectionHeaderStyle}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Package style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                        Bavul Detayları
                      </h3>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        Emanet edeceğiniz eşyalar
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "var(--space-4)" }}>
                    <ModernInput
                      label="Bavul Sayısı"
                      type="number"
                      min={0}
                      value={createForm.baggage_count ?? ""}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          baggage_count: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      leftIcon={<Package className="h-4 w-4" />}
                      fullWidth
                    />
                    <ModernInput
                      label="Bavul Türü"
                      value={createForm.baggage_type ?? ""}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, baggage_type: e.target.value }))}
                      placeholder="Kabin / Büyük"
                      fullWidth
                    />
                    <ModernInput
                      label="Ağırlık (kg)"
                      type="number"
                      min={0}
                      step={0.1}
                      value={createForm.weight_kg ?? ""}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          weight_kg: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      fullWidth
                    />
                  </div>
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                      Notlar
                    </label>
                    <textarea
                      value={createForm.notes ?? ""}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Özel talepler veya notlar..."
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
                        transition: "border-color 0.2s",
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {/* SECTION 5: Price & Agreements */}
              {(!isMobile || activeStep === 4) && (
                <motion.div
                  initial={isMobile ? { opacity: 0, x: 20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {/* Dynamic Pricing Summary */}
                  {(priceLoading || priceEstimate || priceError) && (
                    <div style={{ 
                      marginBottom: "var(--space-4)",
                      padding: "var(--space-4)",
                      borderRadius: "var(--radius-xl)",
                      background: priceEstimate 
                        ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)"
                        : priceError
                        ? "linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)"
                        : "var(--bg-tertiary)",
                      border: priceEstimate 
                        ? "1px solid rgba(34, 197, 94, 0.2)"
                        : priceError
                        ? "1px solid rgba(220, 38, 38, 0.2)"
                        : "1px solid var(--border-primary)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <DollarSign style={{ width: "20px", height: "20px", color: priceEstimate ? "#16a34a" : priceError ? "#dc2626" : "var(--text-tertiary)" }} />
                          <span style={{ fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>Fiyat Özeti</span>
                        </div>
                        {priceLoading && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "var(--primary)" }} />}
                      </div>
                      {priceLoading ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-tertiary)" }}>
                          <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                          <span>Hesaplanıyor...</span>
                        </div>
                      ) : priceError ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "#dc2626" }}>
                          <AlertCircle style={{ width: "16px", height: "16px" }} />
                          <span>{priceError}</span>
                        </div>
                      ) : priceEstimate ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Toplam Tutar</span>
                            <span style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "#16a34a" }}>
                              {priceEstimate.total_formatted}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
                            <span>{priceEstimate.duration_hours.toFixed(1)} saat</span>
                            <span>• {priceEstimate.baggage_count} bavul</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  {/* Agreements */}
                  <div style={sectionHeaderStyle}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Shield style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)", margin: 0 }}>
                        Sözleşmeler
                      </h3>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: 0 }}>
                        Devam etmek için onaylayın
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {/* KVKK */}
                    <div 
                      onClick={() => !hasReadKvkk && setShowKvkkModal(true)}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "var(--space-3)", 
                        cursor: "pointer", 
                        padding: "var(--space-4)", 
                        borderRadius: "var(--radius-lg)", 
                        border: kvkkAccepted ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border-primary)", 
                        background: kvkkAccepted ? "rgba(34, 197, 94, 0.05)" : "var(--bg-tertiary)", 
                        transition: "all 0.2s" 
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={kvkkAccepted}
                        onChange={(e) => {
                          if (e.target.checked && !hasReadKvkk) {
                            setShowKvkkModal(true);
                          } else {
                            setKvkkAccepted(e.target.checked);
                          }
                        }}
                        disabled={!hasReadKvkk}
                        style={{ width: "20px", height: "20px", cursor: "pointer", accentColor: "var(--primary)" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "var(--font-semibold)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                            KVKK Aydınlatma Metni
                          </span>
                          {!hasReadKvkk && (
                            <span style={{ 
                              fontSize: "var(--text-xs)", 
                              padding: "2px 8px", 
                              background: "var(--primary)", 
                              color: "white", 
                              borderRadius: "var(--radius-full)" 
                            }}>
                              Okuyun
                            </span>
                          )}
                          {kvkkAccepted && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#16a34a" }} />}
                        </div>
                      </div>
                    </div>

                    {/* Terms */}
                    <div 
                      onClick={() => !hasReadTerms && setShowTermsModal(true)}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "var(--space-3)", 
                        cursor: "pointer", 
                        padding: "var(--space-4)", 
                        borderRadius: "var(--radius-lg)", 
                        border: termsAccepted ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border-primary)", 
                        background: termsAccepted ? "rgba(34, 197, 94, 0.05)" : "var(--bg-tertiary)", 
                        transition: "all 0.2s" 
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          if (e.target.checked && !hasReadTerms) {
                            setShowTermsModal(true);
                          } else {
                            setTermsAccepted(e.target.checked);
                          }
                        }}
                        disabled={!hasReadTerms}
                        style={{ width: "20px", height: "20px", cursor: "pointer", accentColor: "var(--primary)" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "var(--font-semibold)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                            Kullanım Şartları
                          </span>
                          {!hasReadTerms && (
                            <span style={{ 
                              fontSize: "var(--text-xs)", 
                              padding: "2px 8px", 
                              background: "var(--primary)", 
                              color: "white", 
                              borderRadius: "var(--radius-full)" 
                            }}>
                              Okuyun
                            </span>
                          )}
                          {termsAccepted && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#16a34a" }} />}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Mobile Navigation */}
              {isMobile && (
                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between" }}>
                  <ModernButton
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                    disabled={activeStep === 0}
                    style={{ flex: 1 }}
                  >
                    Geri
                  </ModernButton>
                  {activeStep < 4 ? (
                    <ModernButton
                      type="button"
                      variant="primary"
                      onClick={() => setActiveStep(Math.min(4, activeStep + 1))}
                      style={{ flex: 1 }}
                    >
                      İleri
                    </ModernButton>
                  ) : (
                    <ModernButton
                      type="submit"
                      variant="primary"
                      disabled={createLoading || priceLoading || !kvkkAccepted || !termsAccepted}
                      isLoading={createLoading}
                      loadingText="Oluşturuluyor..."
                      style={{ flex: 1 }}
                    >
                      Rezervasyon Oluştur
                    </ModernButton>
                  )}
                </div>
              )}

              {/* Desktop Submit Button */}
              {!isMobile && (
                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-secondary)" }}>
                  <ModernButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={createLoading || priceLoading || !kvkkAccepted || !termsAccepted}
                    isLoading={createLoading}
                    loadingText="Oluşturuluyor..."
                    leftIcon={!createLoading && <CheckCircle2 style={{ width: "18px", height: "18px" }} />}
                  >
                    Rezervasyon Oluştur
                  </ModernButton>
                </div>
              )}
            </form>

            {/* Success Result */}
            {createResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ marginTop: "var(--space-6)" }}
              >
                <div style={{ 
                  padding: "var(--space-6)", 
                  borderRadius: "var(--radius-xl)", 
                  background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)", 
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  textAlign: "center",
                }}>
                  <CheckCircle2 style={{ width: "48px", height: "48px", color: "#16a34a", margin: "0 auto var(--space-4)" }} />
                  <h3 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "#16a34a", margin: "0 0 var(--space-4) 0" }}>
                    Rezervasyon Oluşturuldu!
                  </h3>
                  <div style={{ 
                    display: "inline-block",
                    padding: "var(--space-4) var(--space-6)",
                    background: "white",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    marginBottom: "var(--space-4)",
                  }}>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "0 0 var(--space-1) 0" }}>QR Kodunuz</p>
                    <p style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-black)", color: "var(--text-primary)", margin: 0, fontFamily: "monospace" }}>
                      {createResult.qr_code}
                    </p>
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                    Bu kodu kaydedin ve depoda gösterin
                  </p>
                </div>
              </motion.div>
            )}
          </ModernCard>
        </motion.div>

        {/* RESERVATION LOOKUP SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="elevated" padding={isMobile ? "md" : "lg"} style={{ 
            border: "1px solid var(--border-primary)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}>
            <div style={{ 
              marginBottom: "var(--space-6)",
              paddingBottom: "var(--space-4)",
              borderBottom: "1px solid var(--border-secondary)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-xl)",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <FileText style={{ width: "24px", height: "24px", color: "white" }} />
                </div>
                <div>
                  <h2 style={{ 
                    fontSize: isMobile ? "var(--text-xl)" : "var(--text-2xl)", 
                    fontWeight: "var(--font-bold)", 
                    color: "var(--text-primary)", 
                    margin: 0 
                  }}>
                    Rezervasyon Kontrolü
                  </h2>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>
                    QR kodunuzla durumu kontrol edin
                  </p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleLookup} style={{ marginBottom: "var(--space-6)" }}>
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "var(--space-3)" }}>
                <div style={{ flex: 1 }}>
                  <ModernInput
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="QR kodu / doğrulama kodu"
                    leftIcon={<FileText className="h-4 w-4" />}
                    fullWidth
                  />
                </div>
                <ModernButton 
                  type="submit" 
                  variant="primary" 
                  disabled={loading} 
                  isLoading={loading} 
                  loadingText="Kontrol..."
                  style={{ width: isMobile ? "100%" : "auto" }}
                >
                  Sorgula
                </ModernButton>
              </div>
            </form>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div style={{ 
                  padding: "var(--space-4)", 
                  borderRadius: "var(--radius-xl)", 
                  background: result.valid ? "var(--bg-tertiary)" : "rgba(220, 38, 38, 0.05)", 
                  border: result.valid ? "1px solid var(--border-primary)" : "1px solid rgba(220, 38, 38, 0.2)" 
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", margin: 0 }}>
                      Rezervasyon Bilgisi
                    </h3>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      padding: "var(--space-1) var(--space-3)",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      background: statusColors[result.status]?.bg || "var(--bg-secondary)",
                      color: statusColors[result.status]?.color || "var(--text-secondary)",
                      border: `1px solid ${statusColors[result.status]?.border || "var(--border-primary)"}`,
                    }}>
                      {statusLabels[result.status] ?? result.status}
                    </span>
                  </div>
                  {result.valid ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                        <div style={{ padding: "var(--space-3)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "block", marginBottom: "var(--space-1)" }}>Depo</span>
                          <strong style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{result.locker_code ?? "-"}</strong>
                        </div>
                        <div style={{ padding: "var(--space-3)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "block", marginBottom: "var(--space-1)" }}>Lokasyon</span>
                          <strong style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{result.location_name ?? "-"}</strong>
                        </div>
                        <div style={{ padding: "var(--space-3)", background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "block", marginBottom: "var(--space-1)" }}>Bavul</span>
                          <strong style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
                            {result.baggage_count ?? "-"} {result.baggage_type ?? "adet"}
                          </strong>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                        {result.status === "active" && !result.handover_at && (
                          <ModernButton
                            variant="secondary"
                            onClick={() => setHandoverModalOpen(true)}
                            disabled={handoverLoading}
                            isLoading={handoverLoading}
                            style={{ flex: isMobile ? 1 : "none" }}
                          >
                            Depoya Teslim Ettim
                          </ModernButton>
                        )}
                        {result.status === "active" && result.handover_at && !result.returned_at && (
                          <ModernButton
                            variant="primary"
                            onClick={() => setReturnModalOpen(true)}
                            disabled={returnLoading}
                            isLoading={returnLoading}
                            style={{ flex: isMobile ? 1 : "none" }}
                          >
                            Emanetimi Teslim Aldım
                          </ModernButton>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "#dc2626" }}>
                      <AlertCircle style={{ width: "20px", height: "20px" }} />
                      <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
                        QR kodu geçersiz veya rezervasyon bulunamadı.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </ModernCard>
        </motion.div>
      </div>

      {/* KVKK Modal */}
      <ModernModal
        isOpen={showKvkkModal}
        onClose={() => setShowKvkkModal(false)}
        title="KVKK Aydınlatma Metni"
        size="lg"
      >
        {!kvkkScrolledToBottom && (
          <div style={{ 
            padding: "var(--space-3)", 
            background: "rgba(59, 130, 246, 0.1)", 
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "#2563eb",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)"
          }}>
            <Eye style={{ width: "16px", height: "16px" }} />
            Sözleşmeyi okumak için aşağı kaydırın
          </div>
        )}
        {kvkkScrolledToBottom && (
          <div style={{ 
            padding: "var(--space-3)", 
            background: "rgba(34, 197, 94, 0.1)", 
            border: "1px solid rgba(34, 197, 94, 0.2)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "#16a34a",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)"
          }}>
            <CheckCircle2 style={{ width: "16px", height: "16px" }} />
            Sözleşme okundu ve kabul edildi
          </div>
        )}
        <div 
          ref={kvkkScrollRef}
          onScroll={handleKvkkScroll}
          style={{ maxHeight: "50vh", overflowY: "auto", padding: "var(--space-4)", background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-4)" }}
        >
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>1. Veri Sorumlusu</strong><br />
            Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca veri sorumlusu sıfatıyla işlenmektedir.
          </p>
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>2. İşlenen Kişisel Veriler</strong><br />
            Rezervasyon sürecinde ad, soyad, telefon numarası, e-posta adresi gibi kişisel verileriniz işlenmektedir.
          </p>
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>3. İşleme Amaçları</strong><br />
            Kişisel verileriniz rezervasyon yönetimi, müşteri hizmetleri ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenmektedir.
          </p>
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>4. Veri Güvenliği</strong><br />
            Kişisel verileriniz, teknik ve idari güvenlik önlemleri alınarak korunmaktadır.
          </p>
          <p style={{ lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>5. Haklarınız</strong><br />
            KVKK'nın 11. maddesi uyarınca kişisel verileriniz hakkında bilgi talep etme, düzeltme ve silme haklarınız bulunmaktadır.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
          <ModernButton variant="ghost" onClick={() => setShowKvkkModal(false)}>
            Kapat
          </ModernButton>
          <ModernButton
            variant="primary"
            onClick={() => {
              setHasReadKvkk(true);
              setKvkkAccepted(true);
              setShowKvkkModal(false);
            }}
            disabled={!kvkkScrolledToBottom}
          >
            {kvkkScrolledToBottom ? "Kabul Et" : "Sonuna kadar okuyun"}
          </ModernButton>
        </div>
      </ModernModal>

      {/* Terms Modal */}
      <ModernModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Kullanım Şartları"
        size="lg"
      >
        {!termsScrolledToBottom && (
          <div style={{ 
            padding: "var(--space-3)", 
            background: "rgba(59, 130, 246, 0.1)", 
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "#2563eb",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)"
          }}>
            <Eye style={{ width: "16px", height: "16px" }} />
            Sözleşmeyi okumak için aşağı kaydırın
          </div>
        )}
        {termsScrolledToBottom && (
          <div style={{ 
            padding: "var(--space-3)", 
            background: "rgba(34, 197, 94, 0.1)", 
            border: "1px solid rgba(34, 197, 94, 0.2)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "#16a34a",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)"
          }}>
            <CheckCircle2 style={{ width: "16px", height: "16px" }} />
            Sözleşme okundu ve kabul edildi
          </div>
        )}
        <div 
          ref={termsScrollRef}
          onScroll={handleTermsScroll}
          style={{ maxHeight: "50vh", overflowY: "auto", padding: "var(--space-4)", background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-4)" }}
        >
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>1. Hizmet Kapsamı</strong><br />
            Bu platform, bavul depolama hizmetleri için rezervasyon yapmanıza olanak sağlar.
          </p>
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>2. Kullanıcı Yükümlülükleri</strong><br />
            Kullanıcılar, doğru ve güncel bilgi sağlamakla yükümlüdür.
          </p>
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>3. Ödeme ve İptal</strong><br />
            Rezervasyon ücretleri belirtilen fiyatlandırma kurallarına göre hesaplanır.
          </p>
          <p style={{ marginBottom: "var(--space-4)", lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>4. Sorumluluk Sınırlaması</strong><br />
            Platform, bavulların kaybolması veya hasar görmesi durumunda sınırlı sorumluluk taşır.
          </p>
          <p style={{ lineHeight: 1.7, color: "var(--text-primary)" }}>
            <strong>5. Gizlilik</strong><br />
            Kişisel verileriniz KVKK uyarınca korunmakta ve yalnızca belirtilen amaçlar doğrultusunda kullanılmaktadır.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
          <ModernButton variant="ghost" onClick={() => setShowTermsModal(false)}>
            Kapat
          </ModernButton>
          <ModernButton
            variant="primary"
            onClick={() => {
              setHasReadTerms(true);
              setTermsAccepted(true);
              setShowTermsModal(false);
            }}
            disabled={!termsScrolledToBottom}
          >
            {termsScrolledToBottom ? "Kabul Et" : "Sonuna kadar okuyun"}
          </ModernButton>
        </div>
      </ModernModal>

      {/* Handover Modal */}
      {handoverModalOpen && (
        <Modal
          isOpen
          title="Depoya Teslim Kaydı"
          onClose={handoverLoading ? () => undefined : () => setHandoverModalOpen(false)}
          disableClose={handoverLoading}
          width="520px"
        >
          <form onSubmit={handleSelfHandover} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <ModernInput
              label="Teslim Eden"
              value={handoverForm.handover_by}
              onChange={(e) => setHandoverForm((prev) => ({ ...prev, handover_by: e.target.value }))}
              placeholder="self-service"
              fullWidth
            />
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                Not
              </label>
              <textarea
                value={handoverForm.notes}
                onChange={(e) => setHandoverForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Teslim sırasında notlar"
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
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-secondary)" }}>
              <ModernButton type="button" variant="ghost" onClick={() => setHandoverModalOpen(false)} disabled={handoverLoading}>
                Vazgeç
              </ModernButton>
              <ModernButton type="submit" variant="primary" disabled={handoverLoading} isLoading={handoverLoading} loadingText="Kaydediliyor...">
                Teslimi Kaydet
              </ModernButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Modal */}
      {returnModalOpen && (
        <Modal
          isOpen
          title="Teslim Alma Kaydı"
          onClose={returnLoading ? () => undefined : () => setReturnModalOpen(false)}
          disableClose={returnLoading}
          width="520px"
        >
          <form onSubmit={handleSelfReturn} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <ModernInput
              label="Teslim Alan"
              value={returnForm.returned_by}
              onChange={(e) => setReturnForm((prev) => ({ ...prev, returned_by: e.target.value }))}
              placeholder="Misafir adı"
              fullWidth
            />
            <div>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                Not
              </label>
              <textarea
                value={returnForm.notes}
                onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="İade sırasında notlar"
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
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-secondary)" }}>
              <ModernButton type="button" variant="ghost" onClick={() => setReturnModalOpen(false)} disabled={returnLoading}>
                Vazgeç
              </ModernButton>
              <ModernButton type="submit" variant="primary" disabled={returnLoading} isLoading={returnLoading} loadingText="Kaydediliyor...">
                İadeyi Kaydet
              </ModernButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
