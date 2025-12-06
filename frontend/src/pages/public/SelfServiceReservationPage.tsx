import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User, Phone, Calendar, Package, MapPin, DollarSign, FileText, CheckCircle2, AlertCircle, Loader2, Clock, Shield, Eye
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

const statusClassMap: Record<string, string> = {
  active: "badge badge--success",
  completed: "badge badge--info",
  cancelled: "badge badge--danger",
};

export function SelfServiceReservationPage() {
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
  
  const { messages, push } = useToast();

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
    // Debounce price calculation
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
      // Reset form
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
      setHandoverForm({
        handover_by: "self-service",
        notes: "",
        evidence_url: "",
      });
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
      setReturnForm({
        returned_by: "guest",
        notes: "",
        evidence_url: "",
      });
      push({ title: "İade kaydedildi", type: "success" });
      setReturnModalOpen(false);
    } catch (error) {
      push({ title: "İade kaydedilemedi", description: getErrorMessage(error), type: "error" });
    } finally {
      setReturnLoading(false);
    }
  };


  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}
      >
        <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
          Self-Service Rezervasyon
        </h1>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-tertiary)', margin: 0 }}>
          Bavulunuzu bırakmadan önce rezervasyon oluşturun veya mevcut rezervasyonunuzu QR koduyla doğrulayın.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)' }}>
        {/* NEW RESERVATION FORM */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                Yeni Rezervasyon
              </h2>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
                Otel ve depo bilgilerini girerek müşteriniz için birkaç adımda rezervasyon oluşturun.
              </p>
            </div>

            <form onSubmit={handleCreateReservation} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* SECTION 1: Guest Information */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <User className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                    Misafir Bilgileri
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
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
              </div>

              {/* SECTION 2: Reservation Dates */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                    Rezervasyon Tarihleri
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                  <ModernInput
                    label="Başlangıç"
                    type="datetime-local"
                    value={createForm.start_at}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, start_at: e.target.value }))}
                    leftIcon={<Clock className="h-4 w-4" />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="Bitiş"
                    type="datetime-local"
                    value={createForm.end_at}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, end_at: e.target.value }))}
                    leftIcon={<Clock className="h-4 w-4" />}
                    fullWidth
                    required
                  />
                </div>
              </div>

              {/* SECTION 3: Storage Selection */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <MapPin className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                    Depo Seçimi
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                  <ModernInput
                    label="Tenant Slug"
                    value={createForm.tenant_slug}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, tenant_slug: e.target.value }))}
                    placeholder="örn. demo-hotel"
                    leftIcon={<MapPin className="h-4 w-4" />}
                    fullWidth
                    required
                  />
                  <ModernInput
                    label="Depo Kodu"
                    value={createForm.locker_code}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, locker_code: e.target.value }))}
                    placeholder="örn. LK-01"
                    leftIcon={<Package className="h-4 w-4" />}
                    fullWidth
                    required
                  />
                </div>
              </div>

              {/* SECTION 4: Luggage Details */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <Package className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                    Bavul Detayları
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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
                    placeholder="Kabin / Büyük / Spor çantası"
                    fullWidth
                  />
                  <ModernInput
                    label="Tahmini Ağırlık (kg)"
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
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "var(--text-sm)", color: 'var(--text-primary)' }}>
                    Notlar
                  </label>
                  <textarea
                    value={createForm.notes ?? ""}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Teslimat sırasında dikkat edilmesi gerekenler..."
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
                    }}
                  />
                </div>
              </div>

              {/* SECTION 5: Dynamic Pricing Summary */}
              {(priceLoading || priceEstimate || priceError) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <ModernCard variant="glass" padding="lg" style={{ 
                    background: priceEstimate 
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)'
                      : priceError
                      ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)'
                      : 'var(--bg-tertiary)',
                    border: priceEstimate 
                      ? '1px solid rgba(34, 197, 94, 0.2)'
                      : priceError
                      ? '1px solid rgba(220, 38, 38, 0.2)'
                      : '1px solid var(--border-primary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <DollarSign className="h-5 w-5" style={{ color: priceEstimate ? '#16a34a' : priceError ? '#dc2626' : 'var(--text-tertiary)' }} />
                        <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>Fiyat Özeti</span>
                      </div>
                      {priceLoading && <Loader2 className="h-4 w-4" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />}
                    </div>
                    {priceLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-tertiary)' }}>
                        <Loader2 className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Hesaplanıyor...</span>
                      </div>
                    ) : priceError ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: '#dc2626' }}>
                        <AlertCircle className="h-4 w-4" />
                        <span>{priceError}</span>
                      </div>
                    ) : priceEstimate ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>Toplam Tutar</span>
                          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: '#16a34a' }}>
                            {priceEstimate.total_formatted}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                          <span>{priceEstimate.duration_hours.toFixed(1)} saat</span>
                          <span>({priceEstimate.duration_days} gün)</span>
                          <span>• {priceEstimate.baggage_count} bavul</span>
                          {priceEstimate.pricing_type && <span>• {priceEstimate.pricing_type}</span>}
                        </div>
                      </>
                    ) : null}
                  </ModernCard>
                </motion.div>
              )}

              {/* SECTION 6: Agreements/Contracts */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <Shield className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                    Sözleşmeler ve Onaylar
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', transition: 'all 0.2s' }}>
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
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                      disabled={!hasReadKvkk}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                          KVKK Aydınlatma Metni
                        </span>
                        {!hasReadKvkk && (
                          <ModernButton
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowKvkkModal(true);
                            }}
                            leftIcon={<Eye className="h-3 w-3" />}
                          >
                            Oku
                          </ModernButton>
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                        Kişisel verilerinizin işlenmesine ilişkin aydınlatma metnini okudum ve kabul ediyorum.
                      </span>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', transition: 'all 0.2s' }}>
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
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                      disabled={!hasReadTerms}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                          Kullanım Şartları ve Gizlilik Politikası
                        </span>
                        {!hasReadTerms && (
                          <ModernButton
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowTermsModal(true);
                            }}
                            leftIcon={<Eye className="h-3 w-3" />}
                          >
                            Oku
                          </ModernButton>
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                        Kullanım şartlarını ve gizlilik politikasını okudum ve kabul ediyorum.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <ModernButton
                  type="submit"
                  variant="primary"
                  disabled={createLoading || priceLoading || !!(priceError && !priceEstimate) || !kvkkAccepted || !termsAccepted}
                  isLoading={createLoading}
                  loadingText="Oluşturuluyor..."
                  leftIcon={!createLoading && <CheckCircle2 className="h-4 w-4" />}
                >
                  Rezervasyon Oluştur
                </ModernButton>
              </div>
              {priceError && !priceEstimate && (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: '#dc2626', textAlign: 'center' }}>
                  Ücret hesaplanamadığı için rezervasyon oluşturulamaz. Lütfen tarihleri kontrol edin.
                </p>
              )}
            </form>

            {/* Success Result */}
            {createResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: 'var(--space-6)' }}
              >
                <ModernCard variant="glass" padding="lg" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    <CheckCircle2 className="h-6 w-6" style={{ color: '#16a34a' }} />
                    <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: '#16a34a', margin: 0 }}>
                      Rezervasyon Oluşturuldu
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <div>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Rezervasyon ID</span>
                      <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{createResult.reservation_id}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>QR Kodu</span>
                      <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{createResult.qr_code}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Depo</span>
                      <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{createResult.locker_code}</strong>
                    </div>
                  </div>
                  <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                    Bu QR kodunu kaydedin ve depoda ibraz edin.
                  </p>
                </ModernCard>
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
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1) 0' }}>
                Rezervasyon Kontrolü
              </h2>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
                QR kodunuzu girerek rezervasyon durumunu doğrulayabilir, teslim ve iade adımlarını tamamlayabilirsiniz.
              </p>
            </div>
            <form onSubmit={handleLookup} style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <ModernInput
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="QR kodu / doğrulama kodu"
                  leftIcon={<FileText className="h-4 w-4" />}
                  fullWidth
                />
                <ModernButton type="submit" variant="primary" disabled={loading} isLoading={loading} loadingText="Kontrol ediliyor...">
                  Sorgula
                </ModernButton>
              </div>
            </form>

            {result && (
              <ModernCard variant="glass" padding="lg" style={{ background: result.valid ? 'var(--bg-tertiary)' : 'rgba(220, 38, 38, 0.05)', border: result.valid ? '1px solid var(--border-primary)' : '1px solid rgba(220, 38, 38, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0 }}>
                    Rezervasyon Bilgisi
                  </h3>
                  <span className={statusClassMap[result.status] ?? "badge badge--muted"}>
                    {statusLabels[result.status] ?? result.status}
                  </span>
                </div>
                {result.valid ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Depo</span>
                        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.locker_code ?? "-"}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Lokasyon</span>
                        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.location_name ?? "-"}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Bavul</span>
                        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                          {result.baggage_count ?? "-"} {result.baggage_type ?? "adet"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Rezervasyon Sahibi</span>
                        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.customer_hint ?? "-"}</strong>
                      </div>
                      {result.customer_phone && (
                        <div>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Telefon</span>
                          <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.customer_phone}</strong>
                        </div>
                      )}
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Başlangıç</span>
                        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                          {result.start_at
                            ? new Date(result.start_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
                            : "-"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Bitiş</span>
                        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                          {result.end_at
                            ? new Date(result.end_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
                            : "-"}
                        </strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      {result.status === "active" && !result.handover_at && (
                        <ModernButton
                          variant="secondary"
                          onClick={() => setHandoverModalOpen(true)}
                          disabled={handoverLoading}
                          isLoading={handoverLoading}
                          loadingText="Teslim kaydediliyor..."
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
                          loadingText="İade kaydediliyor..."
                        >
                          Emanetimi Teslim Aldım
                        </ModernButton>
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, color: '#dc2626', fontSize: 'var(--text-base)' }}>
                    QR kodu geçersiz veya rezervasyon bulunamadı. Lütfen işletme görevlisiyle iletişime geçin.
                  </p>
                )}
              </ModernCard>
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
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>1. Veri Sorumlusu</strong><br />
            Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla [Şirket Adı] tarafından işlenmektedir.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>2. İşlenen Kişisel Veriler</strong><br />
            Rezervasyon sürecinde ad, soyad, telefon numarası, e-posta adresi, TC kimlik numarası veya pasaport numarası gibi kişisel verileriniz işlenmektedir.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>3. İşleme Amaçları</strong><br />
            Kişisel verileriniz rezervasyon yönetimi, müşteri hizmetleri, yasal yükümlülüklerin yerine getirilmesi ve hizmet kalitesinin artırılması amaçlarıyla işlenmektedir.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>4. Veri Güvenliği</strong><br />
            Kişisel verileriniz, teknik ve idari güvenlik önlemleri alınarak korunmaktadır.
          </p>
          <p style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>5. Haklarınız</strong><br />
            KVKK'nın 11. maddesi uyarınca kişisel verileriniz hakkında bilgi talep etme, düzeltme, silme, itiraz etme ve şikayet etme haklarınız bulunmaktadır.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
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
          >
            Okudum ve Kabul Ediyorum
          </ModernButton>
        </div>
      </ModernModal>

      {/* Terms Modal */}
      <ModernModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Kullanım Şartları ve Gizlilik Politikası"
        size="lg"
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>1. Hizmet Kapsamı</strong><br />
            Bu platform, bavul depolama hizmetleri için rezervasyon yapmanıza olanak sağlar. Hizmetler, belirtilen koşullar ve sınırlamalar dahilinde sunulmaktadır.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>2. Kullanıcı Yükümlülükleri</strong><br />
            Kullanıcılar, doğru ve güncel bilgi sağlamakla yükümlüdür. Yanlış bilgi verilmesi durumunda hizmet reddedilebilir.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>3. Ödeme ve İptal</strong><br />
            Rezervasyon ücretleri belirtilen fiyatlandırma kurallarına göre hesaplanır. İptal koşulları rezervasyon sırasında belirtilir.
          </p>
          <p style={{ marginBottom: 'var(--space-4)', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>4. Sorumluluk Sınırlaması</strong><br />
            Platform, bavulların kaybolması, hasar görmesi veya çalınması durumunda sınırlı sorumluluk taşır. Detaylar için lütfen hizmet sağlayıcıyla iletişime geçin.
          </p>
          <p style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <strong>5. Gizlilik</strong><br />
            Kişisel verileriniz KVKK uyarınca korunmakta ve yalnızca belirtilen amaçlar doğrultusunda kullanılmaktadır.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
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
          >
            Okudum ve Kabul Ediyorum
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
          <form className="public-field-group" onSubmit={handleSelfHandover}>
            <label className="form-field">
              <span className="form-field__label">Teslim Eden</span>
              <input
                value={handoverForm.handover_by}
                onChange={(event) => setHandoverForm((prev) => ({ ...prev, handover_by: event.target.value }))}
                placeholder="self-service"
              />
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Not</span>
              <textarea
                value={handoverForm.notes}
                onChange={(event) => setHandoverForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="Teslim sırasında notlar"
              />
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Fotoğraf / Tutanak URL</span>
              <input
                value={handoverForm.evidence_url}
                onChange={(event) => setHandoverForm((prev) => ({ ...prev, evidence_url: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <div className="public-actions">
              <button type="button" className="btn btn--ghost-dark" onClick={() => setHandoverModalOpen(false)} disabled={handoverLoading}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn--secondary" disabled={handoverLoading}>
                {handoverLoading ? "Teslim kaydediliyor..." : "Teslimi Kaydet"}
              </button>
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
          <form className="public-field-group" onSubmit={handleSelfReturn}>
            <label className="form-field">
              <span className="form-field__label">Teslim Alan</span>
              <input
                value={returnForm.returned_by}
                onChange={(event) => setReturnForm((prev) => ({ ...prev, returned_by: event.target.value }))}
                placeholder="Misafir adı"
              />
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Not</span>
              <textarea
                value={returnForm.notes}
                onChange={(event) => setReturnForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="İade sırasında notlar"
              />
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Fotoğraf / Tutanak URL</span>
              <input
                value={returnForm.evidence_url}
                onChange={(event) => setReturnForm((prev) => ({ ...prev, evidence_url: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <div className="public-actions">
              <button type="button" className="btn btn--ghost-dark" onClick={() => setReturnModalOpen(false)} disabled={returnLoading}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn--primary" disabled={returnLoading}>
                {returnLoading ? "İade kaydediliyor..." : "İadeyi Kaydet"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
