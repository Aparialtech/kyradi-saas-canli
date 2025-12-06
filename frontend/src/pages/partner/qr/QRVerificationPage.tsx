import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { qrService, type QRVerifyResult } from "../../../services/partner/qr";
import { reservationService } from "../../../services/partner/reservations";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { Modal } from "../../../components/common/Modal";
import { getErrorMessage } from "../../../lib/httpError";

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

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
};

export function QRVerificationPage() {
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

  const handleVerify = useCallback(async () => {
    if (!code.trim()) {
      push({ title: "QR kodu girin", type: "error" });
      return;
    }
    setLoading(true);
    setActionModal(null);
    try {
      const response = await qrService.verify(code.trim());
      setResult(response);
      if (response.valid) {
        push({ title: "QR doğrulandı", description: "Rezervasyon aktif ve geçerli", type: "success" });
      } else {
        const statusMessages: Record<string, string> = {
          not_found: "Bu QR kod ile eşleşen aktif rezervasyon bulunamadı.",
          cancelled: "Bu rezervasyon iptal edilmiş.",
          completed: "Bu rezervasyon tamamlanmış.",
          expired: "Bu rezervasyonun süresi dolmuş.",
        };
        const errorMessage = statusMessages[response.status || ""] || response.status || "Geçersiz QR kodu";
        push({ title: "QR doğrulama başarısız", description: errorMessage, type: "error" });
      }
    } catch (error) {
      push({ title: "Doğrulama başarısız", description: getErrorMessage(error), type: "error" });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [code, push]);

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

  const invalidMessage = useMemo(() => {
    if (!result || result.valid) return null;
    if (!result.reservation_id) {
      return "QR kodu geçersiz veya rezervasyon bulunamadı. Detaylar için yöneticinizle iletişime geçin.";
    }
    if (result.status === "expired") {
      return "Rezervasyon süresi dolduğu için QR kodu pasif durumda.";
    }
    if (result.status) {
      const label = statusLabels[result.status] ?? result.status;
      return `Rezervasyon ${label.toLowerCase()} durumunda olduğu için QR kodu kullanılamıyor.`;
    }
    return "Rezervasyon bulundu ancak QR kodu şu anda kullanılamıyor.";
  }, [result]);

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <header className="page-header">
        <div>
          <h1 className="page-title">QR Doğrulama</h1>
          <p className="page-subtitle">
            Müşteri QR kodunu kontrol ederek depodaki teslim ve iade işlemlerini hızla başlatın.
          </p>
        </div>
      </header>

      <div className="panel" style={{ maxWidth: "760px" }}>
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Kod Doğrulama</h2>
            <p className="panel__subtitle">
              QR kodu girip doğrulayın; geçerliyse teslim veya iade adımını başlatabilirsiniz.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleVerifySubmit}>
          <label className="form-field form-grid__field--full">
            <span className="form-field__label">QR Kodu</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="örn. QR-ABC123"
              autoComplete="off"
            />
          </label>
          <div className="form-actions form-grid__field--full">
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Doğrulanıyor..." : "Doğrula"}
            </button>
            {(result || code) && (
              <button type="button" className="btn btn--ghost-dark" onClick={clearResult} disabled={loading}>
                Temizle
              </button>
            )}
          </div>
        </form>

        {result && (
          <div className="lookup-card">
            <div className="lookup-card__header">
              <div>
                <h3 className="lookup-card__title">Rezervasyon Özeti</h3>
                <p className="table-cell-muted">
                  Kod: <strong>{code.trim()}</strong>
                </p>
              </div>
              {result.status && (
                <span className={statusClassMap[result.status] ?? "badge badge--info"}>
                  {statusLabels[result.status] ?? result.status}
                </span>
              )}
            </div>

            <div className="lookup-card__grid">
              <div className="lookup-card__meta">
                <strong>Rezervasyon No</strong>
                <span>{result.reservation_id ?? "-"}</span>
              </div>
              <div className="lookup-card__meta">
                <strong>QR Kodu</strong>
                <span>{result.qr_code ?? code.trim()}</span>
              </div>
              <div className="lookup-card__meta">
                <strong>Depo Numarası</strong>
                <span>{result.locker_id ?? "-"}</span>
              </div>
              <div className="lookup-card__meta">
                <strong>Ad Soyad</strong>
                <span>{result.full_name || result.customer_name || "Ziyaretçi"}</span>
              </div>
              <div className="lookup-card__meta">
                <strong>İletişim</strong>
                <span>{result.customer_phone || result.phone_number || "-"}</span>
                {result.customer_email && <span>{result.customer_email}</span>}
              </div>
              {(result.tc_identity_number || result.passport_number) && (
                <div className="lookup-card__meta">
                  <strong>Kimlik</strong>
                  {result.tc_identity_number && (
                    <span>TC: {result.tc_identity_number.replace(/(\d{3})(\d{2})(\d{3})(\d{3})/, "$1***$3***")}</span>
                  )}
                  {result.passport_number && <span>Pasaport: {result.passport_number}</span>}
                </div>
              )}
              {result.hotel_room_number && (
                <div className="lookup-card__meta">
                  <strong>Oda Numarası</strong>
                  <span>{result.hotel_room_number}</span>
                </div>
              )}
              <div className="lookup-card__meta">
                <strong>Rezervasyon Tarihleri</strong>
                <span>
                  {result.start_at ? formatDateTime(result.start_at) : "-"} - {result.end_at ? formatDateTime(result.end_at) : "-"}
                </span>
              </div>
              <div className="lookup-card__meta">
                <strong>Bavul Bilgileri</strong>
                <span>
                  {result.baggage_count ?? 0} {result.baggage_type ?? "parça"}
                </span>
                {result.weight_kg != null && <span>{result.weight_kg.toFixed(1)} kg</span>}
              </div>
              <div className="lookup-card__meta">
                <strong>Depoya Teslim</strong>
                <span>
                  {result.handover_at
                    ? `${formatDateTime(result.handover_at)} · ${result.handover_by ?? "-"}`
                    : "Bekleniyor"}
                </span>
              </div>
              <div className="lookup-card__meta">
                <strong>Misafire İade</strong>
                <span>
                  {result.returned_at
                    ? `${formatDateTime(result.returned_at)} · ${result.returned_by ?? "-"}`
                    : "Bekleniyor"}
                </span>
              </div>
            </div>
            {(result.notes || result.evidence_url) && (
              <div className="lookup-card__meta" style={{ marginTop: "1rem" }}>
                {result.notes && (
                  <p style={{ margin: 0, color: "#475569" }}>
                    <strong>Audit Notu:</strong> {result.notes}
                  </p>
                )}
                {result.evidence_url && (
                  <a href={result.evidence_url} target="_blank" rel="noreferrer" className="action-link">
                    Ek / Fotoğrafı Aç
                  </a>
                )}
              </div>
            )}

            {result.valid && (
              <div className="lookup-card__actions">
                <div className="table-actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => !handoverDisabled && openActionModal("handover")}
                    disabled={handoverDisabled}
                  >
                    {handoverMutation.isPending ? "Kaydediliyor..." : "Depoya Teslim Alındı"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => !returnDisabled && openActionModal("return")}
                    disabled={returnDisabled}
                  >
                    {returnMutation.isPending ? "Kaydediliyor..." : "Misafire Teslim Edildi"}
                  </button>
                </div>
                <p className="table-cell-muted">
                  Kaydedilen işlemler rezervasyon listesine ve denetim kayıtlarına otomatik olarak yansır.
                </p>
              </div>
            )}
            {invalidMessage && (
              <p className="field-error lookup-card__alert">{invalidMessage}</p>
            )}
          </div>
        )}
      </div>

      {actionModal && result && (
        <Modal
          isOpen
          title={actionModal.mode === "handover" ? "Depo Teslim Kaydı" : "İade Kaydı"}
          onClose={closeActionModal}
          disableClose={handoverMutation.isPending || returnMutation.isPending}
          width="520px"
        >
          <form className="form-grid" onSubmit={handleActionSubmit}>
            <div className="form-grid__field--full" style={{ color: "#475569" }}>
              <div>
                <strong>Rezervasyon:</strong> {result.reservation_id ?? "-"}
              </div>
              <div>
                <strong>Dolap:</strong> {result.locker_id ?? "-"}
              </div>
              <div>
                <strong>Müşteri:</strong> {result.customer_name ?? "Ziyaretçi"}
              </div>
            </div>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Not</span>
              <textarea
                value={actionModal.notes}
                onChange={(event) => handleActionFieldChange("notes", event.target.value)}
                placeholder="Teslim/İade sırasında kaydetmek istediğiniz notlar"
                rows={3}
              />
            </label>
            <label className="form-field form-grid__field--full">
              <span className="form-field__label">Fotoğraf / Tutanak URL</span>
              <input
                value={actionModal.evidence}
                onChange={(event) => handleActionFieldChange("evidence", event.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="form-actions form-grid__field--full">
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={closeActionModal}
                disabled={handoverMutation.isPending || returnMutation.isPending}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={handoverMutation.isPending || returnMutation.isPending}
              >
                {actionModal.mode === "handover"
                  ? handoverMutation.isPending
                    ? "Kaydediliyor..."
                    : "Teslimi Kaydet"
                  : returnMutation.isPending
                    ? "Kaydediliyor..."
                    : "İadeyi Kaydet"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
