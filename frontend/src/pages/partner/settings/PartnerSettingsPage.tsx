import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";

// Placeholder service - gerçek API endpoint'leri eklenecek
const partnerSettingsService = {
  async getSettings(): Promise<{
    tenant_name: string;
    tenant_slug: string;
    contact_email: string;
    contact_phone: string;
    notification_email: string;
    notification_sms: boolean;
    widget_enabled: boolean;
    widget_public_key: string;
    payment_mode: string;
    commission_rate: number;
  }> {
    // TODO: Gerçek API endpoint'i eklenecek
    return {
      tenant_name: "",
      tenant_slug: "",
      contact_email: "",
      contact_phone: "",
      notification_email: "",
      notification_sms: false,
      widget_enabled: false,
      widget_public_key: "",
      payment_mode: "GATEWAY_DEMO",
      commission_rate: 5.0,
    };
  },
  async updateSettings(payload: any): Promise<void> {
    void payload;
    // TODO: Gerçek API endpoint'i eklenecek
    return Promise.resolve();
  },
};

export function PartnerSettingsPage() {
  const { t } = useTranslation();
  const { messages, push } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["partner", "settings"],
    queryFn: partnerSettingsService.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: partnerSettingsService.updateSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["partner", "settings"] });
      push({ title: "Ayarlar güncellendi", type: "success" });
      setIsEditing(false);
    },
    onError: (error: unknown) => {
      push({ title: "Güncelleme başarısız", description: getErrorMessage(error), type: "error" });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      tenant_name: formData.get("tenant_name") as string,
      contact_email: formData.get("contact_email") as string,
      contact_phone: formData.get("contact_phone") as string,
      notification_email: formData.get("notification_email") as string,
      notification_sms: formData.get("notification_sms") === "on",
      widget_enabled: formData.get("widget_enabled") === "on",
    };
    updateMutation.mutate(payload);
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Ayarlar</h1>
          <p className="page-subtitle">
            {t("common.hotel")} bilgileri, bildirim tercihleri ve widget ayarlarını buradan yönetebilirsiniz.
          </p>
        </div>
        <div className="page-actions">
          {!isEditing && (
            <button type="button" className="btn btn--primary" onClick={() => setIsEditing(true)}>
              Düzenle
            </button>
          )}
        </div>
      </div>

      {settingsQuery.isLoading ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">Ayarlar yükleniyor</h3>
            <p>Lütfen bekleyin...</p>
          </div>
        </div>
      ) : settingsQuery.isError ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">Ayarlar alınamadı</h3>
            <p>Sayfayı yenileyerek tekrar deneyin.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Genel Bilgiler */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Genel Bilgiler</h2>
                <p className="panel__subtitle">
                  {t("common.hotel")} adı, iletişim bilgileri ve temel ayarlar
                </p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="form-field">
                <span className="form-field__label">{t("common.hotel")} Adı</span>
                <input
                  type="text"
                  name="tenant_name"
                  defaultValue={settingsQuery.data?.tenant_name ?? ""}
                  disabled={!isEditing}
                  required
                />
                <small className="form-field__hint">
                  {t("common.hotel")} adı müşteriler tarafından görülebilir
                </small>
              </label>

              <label className="form-field">
                <span className="form-field__label">İletişim E-postası</span>
                <input
                  type="email"
                  name="contact_email"
                  defaultValue={settingsQuery.data?.contact_email ?? ""}
                  disabled={!isEditing}
                  required
                />
                <small className="form-field__hint">
                  Sistem bildirimleri ve destek için kullanılacak e-posta
                </small>
              </label>

              <label className="form-field">
                <span className="form-field__label">İletişim Telefonu</span>
                <input
                  type="tel"
                  name="contact_phone"
                  defaultValue={settingsQuery.data?.contact_phone ?? ""}
                  disabled={!isEditing}
                  placeholder="+90 555 123 45 67"
                />
              </label>

              {isEditing && (
                <div className="form-actions form-grid__field--full">
                  <button
                    type="button"
                    className="btn btn--ghost-dark"
                    onClick={() => setIsEditing(false)}
                    disabled={updateMutation.isPending}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Bildirim Ayarları */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Bildirim Ayarları</h2>
                <p className="panel__subtitle">
                  E-posta ve SMS bildirim tercihlerinizi yönetin
                </p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="form-field">
                <span className="form-field__label">Bildirim E-postası</span>
                <input
                  type="email"
                  name="notification_email"
                  defaultValue={settingsQuery.data?.notification_email ?? ""}
                  disabled={!isEditing}
                />
                <small className="form-field__hint">
                  Rezervasyon ve ödeme bildirimleri bu adrese gönderilir
                </small>
              </label>

              <label className="form-field form-field--inline">
                <span className="form-field__label">SMS Bildirimleri</span>
                <input
                  type="checkbox"
                  name="notification_sms"
                  defaultChecked={settingsQuery.data?.notification_sms ?? false}
                  disabled={!isEditing}
                />
                <small className="form-field__hint">
                  Önemli işlemler için SMS bildirimi gönder
                </small>
              </label>

              {isEditing && (
                <div className="form-actions form-grid__field--full">
                  <button
                    type="button"
                    className="btn btn--ghost-dark"
                    onClick={() => setIsEditing(false)}
                    disabled={updateMutation.isPending}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Widget Ayarları */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Widget Ayarları</h2>
                <p className="panel__subtitle">
                  Rezervasyon widget'ı ve entegrasyon ayarları
                </p>
              </div>
            </div>
            <div className="panel__body">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <strong>Widget Durumu:</strong>{" "}
                  <span className={settingsQuery.data?.widget_enabled ? "badge badge--success" : "badge badge--muted"}>
                    {settingsQuery.data?.widget_enabled ? "Aktif" : "Pasif"}
                  </span>
                </div>
                {settingsQuery.data?.widget_public_key && (
                  <div>
                    <strong>Widget Public Key:</strong>{" "}
                    <code style={{ background: "var(--color-surface)", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
                      {settingsQuery.data.widget_public_key}
                    </code>
                  </div>
                )}
                <div>
                  <a href="/app/widget-preview" className="action-link">
                    Widget Önizleme ve Embed Kodları →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Ödeme Ayarları */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Ödeme Ayarları</h2>
                <p className="panel__subtitle">
                  Ödeme modu ve komisyon oranı bilgileri (salt okunur)
                </p>
              </div>
            </div>
            <div className="panel__body">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <strong>Ödeme Modu:</strong>{" "}
                  <span className="badge">
                    {settingsQuery.data?.payment_mode === "GATEWAY_DEMO"
                      ? "Gateway Demo"
                      : settingsQuery.data?.payment_mode === "POS"
                        ? "POS"
                        : settingsQuery.data?.payment_mode ?? "-"}
                  </span>
                </div>
                <div>
                  <strong>Komisyon Oranı:</strong> {settingsQuery.data?.commission_rate ?? 5.0}%
                </div>
                <p className="table-cell-muted">
                  Bu ayarlar sistem yöneticisi tarafından yönetilmektedir. Değişiklik için destek ekibi ile iletişime geçin.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
