import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { motion } from "framer-motion";
import { Settings, AlertCircle, Loader2, Edit, Save, X, Globe, ExternalLink } from "../../../lib/lucide";

import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";
import { getErrorMessage } from "../../../lib/httpError";
import { useTranslation } from "../../../hooks/useTranslation";
import {
  partnerSettingsService,
  type PartnerSettings,
  type PartnerSettingsUpdatePayload,
} from "../../../services/partner/settings";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { ModernInput } from "../../../components/ui/ModernInput";
import { Badge } from "../../../components/ui/Badge";

type FormValues = {
  tenant_name: string;
  legal_name: string;
  tax_id: string;
  tax_office: string;
  contact_email: string;
  contact_phone: string;
  brand_color: string;
  logo_url: string;
  notification_email: string;
  notification_sms: boolean;
  custom_domain: string;
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
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      tenant_name: "",
      legal_name: "",
      tax_id: "",
      tax_office: "",
      contact_email: "",
      contact_phone: "",
      brand_color: "#0F172A",
      logo_url: "",
      notification_email: "",
      notification_sms: false,
      custom_domain: "",
    },
  });

  // Watch for live previews
  const watchedBrandColor = useWatch({ control, name: "brand_color" });
  const watchedLogoUrl = useWatch({ control, name: "logo_url" });
  const watchedTenantName = useWatch({ control, name: "tenant_name" });
  const [logoError, setLogoError] = useState(false);

  // Sync form values when settings are loaded
  useEffect(() => {
    if (settingsQuery.data) {
      reset({
        tenant_name: settingsQuery.data.tenant_name || "",
        legal_name: settingsQuery.data.legal_name || "",
        tax_id: settingsQuery.data.tax_id || "",
        tax_office: settingsQuery.data.tax_office || "",
        contact_email: settingsQuery.data.contact_email || "",
        contact_phone: settingsQuery.data.contact_phone || "",
        brand_color: settingsQuery.data.brand_color || "",
        logo_url: settingsQuery.data.logo_url || "",
        notification_email: settingsQuery.data.notification_email || "",
        notification_sms: settingsQuery.data.notification_sms || false,
        custom_domain: settingsQuery.data.custom_domain || "",
      });
    }
  }, [settingsQuery.data, reset]);

  const updateMutation = useMutation({
    mutationFn: (payload: PartnerSettingsUpdatePayload) =>
      partnerSettingsService.updateSettings(payload),
    onSuccess: (data: PartnerSettings) => {
      void queryClient.invalidateQueries({ queryKey: ["partner", "settings"] });
      push({ title: t("settings.saveSuccess"), type: "success" });
      setIsEditing(false);
      // Update form with returned values
      reset({
        tenant_name: data.tenant_name || "",
        legal_name: data.legal_name || "",
        tax_id: data.tax_id || "",
        tax_office: data.tax_office || "",
        contact_email: data.contact_email || "",
        contact_phone: data.contact_phone || "",
        brand_color: data.brand_color || "",
        logo_url: data.logo_url || "",
        notification_email: data.notification_email || "",
        notification_sms: data.notification_sms || false,
        custom_domain: data.custom_domain || "",
      }, { keepDirty: false });
    },
    onError: (error: unknown) => {
      push({
        title: t("settings.saveError"),
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const onSubmit = handleSubmit((values) => {
    const payload: PartnerSettingsUpdatePayload = {
      tenant_name: values.tenant_name,
      legal_name: values.legal_name || undefined,
      tax_id: values.tax_id || undefined,
      tax_office: values.tax_office || undefined,
      contact_email: values.contact_email || undefined,
      contact_phone: values.contact_phone || undefined,
      brand_color: values.brand_color || undefined,
      logo_url: values.logo_url || undefined,
      notification_email: values.notification_email || undefined,
      notification_sms: values.notification_sms || false,
      custom_domain: values.custom_domain.trim() ? values.custom_domain.trim() : null,
    };

    updateMutation.mutate(payload);
  });

  const verifyMutation = useMutation({
    mutationFn: () => partnerSettingsService.verifyDomain(),
    onSuccess: async () => {
      push({ title: "Domain doğrulandı", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["partner", "settings"] });
    },
    onError: (error: unknown) => {
      push({
        title: "Domain doğrulama başarısız",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form to original values
    if (settingsQuery.data) {
      reset({
        tenant_name: settingsQuery.data.tenant_name || "",
        legal_name: settingsQuery.data.legal_name || "",
        tax_id: settingsQuery.data.tax_id || "",
        tax_office: settingsQuery.data.tax_office || "",
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
    <div style={{ padding: 'var(--space-8)', maxWidth: '1600px', margin: '0 auto' }}>
      <ToastContainer messages={messages} />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Settings className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-black)', color: 'var(--text-primary)', margin: 0 }}>
              {t("settings.title")}
            </h1>
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', margin: 0 }}>
            {t("settings.subtitle")}
          </p>
        </div>
        {!isEditing && (
          <ModernButton
            variant="primary"
            onClick={() => setIsEditing(true)}
            disabled={settingsQuery.isLoading}
            leftIcon={<Edit className="h-4 w-4" />}
          >
            {t("common.edit")}
          </ModernButton>
        )}
      </motion.div>

      {settingsQuery.isLoading && !settingsQuery.data ? (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-12 w-12" style={{ margin: '0 auto var(--space-4) auto', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.loading")}</h3>
            <p style={{ margin: 'var(--space-2) 0 0 0' }}>{t("settings.loading")}</p>
          </div>
        </ModernCard>
      ) : settingsQuery.isError ? (
        <ModernCard variant="glass" padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--danger-500)' }}>
            <AlertCircle className="h-12 w-12" style={{ margin: "0 auto var(--space-4) auto" }} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{t("common.error")}</h3>
            <p style={{ margin: 'var(--space-2) 0 var(--space-4) 0' }}>{getErrorMessage(settingsQuery.error)}</p>
            <ModernButton variant="primary" onClick={() => settingsQuery.refetch()}>
              {t("common.retry")}
            </ModernButton>
          </div>
        </ModernCard>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Genel Bilgiler */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                {t("settings.generalInfoTitle")}
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                {t("settings.generalInfoSubtitle")}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              <ModernInput
                label={t("settings.hotelName")}
                {...register("tenant_name", { required: t("settings.hotelNameRequired") })}
                disabled={!isEditing}
                placeholder={t("settings.hotelNamePlaceholder")}
                error={errors.tenant_name?.message}
                helperText={t("settings.hotelNameHint")}
                required
                fullWidth
              />

              <ModernInput
                label={t("settings.shortName")}
                value={settingsQuery.data?.tenant_slug ?? ""}
                disabled
                helperText={t("settings.shortNameHint")}
                fullWidth
              />

              <ModernInput
                label="Yasal Ünvan"
                {...register("legal_name")}
                disabled={!isEditing}
                placeholder="Şirket Yasal Ünvanı"
                helperText="Fatura ve resmi belgelerde kullanılacak yasal ünvan"
                fullWidth
              />

              <ModernInput
                label="Vergi Numarası"
                {...register("tax_id")}
                disabled={!isEditing}
                placeholder="1234567890"
                helperText="10 haneli vergi numarası"
                fullWidth
              />

              <ModernInput
                label="Vergi Dairesi"
                {...register("tax_office")}
                disabled={!isEditing}
                placeholder="Kadıköy Vergi Dairesi"
                helperText="Bağlı bulunulan vergi dairesi"
                fullWidth
              />

              <ModernInput
                label={t("settings.contactEmail")}
                type="email"
                {...register("contact_email")}
                disabled={!isEditing}
                placeholder="iletisim@otel.com"
                helperText={t("settings.contactEmailHint")}
                fullWidth
              />

              <ModernInput
                label="İletişim Telefonu"
                type="tel"
                {...register("contact_phone")}
                disabled={!isEditing}
                placeholder="+90 555 123 45 67"
                fullWidth
              />

              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Marka Rengi
                </label>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <input
                    type="color"
                    {...register("brand_color")}
                    disabled={!isEditing}
                    style={{ width: "50px", height: "38px", padding: "0.25rem", borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', cursor: isEditing ? "pointer" : "not-allowed" }}
                  />
                  <ModernInput
                    {...register("brand_color")}
                    disabled={!isEditing}
                    placeholder="#0F172A"
                    helperText="Widget ve e-postalarda kullanılacak marka rengi"
                    fullWidth
                  />
                </div>
              </div>

              <ModernInput
                label="Logo URL"
                type="url"
                {...register("logo_url")}
                disabled={!isEditing}
                placeholder="https://example.com/logo.png"
                helperText="Widget ve e-postalarda görüntülenecek logo"
                onChange={(e) => {
                  setLogoError(false);
                  register("logo_url").onChange(e);
                }}
                fullWidth
              />
            </div>
          </ModernCard>

          {/* Marka Önizleme */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Marka Önizleme
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Logo ve renk ayarlarınızın canlı önizlemesi
              </p>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  gap: "2rem",
                  alignItems: "center",
                  padding: "1.5rem",
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {/* Logo Preview */}
                <div style={{ flexShrink: 0 }}>
                  {watchedLogoUrl && !logoError ? (
                    <img
                      src={watchedLogoUrl}
                      alt="Logo Preview"
                      style={{
                        maxWidth: "120px",
                        maxHeight: "60px",
                        objectFit: "contain",
                        borderRadius: "var(--radius-sm)",
                      }}
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div
                      style={{
                        width: "120px",
                        height: "60px",
                        background: "var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {logoError ? "Logo yüklenemedi" : "Logo yok"}
                    </div>
                  )}
                </div>

                {/* Brand Color Sample */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        backgroundColor: watchedBrandColor || "#0F172A",
                        borderRadius: "var(--radius-sm)",
                        border: "2px solid var(--color-border)",
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1.125rem" }}>
                        {watchedTenantName || "Otel Adı"}
                      </div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
                        Marka rengi: {watchedBrandColor || "#0F172A"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      backgroundColor: watchedBrandColor || "#0F172A",
                      color: "#fff",
                      border: "none",
                      marginTop: "0.5rem",
                    }}
                  >
                    Örnek Buton
                  </button>
                </div>
              </div>
            </div>
          </ModernCard>

          {/* Custom Domain */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Custom Domain
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Panel adresinizi kendi domaininize bağlayın.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <ModernInput
                label="Custom Domain"
                {...register("custom_domain")}
                disabled={!isEditing}
                placeholder="panel.oteliniz.com"
                helperText="Örn: panel.oteliniz.com (http/https ve / kullanmayın)"
                fullWidth
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Badge variant={settingsQuery.data?.domain_status === "verified" ? "success" : settingsQuery.data?.domain_status === "failed" ? "danger" : settingsQuery.data?.domain_status === "pending" ? "warning" : "neutral"}>
                  {settingsQuery.data?.domain_status === "verified"
                    ? "Doğrulandı"
                    : settingsQuery.data?.domain_status === "failed"
                      ? "Doğrulama Başarısız"
                      : settingsQuery.data?.domain_status === "pending"
                        ? "Beklemede"
                        : "Doğrulanmadı"}
                </Badge>

                <ModernButton
                  variant="outline"
                  type="button"
                  onClick={() => verifyMutation.mutate()}
                  disabled={!settingsQuery.data?.custom_domain || verifyMutation.isPending}
                  leftIcon={<Globe className="h-4 w-4" />}
                >
                  DNS’i Kontrol Et
                </ModernButton>

                <a
                  href="/app/docs/domain-kurulumu"
                  style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600, fontSize: 'var(--text-sm)' }}
                >
                  Domain Kurulum Rehberi →
                </a>
              </div>
            </div>
          </ModernCard>

          {/* Bildirim Ayarları */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Bildirim Ayarları
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                E-posta ve SMS bildirim tercihlerinizi yönetin
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <ModernInput
                label="Bildirim E-postası"
                type="email"
                {...register("notification_email")}
                disabled={!isEditing}
                placeholder="bildirim@otel.com"
                helperText="Rezervasyon ve ödeme bildirimleri bu adrese gönderilir"
                fullWidth
              />

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
                <input
                  type="checkbox"
                  {...register("notification_sms")}
                  disabled={!isEditing}
                  style={{ width: "20px", height: "20px", cursor: isEditing ? "pointer" : "not-allowed" }}
                />
                <label style={{ margin: 0, cursor: isEditing ? "pointer" : "default", fontWeight: 500 }}>
                  SMS Bildirimleri
                </label>
              </div>
            </div>
          </ModernCard>

          {/* Form Actions */}
          {isEditing && (
            <ModernCard variant="glass" padding="lg">
              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                <ModernButton
                  type="button"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  {t("common.cancel")}
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  disabled={updateMutation.isPending || !isDirty}
                  isLoading={updateMutation.isPending}
                  loadingText="Kaydediliyor..."
                  leftIcon={!updateMutation.isPending && <Save className="h-4 w-4" />}
                >
                  {t("common.save")}
                </ModernButton>
              </div>
            </ModernCard>
          )}

          {/* Widget Ayarları (Read-only) */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Widget Ayarları
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Rezervasyon widget'ı ve entegrasyon ayarları
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Widget Durumu:</strong>{" "}
                <Badge variant={settingsQuery.data?.widget_enabled ? "success" : "neutral"}>
                  {settingsQuery.data?.widget_enabled ? "Aktif" : "Pasif"}
                </Badge>
              </div>
              {settingsQuery.data?.widget_public_key && (
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Widget Public Key:</strong>{" "}
                  <code
                    style={{
                      background: "var(--bg-tertiary)",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "monospace",
                      fontSize: "var(--text-sm)",
                      color: 'var(--text-primary)',
                    }}
                  >
                    {settingsQuery.data.widget_public_key}
                  </code>
                </div>
              )}
              <div>
                <a href="/app/widget-preview" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                  Widget Önizleme ve Embed Kodları →
                </a>
              </div>
            </div>
          </ModernCard>

          {/* Ödeme Ayarları (Read-only) */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: '0 0 var(--space-2) 0' }}>
                Ödeme Ayarları
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Ödeme modu ve komisyon oranı bilgileri (salt okunur)
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Ödeme Modu:</strong>{" "}
                <Badge>
                  {settingsQuery.data?.payment_mode === "GATEWAY_DEMO"
                    ? "Gateway Demo"
                    : settingsQuery.data?.payment_mode === "POS"
                      ? "POS"
                      : settingsQuery.data?.payment_mode ?? "-"}
                </Badge>
              </div>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Komisyon Oranı:</strong> %{settingsQuery.data?.commission_rate ?? 5.0}
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                Bu ayarlar sistem yöneticisi tarafından yönetilmektedir. Değişiklik için destek
                ekibi ile iletişime geçin.
              </p>
            </div>
          </ModernCard>

          {/* Domain Kurulum Rehberi */}
          <ModernCard variant="glass" padding="lg">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <Globe className="h-5 w-5" style={{ color: '#6366f1' }} />
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', margin: 0 }}>
                    Domain Kurulum Rehberi
                  </h2>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Kendi domaininizi (örn: panel.oteliniz.com) Kyradi'ye nasıl bağlayacağınızı öğrenin.
                  Adım adım DNS ayarları ve SSS.
                </p>
              </div>
              <a 
                href="/app/docs/domain-kurulumu" 
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Rehberi Aç
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </ModernCard>
        </form>
      )}
    </div>
  );
}
