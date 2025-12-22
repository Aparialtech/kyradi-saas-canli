import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  User, Package, MapPin, DollarSign, FileText, CheckCircle2, Loader2, Eye, Briefcase, ChevronRight
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
  const isTablet = width >= 768 && width < 1200;
  
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
  
  // Contract/Agreement states
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasReadKvkk, setHasReadKvkk] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const kvkkScrollRef = useRef<HTMLDivElement>(null);
  const termsScrollRef = useRef<HTMLDivElement>(null);

  const { messages, push } = useToast();

  // Get URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("tenant") || params.get("slug") || "";
    const locker = params.get("locker") || params.get("code") || "";
    if (slug || locker) {
      setCreateForm((prev) => ({ ...prev, tenant_slug: slug, locker_code: locker }));
    }
  }, []);

  // Calculate price estimate when dates change
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
    const debounceTimer = setTimeout(() => {
      calculatePrice();
    }, 500);
    return () => clearTimeout(debounceTimer);
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

  const handleKvkkScroll = useCallback(() => {
    const el = kvkkScrollRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    if (atBottom && !hasReadKvkk) {
      setHasReadKvkk(true);
      setKvkkAccepted(true);
    }
  }, [hasReadKvkk]);

  const handleTermsScroll = useCallback(() => {
    const el = termsScrollRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    if (atBottom && !hasReadTerms) {
      setHasReadTerms(true);
      setTermsAccepted(true);
    }
  }, [hasReadTerms]);

  const formatPrice = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;

  // Input styles
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: "14px",
    color: "#1e293b",
    outline: "none",
    transition: "all 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#475569",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: "right 12px center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "16px",
    paddingRight: "40px",
  };

  // Success view
  if (createResult) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
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
            padding: isMobile ? "32px 24px" : "48px",
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}>
            <CheckCircle2 style={{ width: "40px", height: "40px", color: "white" }} />
          </div>
          
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#166534", margin: "0 0 8px" }}>
            Rezervasyon Başarılı!
          </h1>
          <p style={{ color: "#4ade80", fontSize: "14px", marginBottom: "32px" }}>
            Rezervasyonunuz oluşturuldu
          </p>
          
          <div style={{
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
          }}>
            <p style={{ fontSize: "12px", color: "#166534", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              Onay Kodunuz
            </p>
            <p style={{ 
              fontSize: "32px", 
              fontWeight: 800, 
              color: "#166534", 
              margin: 0,
              fontFamily: "monospace",
              letterSpacing: "4px",
            }}>
              {createResult.confirmation_code}
            </p>
          </div>
          
          {createResult.price_total_minor && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              background: "#f8fafc",
              borderRadius: "12px",
              marginBottom: "24px",
            }}>
              <span style={{ color: "#64748b", fontSize: "14px" }}>Toplam Tutar</span>
              <span style={{ fontWeight: 700, fontSize: "20px", color: "#0f172a" }}>
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
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "white",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Yeni Rezervasyon Oluştur
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    }}>
      <ToastContainer messages={messages} />
      
      {/* Hero Header */}
      <div style={{
        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        padding: isMobile ? "40px 20px 60px" : "60px 40px 80px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decoration */}
        <div style={{
          position: "absolute",
          top: "-50%",
          left: "-10%",
          width: "50%",
          height: "200%",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "50%",
          transform: "rotate(-15deg)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-60%",
          right: "-10%",
          width: "40%",
          height: "200%",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "50%",
        }} />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ position: "relative", zIndex: 1 }}
        >
          <div style={{
            width: isMobile ? "60px" : "70px",
            height: isMobile ? "60px" : "70px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Briefcase style={{ width: isMobile ? "28px" : "32px", height: isMobile ? "28px" : "32px", color: "white" }} />
          </div>
          <h1 style={{ 
            fontSize: isMobile ? "28px" : "36px", 
            fontWeight: 800, 
            color: "white", 
            margin: "0 0 8px",
            textShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}>
            Rezervasyon Formu
          </h1>
          <p style={{ 
            color: "rgba(255,255,255,0.9)", 
            fontSize: isMobile ? "14px" : "16px",
            maxWidth: "400px",
            margin: "0 auto",
          }}>
            Bavulunuzu güvenle bırakın
          </p>
        </motion.div>
      </div>

      {/* Main Form */}
      <div style={{
        maxWidth: "900px",
        margin: "-40px auto 0",
        padding: isMobile ? "0 16px 40px" : "0 24px 60px",
        position: "relative",
        zIndex: 2,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "white",
            borderRadius: "20px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <form onSubmit={handleCreateReservation}>
            {/* Section: Personal Info */}
            <div style={{ padding: isMobile ? "24px 20px" : "32px 40px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                marginBottom: "20px" 
              }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <User style={{ width: "18px", height: "18px", color: "white" }} />
                </div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Kişisel Bilgiler
                </h2>
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
                gap: "16px",
              }}>
                <div>
                  <label style={labelStyle}>Ad Soyad <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="text"
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Ad Soyad"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Kimlik Türü <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    value={createForm.id_type}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, id_type: e.target.value }))}
                    style={selectStyle}
                    required
                  >
                    <option value="">Seçiniz</option>
                    <option value="tc">TC Kimlik</option>
                    <option value="passport">Pasaport</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Telefon Numarası <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="tel"
                    value={createForm.customer_phone}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="Telefon Numarası"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>E-posta <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="email"
                    value={createForm.customer_email || ""}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_email: e.target.value }))}
                    placeholder="E-posta"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section: Stay Info */}
            <div style={{ padding: isMobile ? "24px 20px" : "32px 40px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                marginBottom: "20px" 
              }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <MapPin style={{ width: "18px", height: "18px", color: "white" }} />
                </div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Konaklama Bilgileri
                </h2>
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr",
                gap: "16px",
              }}>
                <div>
                  <label style={labelStyle}>Oda Numarası</label>
                  <input
                    type="text"
                    value={createForm.room_number || ""}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, room_number: e.target.value }))}
                    placeholder="Oda Numarası (Opsiyonel)"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Giriş Tarih ve Saati <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="datetime-local"
                    value={createForm.start_at}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, start_at: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Çıkış Tarih ve Saati <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="datetime-local"
                    value={createForm.end_at}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, end_at: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section: Baggage Info */}
            <div style={{ padding: isMobile ? "24px 20px" : "32px 40px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                marginBottom: "20px" 
              }}>
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
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Bavul Bilgileri
                </h2>
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
                gap: "16px",
              }}>
                <div>
                  <label style={labelStyle}>Bavul Sayısı <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    value={createForm.baggage_count}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, baggage_count: parseInt(e.target.value) }))}
                    style={selectStyle}
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n} Adet</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Bavul Türü</label>
                  <select
                    value={createForm.baggage_type}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, baggage_type: e.target.value }))}
                    style={selectStyle}
                  >
                    <option value="">Seçiniz</option>
                    <option value="cabin">Kabin</option>
                    <option value="medium">Orta</option>
                    <option value="large">Büyük</option>
                    <option value="backpack">Sırt Çantası</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tahmini Ağırlık</label>
                  <input
                    type="number"
                    value={createForm.weight_kg || ""}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="kg"
                    style={inputStyle}
                    min="0"
                    step="0.5"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Notlar</label>
                  <input
                    type="text"
                    value={createForm.notes}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Özel notlar"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Hidden fields for tenant & locker */}
            <input type="hidden" value={createForm.tenant_slug} />
            <input type="hidden" value={createForm.locker_code} />

            {/* Price Estimate & Agreements */}
            <div style={{ padding: isMobile ? "24px 20px" : "32px 40px", background: "#f8fafc" }}>
              {/* Price Estimate */}
              {priceEstimate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                    borderRadius: "12px",
                    marginBottom: "20px",
                    border: "1px solid #a7f3d0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <DollarSign style={{ width: "20px", height: "20px", color: "#16a34a" }} />
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "#166534" }}>Tahmini Ücret</span>
                  </div>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "#166534" }}>
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
                {/* KVKK */}
                <div 
                  onClick={() => setShowKvkkModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    background: kvkkAccepted ? "#f0fdf4" : "white",
                    borderRadius: "12px",
                    border: kvkkAccepted ? "2px solid #22c55e" : "1.5px solid #e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "6px",
                    border: kvkkAccepted ? "none" : "2px solid #cbd5e1",
                    background: kvkkAccepted ? "#22c55e" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {kvkkAccepted && <CheckCircle2 style={{ width: "14px", height: "14px", color: "white" }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      KVKK Aydınlatma Metni
                    </span>
                    {!hasReadKvkk && (
                      <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                        Okumak için tıklayın
                      </span>
                    )}
                  </div>
                  <Eye style={{ width: "16px", height: "16px", color: "#94a3b8" }} />
                </div>

                {/* Terms */}
                <div 
                  onClick={() => setShowTermsModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    background: termsAccepted ? "#f0fdf4" : "white",
                    borderRadius: "12px",
                    border: termsAccepted ? "2px solid #22c55e" : "1.5px solid #e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "6px",
                    border: termsAccepted ? "none" : "2px solid #cbd5e1",
                    background: termsAccepted ? "#22c55e" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {termsAccepted && <CheckCircle2 style={{ width: "14px", height: "14px", color: "white" }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      Kullanım Şartları
                    </span>
                    {!hasReadTerms && (
                      <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                        Okumak için tıklayın
                      </span>
                    )}
                  </div>
                  <Eye style={{ width: "16px", height: "16px", color: "#94a3b8" }} />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={createLoading || !kvkkAccepted || !termsAccepted}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "none",
                  background: (!kvkkAccepted || !termsAccepted) 
                    ? "#94a3b8" 
                    : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: (!kvkkAccepted || !termsAccepted) ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: (!kvkkAccepted || !termsAccepted) ? "none" : "0 4px 14px rgba(59, 130, 246, 0.3)",
                  transition: "all 0.2s",
                }}
              >
                {createLoading ? (
                  <Loader2 style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    <span>Rezervasyonu Tamamla</span>
                    <ChevronRight style={{ width: "18px", height: "18px" }} />
                  </>
                )}
              </button>
              
              {(!kvkkAccepted || !termsAccepted) && (
                <p style={{ 
                  textAlign: "center", 
                  fontSize: "12px", 
                  color: "#ef4444", 
                  marginTop: "12px" 
                }}>
                  Devam etmek için sözleşmeleri okumalı ve onaylamalısınız
                </p>
              )}
            </div>
          </form>
        </motion.div>

        {/* Lookup Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: "white",
            borderRadius: "16px",
            padding: isMobile ? "24px 20px" : "28px 32px",
            marginTop: "20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <FileText style={{ width: "18px", height: "18px", color: "white" }} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Mevcut Rezervasyonu Sorgula
            </h3>
          </div>
          
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Onay kodunuzu girin"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? (
                <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
              ) : (
                "Sorgula"
              )}
            </button>
          </form>
        </motion.div>

        {/* Search Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: isMobile ? "24px 20px" : "28px 32px",
              marginTop: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                Rezervasyon Detayı
              </h3>
              <span style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                background: statusColors[result.status]?.bg,
                color: statusColors[result.status]?.color,
                border: `1px solid ${statusColors[result.status]?.border}`,
              }}>
                {statusLabels[result.status]}
              </span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Onay Kodu</span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", fontFamily: "monospace" }}>{result.confirmation_code}</span>
              </div>
              {result.customer_name && (
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Müşteri</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>{result.customer_name}</span>
                </div>
              )}
              {result.start_at && (
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Giriş</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>
                    {new Date(result.start_at).toLocaleString("tr-TR")}
                  </span>
                </div>
              )}
              {result.end_at && (
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Çıkış</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>
                    {new Date(result.end_at).toLocaleString("tr-TR")}
                  </span>
                </div>
              )}
            </div>
            
            {result.status === "active" && (
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
                {!result.handover_at && (
                  <button
                    onClick={() => setHandoverModalOpen(true)}
                    style={{
                      flex: 1,
                      minWidth: "140px",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Teslim Al
                  </button>
                )}
                {result.handover_at && !result.returned_at && (
                  <button
                    onClick={() => setReturnModalOpen(true)}
                    style={{
                      flex: 1,
                      minWidth: "140px",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Teslim Et
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* KVKK Modal */}
      <Modal isOpen={showKvkkModal} onClose={() => setShowKvkkModal(false)} title="KVKK Aydınlatma Metni" width="600px">
        <div 
          ref={kvkkScrollRef}
          onScroll={handleKvkkScroll}
          style={{ 
            maxHeight: "400px", 
            overflowY: "auto", 
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "12px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>1. VERİ SORUMLUSU</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca veri sorumlusu sıfatıyla Kyradi tarafından işlenmektedir.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>2. İŞLENEN KİŞİSEL VERİLER</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Rezervasyon sürecinde ad, soyad, telefon numarası, e-posta adresi gibi kişisel verileriniz işlenmektedir.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>3. İŞLEME AMAÇLARI</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Kişisel verileriniz rezervasyon yönetimi, müşteri hizmetleri, yasal yükümlülüklerin yerine getirilmesi ve hizmet kalitesinin artırılması amaçlarıyla işlenmektedir.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>4. VERİ GÜVENLİĞİ</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Kişisel verileriniz, teknik ve idari güvenlik önlemleri alınarak korunmaktadır.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>5. HAKLARINIZ</h4>
          <p style={{ margin: "0", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            KVKK'nın 11. maddesi uyarınca kişisel verileriniz hakkında bilgi talep etme, düzeltme, silme ve itiraz etme haklarınız bulunmaktadır.
          </p>
          <div style={{ 
            textAlign: "center", 
            padding: "16px", 
            marginTop: "16px",
            borderTop: "1px dashed #e2e8f0",
            color: "#16a34a",
            fontWeight: 600,
            fontSize: "14px",
          }}>
            ✓ Sözleşmenin sonuna ulaştınız
          </div>
        </div>
        
        {!hasReadKvkk && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "#f59e0b", marginBottom: "16px" }}>
            ↓ Sözleşmeyi sonuna kadar okuyun
          </p>
        )}
        
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => {
              setKvkkAccepted(true);
              setHasReadKvkk(true);
              setShowKvkkModal(false);
            }}
            disabled={!hasReadKvkk}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: hasReadKvkk ? "#22c55e" : "#94a3b8",
              color: "white",
              fontWeight: 600,
              cursor: hasReadKvkk ? "pointer" : "not-allowed",
            }}
          >
            Okudum, Onaylıyorum
          </button>
          <button
            onClick={() => setShowKvkkModal(false)}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "white",
              color: "#64748b",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Kapat
          </button>
        </div>
      </Modal>

      {/* Terms Modal */}
      <Modal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} title="Kullanım Şartları" width="600px">
        <div 
          ref={termsScrollRef}
          onScroll={handleTermsScroll}
          style={{ 
            maxHeight: "400px", 
            overflowY: "auto", 
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "12px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>1. HİZMET KAPSAMI</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Bu platform, bavul depolama hizmetleri için rezervasyon yapmanıza olanak sağlar. Hizmetler, belirtilen koşullar ve sınırlamalar dahilinde sunulmaktadır.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>2. KULLANICI YÜKÜMLÜLÜKLERİ</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Kullanıcılar, doğru ve güncel bilgi sağlamakla yükümlüdür. Yanlış bilgi verilmesi durumunda hizmet reddedilebilir.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>3. ÖDEME VE İPTAL</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Rezervasyon ücretleri belirtilen fiyatlandırma kurallarına göre hesaplanır. İptal koşulları rezervasyon sırasında belirtilir.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>4. SORUMLULUK SINIRLAMASI</h4>
          <p style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Platform, bavulların kaybolması, hasar görmesi durumunda sınırlı sorumluluk taşır.
          </p>
          <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>5. GİZLİLİK</h4>
          <p style={{ margin: "0", fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
            Kişisel verileriniz KVKK uyarınca korunmakta ve yalnızca belirtilen amaçlar doğrultusunda kullanılmaktadır.
          </p>
          <div style={{ 
            textAlign: "center", 
            padding: "16px", 
            marginTop: "16px",
            borderTop: "1px dashed #e2e8f0",
            color: "#16a34a",
            fontWeight: 600,
            fontSize: "14px",
          }}>
            ✓ Sözleşmenin sonuna ulaştınız
          </div>
        </div>
        
        {!hasReadTerms && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "#f59e0b", marginBottom: "16px" }}>
            ↓ Sözleşmeyi sonuna kadar okuyun
          </p>
        )}
        
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => {
              setTermsAccepted(true);
              setHasReadTerms(true);
              setShowTermsModal(false);
            }}
            disabled={!hasReadTerms}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: hasReadTerms ? "#22c55e" : "#94a3b8",
              color: "white",
              fontWeight: 600,
              cursor: hasReadTerms ? "pointer" : "not-allowed",
            }}
          >
            Okudum, Onaylıyorum
          </button>
          <button
            onClick={() => setShowTermsModal(false)}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "white",
              color: "#64748b",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Kapat
          </button>
        </div>
      </Modal>

      {/* Handover Modal */}
      <Modal isOpen={handoverModalOpen} onClose={() => setHandoverModalOpen(false)} title="Bavul Teslim Alma" width="500px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Teslim Alan</label>
            <input
              type="text"
              value={handoverForm.handover_by}
              onChange={(e) => setHandoverForm((prev) => ({ ...prev, handover_by: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Not</label>
            <textarea
              value={handoverForm.notes}
              onChange={(e) => setHandoverForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <button
            onClick={handleHandover}
            disabled={handoverLoading}
            style={{
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
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
            {handoverLoading ? <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} /> : "Teslim Al"}
          </button>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal isOpen={returnModalOpen} onClose={() => setReturnModalOpen(false)} title="Bavul Teslim Etme" width="500px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Teslim Eden</label>
            <input
              type="text"
              value={returnForm.returned_by}
              onChange={(e) => setReturnForm((prev) => ({ ...prev, returned_by: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Not</label>
            <textarea
              value={returnForm.notes}
              onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <button
            onClick={handleReturn}
            disabled={returnLoading}
            style={{
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
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
            {returnLoading ? <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} /> : "Teslim Et"}
          </button>
        </div>
      </Modal>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input:focus, select:focus, textarea:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        }
      `}</style>
    </div>
  );
}
