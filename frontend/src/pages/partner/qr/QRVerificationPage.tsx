import { useCallback, useMemo, useState, useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { QrCode, CheckCircle2, XCircle } from "../../../lib/lucide";

import { qrService, type QRVerifyResult } from "../../../services/partner/qr";
import { reservationService } from "../../../services/partner/reservations";
import { useToast } from "../../../hooks/useToast";
import { useTranslation } from "../../../hooks/useTranslation";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { getErrorMessage } from "../../../lib/httpError";
import { errorLogger } from "../../../lib/errorLogger";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { Badge } from "../../../components/ui/Badge";
import { QRScanner } from "../../../components/qr/QRScanner";

const statusLabels: Record<string, string> = {
  active: "Aktif",
  reserved: "Rezerve",
  completed: "Tamamlandı",
  cancelled: "İptal",
  expired: "Süresi Doldu",
  no_show: "Gelmedi",
  lost: "Kayıp",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
};

export function QRVerificationPage() {
  const { t: _t } = useTranslation(); // Translation hook ready for i18n
  const [code, setCode] = useState("");
  const [result, setResult] = useState<QRVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    mode: "handover" | "return";
    reservationId: string;
    notes: string;
    evidence: string;
  } | null>(null);
  const { messages, push } = useToast();
  const inputId = useId();
  const actionNoteId = useId();
  const actionEvidenceId = useId();

  const handoverMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { notes?: string; evidence_url?: string };
    }) => reservationService.handover(id, payload),
  });

  const returnMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { notes?: string; evidence_url?: string };
    }) => reservationService.markReturned(id, payload),
  });

  const getVerificationMessage = useCallback((verification: QRVerifyResult): { title: string; description: string; type: "success" | "info" | "warning" | "error" } => {
    const statusKey = (verification.status_override || verification.status || "").toLowerCase();

    // QR code not found at all
    if (!verification.reservation_id) {
      return {
        title: "QR Kodu Bulunamadı",
        description: "Bu QR kodu bu otele ait herhangi bir rezervasyonla eşleşmiyor.",
        type: "error"
      };
    }

    // Reservation found but not actionable - show info messages
    const statusMessages: Record<string, { title: string; description: string; type: "success" | "info" | "warning" | "error" }> = {
      not_found: {
        title: "QR Kodu Bulunamadı",
        description: "Bu QR kodu ile eşleşen rezervasyon bulunamadı.",
        type: "error"
      },
      cancelled: {
        title: "İptal Edilmiş Rezervasyon",
        description: "Bu rezervasyon iptal edilmiş. Detaylar aşağıda görüntüleniyor.",
        type: "warning"
      },
      completed: {
        title: "Tamamlanmış Rezervasyon",
        description: "Bu rezervasyon başarıyla tamamlanmış. Detaylar aşağıda görüntüleniyor.",
        type: "info"
      },
      expired: {
        title: "Süresi Dolmuş Rezervasyon",
        description: "Rezervasyon süresi dolmuş. Detaylar aşağıda görüntüleniyor.",
        type: "warning"
      },
      reserved: {
        title: "Bekleyen Rezervasyon",
        description: "Rezervasyon henüz aktif değil (depoya teslim bekleniyor). Detaylar aşağıda görüntüleniyor.",
        type: "info"
      },
      no_show: {
        title: "Gelmedi (No-Show)",
        description: "Misafir randevusuna gelmedi. Detaylar aşağıda görüntüleniyor.",
        type: "warning"
      },
      lost: {
        title: "Kayıp Rezervasyon",
        description: "Bu rezervasyon kayıp olarak işaretlenmiş. Detaylar aşağıda görüntüleniyor.",
        type: "error"
      },
    };

    if (statusKey && statusMessages[statusKey]) {
      return statusMessages[statusKey];
    }

    return {
      title: "Rezervasyon Bulundu",
      description: "Rezervasyon detayları aşağıda görüntüleniyor.",
      type: "info"
    };
  }, []);

  const handleVerify = useCallback(async (qrCode?: string) => {
    const codeToVerify = qrCode || code.trim();
    if (!codeToVerify) {
      push({ title: "QR kodu girin", type: "error" });
      return;
    }
    setLoading(true);
    setActionModal(null);
    if (qrCode) setCode(qrCode); // Update input field if scanned
    try {
      const response = await qrService.verify(codeToVerify);
      setResult(response);
      if (response.valid) {
        push({ title: "QR Doğrulandı ✓", description: "Rezervasyon aktif ve işlem yapılabilir", type: "success" });
      } else {
        // Show appropriate message based on status - not always an error
        const message = getVerificationMessage(response);
        push({ title: message.title, description: message.description, type: message.type });
      }
    } catch (error) {
      errorLogger.error(error, {
        component: "QRVerificationPage",
        action: "verifyQR",
        code: code?.substring(0, 10), // Log first 10 chars only
      });
      push({ title: "Doğrulama başarısız", description: getErrorMessage(error), type: "error" });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [code, getVerificationMessage, push]);

  // Handle QR scan from camera
  const handleQRScan = useCallback((scannedCode: string) => {
    if (!loading && scannedCode) {
      handleVerify(scannedCode);
    }
  }, [loading, handleVerify]);

  const handleVerifySubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await handleVerify();
    },
    [handleVerify],
  );

  const clearResult = useCallback(() => {
    setCode("");
    setResult(null);
    setActionModal(null);
  }, []);

  const openActionModal = useCallback(
    (mode: "handover" | "return") => {
      if (!result?.valid || !result.reservation_id) return;
      setActionModal({
        mode,
        reservationId: result.reservation_id,
        notes: "",
        evidence: result.notes ?? "",
      });
    },
    [result],
  );

  const closeActionModal = useCallback(() => {
    if (handoverMutation.isPending || returnMutation.isPending) return;
    setActionModal(null);
  }, [handoverMutation.isPending, returnMutation.isPending]);

  const handleActionFieldChange = useCallback(
    (field: "notes" | "evidence", value: string) => {
      setActionModal((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  const handleActionSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!actionModal) return;
      const payload = {
        notes: actionModal.notes.trim() || undefined,
        evidence_url: actionModal.evidence.trim() || undefined,
      };
      try {
        if (actionModal.mode === "handover") {
          await handoverMutation.mutateAsync({ id: actionModal.reservationId, payload });
          push({ title: "Teslim kaydedildi", type: "success" });
        } else {
          await returnMutation.mutateAsync({ id: actionModal.reservationId, payload });
          push({ title: "İade kaydedildi", type: "success" });
        }
        if (code.trim()) {
          const refreshed = await qrService.verify(code.trim());
          setResult(refreshed);
        }
        setActionModal(null);
      } catch (error) {
        errorLogger.error(error, {
          component: "QRVerificationPage",
          action: actionModal.mode === "handover" ? "handover" : "return",
          reservationId: actionModal.reservationId,
        });
        push({ title: "İşlem tamamlanamadı", description: getErrorMessage(error), type: "error" });
      }
    },
    [actionModal, code, handoverMutation, push, returnMutation],
  );

  const handoverDisabled = useMemo(() => {
    if (!result || !result.valid) return true;
    if (result.status !== "active") return true;
    if (result.handover_at) return true;
    return handoverMutation.isPending;
  }, [result, handoverMutation.isPending]);

  const returnDisabled = useMemo(() => {
    if (!result || !result.valid) return true;
    if (result.status !== "active") return true;
    if (!result.handover_at) return true;
    if (result.returned_at) return true;
    return returnMutation.isPending;
  }, [result, returnMutation.isPending]);

  const statusInfo = useMemo(() => {
    if (!result) return null;
    if (result.valid) return { title: "Aktif Rezervasyon", description: "Bu rezervasyon aktif ve işlem yapılabilir durumda.", type: "success" as const };
    return getVerificationMessage(result);
  }, [getVerificationMessage, result]);

  const getStatusBadgeVariant = (status?: string) => {
    if (status === "active") return "success";
    if (status === "completed") return "info";
    if (status === "cancelled" || status === "lost") return "danger";
    if (status === "expired" || status === "reserved" || status === "no_show") return "warning";
    return "neutral";
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <QrCode className="h-8 w-8" style={{ color: 'var(--primary)' }} />
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
            QR Doğrulama
          </h1>
        </div>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
          Müşteri QR kodunu kontrol ederek depodaki teslim ve iade işlemlerini hızla başlatın.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Camera Scanner */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <QRScanner
            onScan={handleQRScan}
            isProcessing={loading}
            disabled={false}
          />
        </motion.div>

        {/* Manual Input */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Manuel Kod Girişi
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                QR kodu elle girip doğrulayın
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <ModernInput
            id={inputId}
            label="QR Kodu"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="örn. QR-ABC123"
            autoComplete="off"
            leftIcon={<QrCode className="h-4 w-4" />}
            fullWidth
          />
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <ModernButton 
              type="submit" 
              variant="primary" 
              disabled={loading}
              isLoading={loading}
              loadingText="Doğrulanıyor..."
              leftIcon={!loading && <QrCode className="h-4 w-4" />}
            >
              Doğrula
            </ModernButton>
            {(result || code) && (
              <ModernButton 
                type="button" 
                variant="ghost" 
                onClick={clearResult} 
                disabled={loading}
              >
                Temizle
              </ModernButton>
            )}
          </div>
        </form>
          </ModernCard>
        </motion.div>
      </div>

      {result && (
          <ModernCard variant="glass" padding="lg" style={{ marginTop: 'var(--space-6)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                  Rezervasyon Özeti
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Kod: <strong>{code.trim()}</strong>
                </p>
              </div>
              {result.status && (
                <Badge variant={getStatusBadgeVariant(result.status)}>
                  {statusLabels[result.status] ?? result.status}
                </Badge>
              )}
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)'
            }}>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Rezervasyon No</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.reservation_id ?? "-"}</span>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>QR Kodu</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.qr_code ?? code.trim()}</span>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Depo Numarası</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.locker_id ?? "-"}</span>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Depo Kodu</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.storage_code ?? "-"}</span>
                {result.location_name && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'block', marginTop: 'var(--space-1)' }}>{result.location_name}</span>
                )}
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Ad Soyad</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.full_name || result.customer_name || "Ziyaretçi"}</span>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>İletişim</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>{result.customer_phone || result.phone_number || "-"}</span>
                {result.customer_email && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginTop: 'var(--space-1)' }}>{result.customer_email}</span>
                )}
              </div>
              {(result.tc_identity_number || result.passport_number) && (
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Kimlik</strong>
                  {result.tc_identity_number && (
                    <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>
                      TC: {result.tc_identity_number.replace(/(\d{3})(\d{2})(\d{3})(\d{3})/, "$1***$3***")}
                    </span>
                  )}
                  {result.passport_number && (
                    <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>Pasaport: {result.passport_number}</span>
                  )}
                </div>
              )}
              {result.hotel_room_number && (
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Oda Numarası</strong>
                  <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{result.hotel_room_number}</span>
                </div>
              )}
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Rezervasyon Tarihleri</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>
                  {result.start_at ? formatDateTime(result.start_at) : "-"} - {result.end_at ? formatDateTime(result.end_at) : "-"}
                </span>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Bavul Bilgileri</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>
                  {result.baggage_count ?? 0} {result.baggage_type ?? "parça"}
                </span>
                {result.weight_kg != null && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginTop: 'var(--space-1)' }}>{result.weight_kg.toFixed(1)} kg</span>
                )}
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Depoya Teslim</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>
                  {result.handover_at
                    ? `${formatDateTime(result.handover_at)} · ${result.handover_by ?? "-"}`
                    : "Bekleniyor"}
                </span>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Misafire İade</strong>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', display: 'block' }}>
                  {result.returned_at
                    ? `${formatDateTime(result.returned_at)} · ${result.returned_by ?? "-"}`
                    : "Bekleniyor"}
                </span>
              </div>
            </div>
            {(result.notes || result.evidence_url) && (
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
                {result.notes && (
                  <p style={{ margin: '0 0 var(--space-2) 0', color: 'var(--text-secondary)' }}>
                    <strong>Audit Notu:</strong> {result.notes}
                  </p>
                )}
                {result.evidence_url && (
                  <a 
                    href={result.evidence_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ color: 'var(--primary)', textDecoration: 'none' }}
                  >
                    Ek / Fotoğrafı Aç →
                  </a>
                )}
              </div>
            )}

            {result.valid && (
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <ModernButton
                    variant="secondary"
                    onClick={() => !handoverDisabled && openActionModal("handover")}
                    disabled={handoverDisabled}
                    isLoading={handoverMutation.isPending}
                    loadingText="Kaydediliyor..."
                    leftIcon={!handoverMutation.isPending && <CheckCircle2 className="h-4 w-4" />}
                  >
                    Depoya Teslim Alındı
                  </ModernButton>
                  <ModernButton
                    variant="primary"
                    onClick={() => !returnDisabled && openActionModal("return")}
                    disabled={returnDisabled}
                    isLoading={returnMutation.isPending}
                    loadingText="Kaydediliyor..."
                    leftIcon={!returnMutation.isPending && <CheckCircle2 className="h-4 w-4" />}
                  >
                    Misafire Teslim Edildi
                  </ModernButton>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-2) 0 0 0' }}>
                  Kaydedilen işlemler rezervasyon listesine ve denetim kayıtlarına otomatik olarak yansır.
                </p>
              </div>
            )}
            {statusInfo && !result?.valid && (
              <div style={{ 
                marginTop: 'var(--space-4)', 
                padding: 'var(--space-3)', 
                background: statusInfo.type === 'error' 
                  ? 'rgba(220, 38, 38, 0.1)' 
                  : statusInfo.type === 'warning' 
                    ? 'rgba(234, 179, 8, 0.1)' 
                    : 'rgba(59, 130, 246, 0.1)', 
                border: `1px solid ${statusInfo.type === 'error' 
                  ? 'rgba(220, 38, 38, 0.2)' 
                  : statusInfo.type === 'warning' 
                    ? 'rgba(234, 179, 8, 0.2)' 
                    : 'rgba(59, 130, 246, 0.2)'}`,
                borderRadius: 'var(--radius-lg)',
                color: statusInfo.type === 'error' 
                  ? '#dc2626' 
                  : statusInfo.type === 'warning' 
                    ? '#ca8a04' 
                    : '#2563eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  {statusInfo.type === 'error' ? (
                    <XCircle className="h-4 w-4" style={{ marginTop: '2px', flexShrink: 0 }} />
                  ) : statusInfo.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" style={{ marginTop: '2px', flexShrink: 0 }} />
                  ) : (
                    <QrCode className="h-4 w-4" style={{ marginTop: '2px', flexShrink: 0 }} />
                  )}
                  <div>
                    <strong style={{ fontSize: 'var(--text-sm)', display: 'block' }}>{statusInfo.title}</strong>
                    <span style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>{statusInfo.description}</span>
                  </div>
                </div>
              </div>
            )}
          </ModernCard>
        )}

      {actionModal && result && (
        <Modal
          isOpen
          title={actionModal.mode === "handover" ? "Depo Teslim Kaydı" : "İade Kaydı"}
          onClose={closeActionModal}
          disableClose={handoverMutation.isPending || returnMutation.isPending}
          width="520px"
        >
          <form onSubmit={handleActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Rezervasyon:</strong> {result.reservation_id ?? "-"}
              </div>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Dolap:</strong> {result.locker_id ?? "-"}
              </div>
              <div>
                <strong>Müşteri:</strong> {result.customer_name ?? "Ziyaretçi"}
              </div>
            </div>
            <ModernInput
              id={actionNoteId}
              label="Not"
              value={actionModal.notes}
              onChange={(e) => handleActionFieldChange("notes", e.target.value)}
              placeholder="Teslim/İade sırasında kaydetmek istediğiniz notlar"
              fullWidth
            />
            <ModernInput
              id={actionEvidenceId}
              label="Fotoğraf / Tutanak URL"
              value={actionModal.evidence}
              onChange={(e) => handleActionFieldChange("evidence", e.target.value)}
              placeholder="https://..."
              fullWidth
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <ModernButton
                type="button"
                variant="ghost"
                onClick={closeActionModal}
                disabled={handoverMutation.isPending || returnMutation.isPending}
              >
                Vazgeç
              </ModernButton>
              <ModernButton
                type="submit"
                variant="primary"
                disabled={handoverMutation.isPending || returnMutation.isPending}
                isLoading={actionModal.mode === "handover" ? handoverMutation.isPending : returnMutation.isPending}
                loadingText="Kaydediliyor..."
              >
                {actionModal.mode === "handover" ? "Teslimi Kaydet" : "İadeyi Kaydet"}
              </ModernButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
