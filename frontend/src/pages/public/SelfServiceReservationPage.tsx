import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User, Package, MapPin, DollarSign, FileText, CheckCircle2, Loader2, Eye, Briefcase, ChevronRight, Phone, Mail, Calendar, CreditCard
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
import { ContractViewerModal } from "../../components/common/ContractViewerModal";
import { getErrorMessage } from "../../lib/httpError";
import { DateTimeField } from "../../components/ui/DateField";

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

function useWindowSize() {
  const [size, setSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1200, height: typeof window !== 'undefined' ? window.innerHeight : 800 });
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
    customer_email: "",
    id_type: "",
    room_number: "",
    baggage_count: 1,
    baggage_type: "",
    weight_kg: undefined,
    notes: "",
  });
  const [createResult, setCreateResult] = useState<SelfServiceReservationCreateResponse | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [handoverForm, setHandoverForm] = useState({ handover_by: "self-service", notes: "", evidence_url: "" });
  const [returnForm, setReturnForm] = useState({ returned_by: "guest", notes: "", evidence_url: "" });
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimateResponse | null>(null);
  
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasReadKvkk, setHasReadKvkk] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);

  const { messages, push } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("tenant") || params.get("slug") || "";
    const locker = params.get("locker") || params.get("code") || "";
    if (slug || locker) {
      setCreateForm((prev) => ({ ...prev, tenant_slug: slug, locker_code: locker }));
    }
  }, []);

  const calculatePrice = useCallback(async () => {
    if (!createForm.start_at || !createForm.end_at || !createForm.tenant_slug) return;
    try {
      const estimate = await pricingService.estimatePrice({
        tenant_slug: createForm.tenant_slug,
        start_datetime: createForm.start_at,
        end_datetime: createForm.end_at,
        baggage_count: createForm.baggage_count || 1,
      });
      setPriceEstimate(estimate);
    } catch {
      setPriceEstimate(null);
    }
  }, [createForm.start_at, createForm.end_at, createForm.tenant_slug, createForm.baggage_count]);

  useEffect(() => {
    const timer = setTimeout(() => calculatePrice(), 500);
    return () => clearTimeout(timer);
  }, [calculatePrice]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const data = await selfServiceReservationService.lookup({ code });
      setResult(data);
    } catch (err) {
      push({ title: "Bulunamadı", description: getErrorMessage(err), type: "error" });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kvkkAccepted || !termsAccepted) {
      push({ title: "Sözleşmeleri onaylayın", description: "Devam etmek için KVKK ve kullanım şartlarını kabul etmelisiniz.", type: "error" });
      return;
    }
    if (!createForm.tenant_slug || !createForm.locker_code || !createForm.start_at || !createForm.end_at) {
      push({ title: "Eksik Bilgi", description: "Lütfen tüm zorunlu alanları doldurun.", type: "error" });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await selfServiceReservationService.create(createForm);
      setCreateResult(res);
      push({ title: "Rezervasyon Oluşturuldu", description: `Kod: ${res.confirmation_code}`, type: "success" });
    } catch (err) {
      push({ title: "Hata", description: getErrorMessage(err), type: "error" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleHandover = async () => {
    if (!result) return;
    setHandoverLoading(true);
    try {
      const payload: SelfServiceHandoverPayload = handoverForm;
      const updated = await selfServiceReservationService.handover(result.confirmation_code || "", payload);
      setResult(updated);
      setHandoverModalOpen(false);
      push({ title: "Teslim Alındı", type: "success" });
    } catch (err) {
      push({ title: "Hata", description: getErrorMessage(err), type: "error" });
    } finally {
      setHandoverLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!result) return;
    setReturnLoading(true);
    try {
      const payload: SelfServiceReturnPayload = returnForm;
      const updated = await selfServiceReservationService.confirmReturn(result.confirmation_code || "", payload);
      setResult(updated);
      setReturnModalOpen(false);
      push({ title: "Teslim Edildi", type: "success" });
    } catch (err) {
      push({ title: "Hata", description: getErrorMessage(err), type: "error" });
    } finally {
      setReturnLoading(false);
    }
  };

  const formatPrice = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;

  // Success Screen
  if (createResult) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: "white",
            borderRadius: "24px",
            padding: isMobile ? "40px 24px" : "56px 48px",
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 25px 80px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
            boxShadow: "0 8px 32px rgba(16, 185, 129, 0.4)",
          }}>
            <CheckCircle2 style={{ width: "44px", height: "44px", color: "white" }} />
          </div>
          
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#064e3b", margin: "0 0 8px" }}>
            Rezervasyon Başarılı!
          </h1>
          <p style={{ color: "#6ee7b7", fontSize: "15px", marginBottom: "36px" }}>
            Bavulunuz güvende
          </p>
          
          <div style={{
            background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
            borderRadius: "20px",
            padding: "28px",
            marginBottom: "28px",
            border: "2px solid #a7f3d0",
          }}>
            <p style={{ fontSize: "11px", color: "#047857", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 600 }}>
              Onay Kodu
            </p>
            <p style={{ 
              fontSize: "36px", 
              fontWeight: 800, 
              color: "#064e3b", 
              margin: 0,
              fontFamily: "'SF Mono', 'Roboto Mono', monospace",
              letterSpacing: "6px",
            }}>
              {createResult.confirmation_code}
            </p>
          </div>
          
          {createResult.price_total_minor && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "18px 24px",
              background: "#f8fafc",
              borderRadius: "14px",
              marginBottom: "28px",
            }}>
              <span style={{ color: "#64748b", fontSize: "14px", fontWeight: 500 }}>Toplam Tutar</span>
              <span style={{ fontWeight: 800, fontSize: "22px", color: "#0f172a" }}>
                {formatPrice(createResult.price_total_minor)}
              </span>
            </div>
          )}
          
          <button
            onClick={() => {
              setCreateResult(null);
              setCreateForm({
                tenant_slug: createForm.tenant_slug,
                locker_code: "",
                start_at: "",
                end_at: "",
                customer_name: "",
                customer_phone: "",
                customer_email: "",
                id_type: "",
                room_number: "",
                baggage_count: 1,
                baggage_type: "",
                weight_kg: undefined,
                notes: "",
              });
              setKvkkAccepted(false);
              setTermsAccepted(false);
              setHasReadKvkk(false);
              setHasReadTerms(false);
            }}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.4)",
            }}
          >
            Yeni Rezervasyon
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
      padding: isMobile ? "0" : "40px 20px",
    }}>
      <ToastContainer messages={messages} />
      
      <div style={{
        maxWidth: "1100px",
        margin: "0 auto",
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            textAlign: "center",
            padding: isMobile ? "40px 20px 30px" : "20px 20px 40px",
          }}
        >
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "72px",
            height: "72px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            marginBottom: "20px",
            boxShadow: "0 8px 32px rgba(59, 130, 246, 0.4)",
          }}>
            <Briefcase style={{ width: "36px", height: "36px", color: "white" }} />
          </div>
          <h1 style={{ 
            fontSize: isMobile ? "28px" : "36px", 
            fontWeight: 800, 
            color: "white", 
            margin: "0 0 8px",
            letterSpacing: "-0.5px",
          }}>
            Bavul Emanet
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "16px", margin: 0 }}>
            Hızlı ve güvenli rezervasyon
          </p>
        </motion.div>

        {/* Main Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "white",
            borderRadius: isMobile ? "24px 24px 0 0" : "24px",
            boxShadow: "0 -10px 60px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          <form onSubmit={handleCreateReservation}>
            {/* Row 1: Personal Info */}
            <div style={{ 
              padding: isMobile ? "28px 20px 24px" : "36px 40px 28px",
              borderBottom: "1px solid #f1f5f9",
            }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                marginBottom: "24px" 
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}>
                  <User style={{ width: "20px", height: "20px", color: "white" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Kişisel Bilgiler
                  </h2>
                  <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>İletişim bilgileriniz</p>
                </div>
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(4, 1fr)",
                gap: "16px",
              }}>
                <InputField
                  label="Ad Soyad"
                  required
                  icon={<User style={{ width: "18px", height: "18px", color: "#94a3b8" }} />}
                  value={createForm.customer_name || ""}
                  onChange={(v) => setCreateForm(p => ({ ...p, customer_name: v }))}
                  placeholder="Adınız Soyadınız"
                />
                <SelectField
                  label="Kimlik Türü"
                  required
                  icon={<CreditCard style={{ width: "18px", height: "18px", color: "#94a3b8" }} />}
                  value={createForm.id_type || ""}
                  onChange={(v) => setCreateForm(p => ({ ...p, id_type: v }))}
                  options={[
                    { value: "", label: "Seçiniz" },
                    { value: "tc", label: "TC Kimlik" },
                    { value: "passport", label: "Pasaport" },
                    { value: "other", label: "Diğer" },
                  ]}
                />
                <InputField
                  label="Telefon"
                  required
                  type="tel"
                  icon={<Phone style={{ width: "18px", height: "18px", color: "#94a3b8" }} />}
                  value={createForm.customer_phone || ""}
                  onChange={(v) => setCreateForm(p => ({ ...p, customer_phone: v }))}
                  placeholder="+90 5XX XXX XX XX"
                />
                <InputField
                  label="E-posta"
                  required
                  type="email"
                  icon={<Mail style={{ width: "18px", height: "18px", color: "#94a3b8" }} />}
                  value={createForm.customer_email || ""}
                  onChange={(v) => setCreateForm(p => ({ ...p, customer_email: v }))}
                  placeholder="ornek@email.com"
                />
              </div>
            </div>

            {/* Row 2: Stay & Baggage */}
            <div style={{ 
              padding: isMobile ? "24px 20px" : "28px 40px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafbfc",
            }}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: isMobile ? "28px" : "48px",
              }}>
                {/* Dates Section */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Calendar style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Tarih & Konaklama</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                    <DateTimeField
                      label="Bırakış"
                      required
                      value={createForm.start_at}
                      onChange={(v) => setCreateForm(p => ({ ...p, start_at: v || "" }))}
                      fullWidth
                    />
                    <DateTimeField
                      label="Alış"
                      required
                      value={createForm.end_at}
                      onChange={(v) => setCreateForm(p => ({ ...p, end_at: v || "" }))}
                      fullWidth
                    />
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <InputField
                      label="Oda No (Opsiyonel)"
                      icon={<MapPin style={{ width: "18px", height: "18px", color: "#94a3b8" }} />}
                      value={createForm.room_number || ""}
                      onChange={(v) => setCreateForm(p => ({ ...p, room_number: v }))}
                      placeholder="Oda numaranız"
                    />
                  </div>
                </div>

                {/* Baggage Section */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Package style={{ width: "18px", height: "18px", color: "white" }} />
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Bavul Bilgileri</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <SelectField
                      label="Adet"
                      required
                      value={String(createForm.baggage_count)}
                      onChange={(v) => setCreateForm(p => ({ ...p, baggage_count: parseInt(v) || 1 }))}
                      options={[1,2,3,4,5,6,7,8,9,10].map(n => ({ value: String(n), label: `${n} Adet` }))}
                    />
                    <SelectField
                      label="Tür"
                      value={createForm.baggage_type || ""}
                      onChange={(v) => setCreateForm(p => ({ ...p, baggage_type: v }))}
                      options={[
                        { value: "", label: "Seçiniz" },
                        { value: "cabin", label: "Kabin" },
                        { value: "medium", label: "Orta" },
                        { value: "large", label: "Büyük" },
                      ]}
                    />
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <InputField
                      label="Not (Opsiyonel)"
                      value={createForm.notes || ""}
                      onChange={(v) => setCreateForm(p => ({ ...p, notes: v }))}
                      placeholder="Özel notunuz"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Price & Agreements */}
            <div style={{ padding: isMobile ? "24px 20px 32px" : "28px 40px 36px" }}>
              {/* Price */}
              {priceEstimate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "18px 24px",
                    background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                    borderRadius: "16px",
                    marginBottom: "24px",
                    border: "2px solid #a7f3d0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <DollarSign style={{ width: "24px", height: "24px", color: "#059669" }} />
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "#047857" }}>Tahmini Ücret</span>
                  </div>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "#064e3b" }}>
                    {formatPrice(priceEstimate.total_minor)}
                  </span>
                </motion.div>
              )}

              {/* Agreements */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "12px",
                marginBottom: "24px",
              }}>
                <AgreementBox
                  label="KVKK Aydınlatma Metni"
                  accepted={kvkkAccepted}
                  hasRead={hasReadKvkk}
                  onClick={() => setShowKvkkModal(true)}
                />
                <AgreementBox
                  label="Kullanım Şartları"
                  accepted={termsAccepted}
                  hasRead={hasReadTerms}
                  onClick={() => setShowTermsModal(true)}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={createLoading || !kvkkAccepted || !termsAccepted}
                style={{
                  width: "100%",
                  padding: "18px",
                  borderRadius: "16px",
                  border: "none",
                  background: (!kvkkAccepted || !termsAccepted) 
                    ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)" 
                    : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  color: "white",
                  fontSize: "17px",
                  fontWeight: 700,
                  cursor: (!kvkkAccepted || !termsAccepted) ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow: (!kvkkAccepted || !termsAccepted) ? "none" : "0 8px 24px rgba(59, 130, 246, 0.4)",
                  transition: "all 0.3s",
                }}
              >
                {createLoading ? (
                  <Loader2 style={{ width: "22px", height: "22px", animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    <span>Rezervasyonu Tamamla</span>
                    <ChevronRight style={{ width: "20px", height: "20px" }} />
                  </>
                )}
              </button>
              
              {(!kvkkAccepted || !termsAccepted) && (
                <p style={{ textAlign: "center", fontSize: "13px", color: "#f43f5e", marginTop: "14px", fontWeight: 500 }}>
                  Sözleşmeleri okuyup onaylayın
                </p>
              )}
            </div>
          </form>

          {/* Lookup Section */}
          <div style={{
            padding: isMobile ? "24px 20px 32px" : "28px 40px 36px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <FileText style={{ width: "20px", height: "20px", color: "white" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Rezervasyon Sorgula
                </h3>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Mevcut rezervasyonunuzu bulun</p>
              </div>
            </div>
            
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Onay kodunuzu girin"
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  borderRadius: "12px",
                  border: "2px solid #e2e8f0",
                  background: "white",
                  fontSize: "15px",
                  color: "#0f172a",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "14px 28px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? <Loader2 style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite" }} /> : "Sorgula"}
              </button>
            </form>
            
            {/* Search Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: "24px",
                  padding: "24px",
                  background: "white",
                  borderRadius: "16px",
                  border: "2px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Rezervasyon</h4>
                  <span style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: statusColors[result.status]?.bg,
                    color: statusColors[result.status]?.color,
                  }}>
                    {statusLabels[result.status]}
                  </span>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                  {result.confirmation_code && (
                    <InfoBox label="Onay Kodu" value={result.confirmation_code} mono />
                  )}
                  {result.customer_name && (
                    <InfoBox label="Müşteri" value={result.customer_name} />
                  )}
                  {result.start_at && (
                    <InfoBox label="Bırakış" value={new Date(result.start_at).toLocaleString("tr-TR")} />
                  )}
                  {result.end_at && (
                    <InfoBox label="Alış" value={new Date(result.end_at).toLocaleString("tr-TR")} />
                  )}
                </div>
                
                {result.status === "active" && (
                  <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                    {!result.handover_at && (
                      <button onClick={() => setHandoverModalOpen(true)} style={actionBtnStyle("#10b981")}>
                        Teslim Al
                      </button>
                    )}
                    {result.handover_at && !result.returned_at && (
                      <button onClick={() => setReturnModalOpen(true)} style={actionBtnStyle("#3b82f6")}>
                        Teslim Et
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <ContractViewerModal
        isOpen={showKvkkModal}
        onClose={() => setShowKvkkModal(false)}
        onAccept={() => { setKvkkAccepted(true); setHasReadKvkk(true); }}
        title="KVKK Aydınlatma Metni"
        content={kvkkContent}
        requireScroll={true}
        showAcceptButton={true}
      />

      <ContractViewerModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => { setTermsAccepted(true); setHasReadTerms(true); }}
        title="Kullanım Şartları"
        content={termsContent}
        requireScroll={true}
        showAcceptButton={true}
      />

      <Modal isOpen={handoverModalOpen} onClose={() => setHandoverModalOpen(false)} title="Teslim Al" width="480px">
        <ModalForm
          fields={[
            { label: "Teslim Alan", value: handoverForm.handover_by, onChange: (v: string) => setHandoverForm(p => ({ ...p, handover_by: v })) },
            { label: "Not", value: handoverForm.notes, onChange: (v: string) => setHandoverForm(p => ({ ...p, notes: v })), multiline: true },
          ]}
          onSubmit={handleHandover}
          loading={handoverLoading}
          submitLabel="Teslim Al"
          color="#10b981"
        />
      </Modal>

      <Modal isOpen={returnModalOpen} onClose={() => setReturnModalOpen(false)} title="Teslim Et" width="480px">
        <ModalForm
          fields={[
            { label: "Teslim Eden", value: returnForm.returned_by, onChange: (v: string) => setReturnForm(p => ({ ...p, returned_by: v })) },
            { label: "Not", value: returnForm.notes, onChange: (v: string) => setReturnForm(p => ({ ...p, notes: v })), multiline: true },
          ]}
          onSubmit={handleReturn}
          loading={returnLoading}
          submitLabel="Teslim Et"
          color="#3b82f6"
        />
      </Modal>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus, select:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important; }
      `}</style>
    </div>
  );
}

// Components
function InputField({ label, required, type = "text", icon, value, onChange, placeholder }: {
  label: string; required?: boolean; type?: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
        {label} {required && <span style={{ color: "#f43f5e" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        {icon && <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}>{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{
            width: "100%",
            padding: icon ? "12px 14px 12px 44px" : "12px 14px",
            borderRadius: "12px",
            border: "2px solid #e2e8f0",
            background: "white",
            fontSize: "14px",
            color: "#0f172a",
            outline: "none",
            transition: "all 0.2s",
          }}
        />
      </div>
    </div>
  );
}

function SelectField({ label, required, icon, value, onChange, options }: {
  label: string; required?: boolean; icon?: React.ReactNode; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
        {label} {required && <span style={{ color: "#f43f5e" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        {icon && <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>{icon}</div>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          style={{
            width: "100%",
            padding: icon ? "12px 14px 12px 44px" : "12px 14px",
            borderRadius: "12px",
            border: "2px solid #e2e8f0",
            background: "white",
            fontSize: "14px",
            color: "#0f172a",
            outline: "none",
            appearance: "none",
            cursor: "pointer",
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: "right 12px center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "20px",
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function AgreementBox({ label, accepted, hasRead, onClick }: { label: string; accepted: boolean; hasRead: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "16px 18px",
        background: accepted ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" : "white",
        borderRadius: "14px",
        border: accepted ? "2px solid #22c55e" : "2px solid #e2e8f0",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{
        width: "24px",
        height: "24px",
        borderRadius: "8px",
        border: accepted ? "none" : "2px solid #cbd5e1",
        background: accepted ? "#22c55e" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {accepted && <CheckCircle2 style={{ width: "16px", height: "16px", color: "white" }} />}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{label}</span>
        {!hasRead && <span style={{ display: "block", fontSize: "12px", color: "#64748b" }}>Okumak için tıklayın</span>}
      </div>
      <Eye style={{ width: "18px", height: "18px", color: "#94a3b8" }} />
    </div>
  );
}

function InfoBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: "12px" }}>
      <span style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

function ModalForm({ fields, onSubmit, loading, submitLabel, color }: {
  fields: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }[];
  onSubmit: () => void; loading: boolean; submitLabel: string; color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {fields.map((f, i) => (
        <div key={i}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>{f.label}</label>
          {f.multiline ? (
            <textarea
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "14px", resize: "vertical" }}
            />
          ) : (
            <input
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "14px" }}
            />
          )}
        </div>
      ))}
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          padding: "14px",
          borderRadius: "12px",
          border: "none",
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          color: "white",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {loading ? <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} /> : submitLabel}
      </button>
    </div>
  );
}

const actionBtnStyle = (color: string): React.CSSProperties => ({
  flex: 1,
  padding: "14px",
  borderRadius: "12px",
  border: "none",
  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
  color: "white",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
});

const kvkkContent = `
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">1. VERİ SORUMLUSU</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla işlenmektedir.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">2. İŞLENEN VERİLER</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Ad, soyad, telefon, e-posta gibi kişisel verileriniz işlenmektedir.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">3. İŞLEME AMAÇLARI</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Verileriniz rezervasyon yönetimi ve müşteri hizmetleri amaçlarıyla işlenmektedir.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">4. GÜVENLİK</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Verileriniz teknik ve idari önlemlerle korunmaktadır.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">5. HAKLARINIZ</h4>
<p style="margin:0;font-size:14px;line-height:1.6;color:#475569">Bilgi talep etme, düzeltme, silme ve itiraz etme haklarınız bulunmaktadır.</p>
<div style="text-align:center;padding:16px;margin-top:16px;border-top:1px dashed #e2e8f0;color:#16a34a;font-weight:600">✓ Sözleşmenin sonuna ulaştınız</div>
`;

const termsContent = `
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">1. HİZMET KAPSAMI</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Bu platform bavul depolama hizmetleri için rezervasyon yapmanıza olanak sağlar.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">2. YÜKÜMLÜLÜKLER</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Kullanıcılar doğru bilgi sağlamakla yükümlüdür.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">3. ÖDEME</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Ücretler belirtilen kurallara göre hesaplanır.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">4. SORUMLULUK</h4>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">Platform sınırlı sorumluluk taşır.</p>
<h4 style="margin:0 0 12px;font-size:15px;font-weight:600">5. GİZLİLİK</h4>
<p style="margin:0;font-size:14px;line-height:1.6;color:#475569">Verileriniz KVKK uyarınca korunmaktadır.</p>
<div style="text-align:center;padding:16px;margin-top:16px;border-top:1px dashed #e2e8f0;color:#16a34a;font-weight:600">✓ Sözleşmenin sonuna ulaştınız</div>
`;
