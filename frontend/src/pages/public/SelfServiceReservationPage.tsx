import { useState } from "react";

import {
  selfServiceReservationService,
  type SelfServiceReservation,
  type SelfServiceReservationCreatePayload,
  type SelfServiceReservationCreateResponse,
  type SelfServiceHandoverPayload,
  type SelfServiceReturnPayload,
} from "../../services/public/reservations";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../../components/common/ToastContainer";
import { Modal } from "../../components/common/Modal";
import { getErrorMessage } from "../../lib/httpError";

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
  const { messages, push } = useToast();

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
    <div className="public-page">
      <ToastContainer messages={messages} />
      <div className="public-card">
        <header className="public-header">
          <h1 className="public-header__title">Self-Service Rezervasyon</h1>
          <p className="public-header__subtitle">
            Bavulunuzu bırakmadan önce rezervasyon oluşturun veya mevcut rezervasyonunuzu QR koduyla
            doğrulayın.
          </p>
        </header>

        <div className="public-sections">
          <section className="public-section">
            <h2 className="public-section__title">Yeni Rezervasyon</h2>
            <p className="public-section__description">
              Otel ve depo bilgilerini girerek müşteriniz için birkaç adımda rezervasyon oluşturun.
            </p>
            <form className="public-field-group" onSubmit={handleCreateReservation}>
              <label className="form-field">
                <span className="form-field__label">Tenant Slug</span>
                <input
                  value={createForm.tenant_slug}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tenant_slug: event.target.value }))}
                  placeholder="örn. demo-hotel"
                  required
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Depo Kodu</span>
                <input
                  value={createForm.locker_code}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, locker_code: event.target.value }))}
                  placeholder="örn. LK-01"
                  required
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Başlangıç</span>
                <input
                  type="datetime-local"
                  value={createForm.start_at}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, start_at: event.target.value }))}
                  required
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Bitiş</span>
                <input
                  type="datetime-local"
                  value={createForm.end_at}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, end_at: event.target.value }))}
                  required
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Müşteri Adı</span>
                <input
                  value={createForm.customer_name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, customer_name: event.target.value }))}
                  placeholder="Ad Soyad (opsiyonel)"
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Telefon</span>
                <input
                  value={createForm.customer_phone}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, customer_phone: event.target.value }))}
                  placeholder="0 555 ..."
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Bavul Sayısı</span>
                <input
                  type="number"
                  min={0}
                  value={createForm.baggage_count ?? ""}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      baggage_count: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Bavul Türü</span>
                <input
                  value={createForm.baggage_type ?? ""}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, baggage_type: event.target.value }))}
                  placeholder="Kabin / Büyük / Spor çantası"
                />
              </label>
              <label className="form-field">
                <span className="form-field__label">Tahmini Ağırlık (kg)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={createForm.weight_kg ?? ""}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      weight_kg: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <label className="form-field form-grid__field--full">
                <span className="form-field__label">Notlar</span>
                <textarea
                  value={createForm.notes ?? ""}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Teslimat sırasında dikkat edilmesi gerekenler..."
                  rows={3}
                />
              </label>
              <div className="form-actions form-grid__field--full">
                <button type="submit" className="btn btn--secondary" disabled={createLoading}>
                  {createLoading ? "Oluşturuluyor..." : "Rezervasyon Oluştur"}
                </button>
              </div>
            </form>

            {createResult && (
              <div className="result-card">
                <h3 className="result-card__title">Rezervasyon Oluşturuldu</h3>
                <ul className="result-card__list">
                  <li className="result-card__item">
                    <span>Rezervasyon ID</span>
                    <strong>{createResult.reservation_id}</strong>
                  </li>
                  <li className="result-card__item">
                    <span>QR Kodu</span>
                    <strong>{createResult.qr_code}</strong>
                  </li>
                  <li className="result-card__item">
                    <span>Depo</span>
                    <strong>{createResult.locker_code}</strong>
                  </li>
                  <li className="result-card__item">
                    <span>Süre</span>
                    <strong>
                      {new Date(createResult.start_at).toLocaleString("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      -{" "}
                      {new Date(createResult.end_at).toLocaleString("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>
                  </li>
                </ul>
                <p className="result-card__hint">Bu QR kodunu kaydedin ve depoda ibraz edin.</p>
              </div>
            )}
          </section>

          <section className="public-section">
            <h2 className="public-section__title">Rezervasyon Kontrolü</h2>
            <p className="public-section__description">
              QR kodunuzu girerek rezervasyon durumunu doğrulayabilir, teslim ve iade adımlarını
              tamamlayabilirsiniz.
            </p>
            <form className="lookup-form" onSubmit={handleLookup}>
              <input
                className="lookup-form__input"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="QR kodu / doğrulama kodu"
              />
              <button type="submit" className="btn btn--primary" disabled={loading}>
                {loading ? "Kontrol ediliyor..." : "Sorgula"}
              </button>
            </form>

            {result && (
              <div className="lookup-card">
                <div className="lookup-card__header">
                  <h3 className="lookup-card__title">Rezervasyon Bilgisi</h3>
                  <span className={statusClassMap[result.status] ?? "badge badge--muted"}>
                    {statusLabels[result.status] ?? result.status}
                  </span>
                </div>
                <div className="lookup-card__grid">
                  <div className="lookup-card__meta">
                    <span>Depo</span>
                    <strong>{result.locker_code ?? "-"}</strong>
                  </div>
                  <div className="lookup-card__meta">
                    <span>Lokasyon</span>
                    <strong>{result.location_name ?? "-"}</strong>
                  </div>
                  <div className="lookup-card__meta">
                    <span>Bavul</span>
                    <strong>
                      {result.baggage_count ?? "-"} {result.baggage_type ?? "adet"}
                    </strong>
                  </div>
                  <div className="lookup-card__meta">
                    <span>Rezervasyon Sahibi</span>
                    <strong>{result.customer_hint ?? "-"}</strong>
                  </div>
                  {result.customer_phone && (
                    <div className="lookup-card__meta">
                      <span>Telefon</span>
                      <strong>{result.customer_phone}</strong>
                    </div>
                  )}
                  <div className="lookup-card__meta">
                    <span>Başlangıç</span>
                    <strong>
                      {result.start_at
                        ? new Date(result.start_at).toLocaleString("tr-TR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "-"}
                    </strong>
                  </div>
                  <div className="lookup-card__meta">
                    <span>Bitiş</span>
                    <strong>
                      {result.end_at
                        ? new Date(result.end_at).toLocaleString("tr-TR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "-"}
                    </strong>
                  </div>
                  <div className="lookup-card__meta">
                    <span>Depoya Teslim</span>
                    <strong>
                      {result.handover_at
                        ? `${new Date(result.handover_at).toLocaleString("tr-TR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}${result.handover_by ? ` (${result.handover_by})` : ""}`
                        : "-"}
                    </strong>
                  </div>
                  <div className="lookup-card__meta">
                    <span>Teslim Alma</span>
                    <strong>
                      {result.returned_at
                        ? `${new Date(result.returned_at).toLocaleString("tr-TR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}${result.returned_by ? ` (${result.returned_by})` : ""}`
                        : "-"}
                    </strong>
                  </div>
                  {result.notes && (
                    <div className="lookup-card__meta" style={{ gridColumn: "1 / -1" }}>
                      <span>Audit Notu</span>
                      <strong>{result.notes}</strong>
                    </div>
                  )}
                  {result.evidence_url && (
                    <div className="lookup-card__meta" style={{ gridColumn: "1 / -1" }}>
                      <span>Ek / Fotoğraf</span>
                      <a href={result.evidence_url} target="_blank" rel="noreferrer" className="action-link">
                        {result.evidence_url}
                      </a>
                    </div>
                  )}
                </div>

                {result.valid ? (
                  <div className="lookup-card__actions">
                    {result.status === "active" && !result.handover_at && (
                      <div className="public-field-group">
                        <p className="public-section__description" style={{ marginBottom: "0.5rem" }}>
                          Depoya teslim ederken kısa bir not ve görsel ekleyerek audit kayıtlarını tamamlayın.
                        </p>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => setHandoverModalOpen(true)}
                          disabled={handoverLoading}
                        >
                          {handoverLoading ? "Teslim kaydediliyor..." : "Depoya Teslim Ettim"}
                        </button>
                      </div>
                    )}
                    {result.status === "active" && result.handover_at && !result.returned_at && (
                      <div className="public-field-group">
                        <p className="public-section__description" style={{ marginBottom: "0.5rem" }}>
                          Misafirin emanetini teslim aldığını onaylayın; audit kaydına not ve fotoğraf ekleyebilirsiniz.
                        </p>
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setReturnModalOpen(true)}
                          disabled={returnLoading}
                        >
                          {returnLoading ? "İade kaydediliyor..." : "Emanetimi Teslim Aldım"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="field-error lookup-card__alert">
                    QR kodu geçersiz veya rezervasyon bulunamadı. Lütfen işletme görevlisiyle iletişime geçin.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
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
