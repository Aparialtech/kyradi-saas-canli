import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import {
  partnerSettingsService,
  type PartnerSettings,
  type PartnerSettingsUpdatePayload,
} from "../../../services/partner/settings";

type FormValues = {
  tenant_name: string;
  contact_email: string;
  contact_phone: string;
  brand_color: string;
  logo_url: string;
  notification_email: string;
  notification_sms: boolean;
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      tenant_name: "",
      contact_email: "",
      contact_phone: "",
      brand_color: "",
      logo_url: "",
      notification_email: "",
      notification_sms: false,
    },
  });

  // Sync form values when settings are loaded
  useEffect(() => {
    if (settingsQuery.data) {
      reset({
        tenant_name: settingsQuery.data.tenant_name || "",
        contact_email: settingsQuery.data.contact_email || "",
        contact_phone: settingsQuery.data.contact_phone || "",
        brand_color: settingsQuery.data.brand_color || "",
        logo_url: settingsQuery.data.logo_url || "",
        notification_email: settingsQuery.data.notification_email || "",
        notification_sms: settingsQuery.data.notification_sms || false,
      });
    }
  }, [settingsQuery.data, reset]);

  const updateMutation = useMutation({
    mutationFn: (payload: PartnerSettingsUpdatePayload) =>
      partnerSettingsService.updateSettings(payload),
    onSuccess: (data: PartnerSettings) => {
      void queryClient.invalidateQueries({ queryKey: ["partner", "settings"] });
      push({ title: t("common.saveSuccess" as any) || "Ayarlar kaydedildi", type: "success" });
      setIsEditing(false);
      // Update form with returned values
      reset({
        tenant_name: data.tenant_name || "",
        contact_email: data.contact_email || "",
        contact_phone: data.contact_phone || "",
        brand_color: data.brand_color || "",
        logo_url: data.logo_url || "",
        notification_email: data.notification_email || "",
        notification_sms: data.notification_sms || false,
      });
    },
    onError: (error: unknown) => {
      push({
        title: t("common.saveError" as any) || "Kaydetme başarısız",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const onSubmit = handleSubmit((values) => {
    const payload: PartnerSettingsUpdatePayload = {};
    
    // Only include changed fields
    if (values.tenant_name !== settingsQuery.data?.tenant_name) {
      payload.tenant_name = values.tenant_name;
    }
    if (values.contact_email !== settingsQuery.data?.contact_email) {
      payload.contact_email = values.contact_email;
    }
    if (values.contact_phone !== settingsQuery.data?.contact_phone) {
      payload.contact_phone = values.contact_phone;
    }
    if (values.brand_color !== settingsQuery.data?.brand_color) {
      payload.brand_color = values.brand_color;
    }
    if (values.logo_url !== settingsQuery.data?.logo_url) {
      payload.logo_url = values.logo_url;
    }
    if (values.notification_email !== settingsQuery.data?.notification_email) {
      payload.notification_email = values.notification_email;
    }
    if (values.notification_sms !== settingsQuery.data?.notification_sms) {
      payload.notification_sms = values.notification_sms;
    }

    updateMutation.mutate(payload);
  });

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form to original values
    if (settingsQuery.data) {
      reset({
        tenant_name: settingsQuery.data.tenant_name || "",
        contact_email: settingsQuery.data.contact_email || "",
        contact_phone: settingsQuery.data.contact_phone || "",
        brand_color: settingsQuery.data.brand_color || "",
        logo_url: settingsQuery.data.logo_url || "",
        notification_email: settingsQuery.data.notification_email || "",
        notification_sms: settingsQuery.data.notification_sms || false,
      });
    }
  };

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.settings")}</h1>
          <p className="page-subtitle">
            {t("common.hotel")} bilgileri, bildirim tercihleri ve widget ayarlarını buradan yönetebilirsiniz.
          </p>
        </div>
        <div className="page-actions">
          {!isEditing && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setIsEditing(true)}
              disabled={settingsQuery.isLoading}
            >
              {t("common.edit")}
            </button>
          )}
        </div>
      </div>

      {settingsQuery.isLoading ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h3 className="empty-state__title">{t("common.loading")}</h3>
            <p>Ayarlar yükleniyor...</p>
          </div>
        </div>
      ) : settingsQuery.isError ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 className="empty-state__title">{t("common.error")}</h3>
            <p>{getErrorMessage(settingsQuery.error)}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => settingsQuery.refetch()}
              style={{ marginTop: "1rem" }}
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          {/* Genel Bilgiler */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Genel Bilgiler</h2>
                <p className="panel__subtitle">
                  {t("common.hotel")} adı, iletişim bilgileri ve marka ayarları
                </p>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span className="form-field__label">
                  {t("common.hotel")} Adı <span style={{ color: "var(--color-danger)" }}>*</span>
                </span>
                <input
                  type="text"
                  {...register("tenant_name", { required: "Otel adı zorunludur" })}
                  disabled={!isEditing}
                />
                {errors.tenant_name && (
                  <span className="field-error">{errors.tenant_name.message}</span>
                )}
                <small className="form-field__hint">
                  {t("common.hotel")} adı müşteriler tarafından görülebilir
                </small>
              </label>

              <label className="form-field">
                <span className="form-field__label">Kısa Ad (Slug)</span>
                <input
                  type="text"
                  value={settingsQuery.data?.tenant_slug ?? ""}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
                <small className="form-field__hint">
                  URL'de kullanılan tanımlayıcı (değiştirilemez)
                </small>
              </label>

              <label className="form-field">
                <span className="form-field__label">İletişim E-postası</span>
                <input
                  type="email"
                  {...register("contact_email")}
                  disabled={!isEditing}
                  placeholder="iletisim@otel.com"
                />
                <small className="form-field__hint">
                  Sistem bildirimleri ve destek için kullanılacak e-posta
                </small>
              </label>

              <label className="form-field">
                <span className="form-field__label">İletişim Telefonu</span>
                <input
                  type="tel"
                  {...register("contact_phone")}
                  disabled={!isEditing}
                  placeholder="+90 555 123 45 67"
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Marka Rengi</span>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="color"
                    {...register("brand_color")}
                    disabled={!isEditing}
                    style={{ width: "50px", height: "38px", padding: "0.25rem", cursor: isEditing ? "pointer" : "not-allowed" }}
                  />
                  <input
                    type="text"
                    {...register("brand_color")}
                    disabled={!isEditing}
                    placeholder="#0F172A"
                    style={{ flex: 1 }}
                  />
                </div>
                <small className="form-field__hint">
                  Widget ve e-postalarda kullanılacak marka rengi
                </small>
              </label>

              <label className="form-field">
                <span className="form-field__label">Logo URL</span>
                <input
                  type="url"
                  {...register("logo_url")}
                  disabled={!isEditing}
                  placeholder="https://example.com/logo.png"
                />
                <small className="form-field__hint">
                  Widget ve e-postalarda görüntülenecek logo
                </small>
              </label>
            </div>
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
            <div className="form-grid">
              <label className="form-field">
                <span className="form-field__label">Bildirim E-postası</span>
                <input
                  type="email"
                  {...register("notification_email")}
                  disabled={!isEditing}
                  placeholder="bildirim@otel.com"
                />
                <small className="form-field__hint">
                  Rezervasyon ve ödeme bildirimleri bu adrese gönderilir
                </small>
              </label>

              <label className="form-field form-field--inline" style={{ alignItems: "center" }}>
                <input
                  type="checkbox"
                  {...register("notification_sms")}
                  disabled={!isEditing}
                />
                <span className="form-field__label" style={{ marginBottom: 0 }}>
                  SMS Bildirimleri
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          {isEditing && (
            <div className="panel">
              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn--ghost-dark"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={updateMutation.isPending || !isDirty}
                >
                  {updateMutation.isPending ? "Kaydediliyor..." : t("common.save")}
                </button>
              </div>
            </div>
          )}

          {/* Widget Ayarları (Read-only) */}
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
                  <span
                    className={
                      settingsQuery.data?.widget_enabled
                        ? "badge badge--success"
                        : "badge badge--muted"
                    }
                  >
                    {settingsQuery.data?.widget_enabled ? "Aktif" : "Pasif"}
                  </span>
                </div>
                {settingsQuery.data?.widget_public_key && (
                  <div>
                    <strong>Widget Public Key:</strong>{" "}
                    <code
                      style={{
                        background: "var(--color-surface)",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                      }}
                    >
                      {settingsQuery.data.widget_public_key}
                    </code>
                  </div>
                )}
                <div>
                  <a href="/partner/widget-preview" className="action-link">
                    Widget Önizleme ve Embed Kodları →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Ödeme Ayarları (Read-only) */}
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
                  <strong>Komisyon Oranı:</strong> %{settingsQuery.data?.commission_rate ?? 5.0}
                </div>
                <p className="table-cell-muted">
                  Bu ayarlar sistem yöneticisi tarafından yönetilmektedir. Değişiklik için destek
                  ekibi ile iletişime geçin.
                </p>
              </div>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
