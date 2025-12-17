import { useTranslation } from "../../../hooks/useTranslation";
import { useToast } from "../../../hooks/useToast";
import { ToastContainer } from "../../../components/common/ToastContainer";

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const { messages } = useToast();

  return (
    <section className="page">
      <ToastContainer messages={messages} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("nav.systemSettings")}</h1>
          <p className="page-subtitle">{t("admin.settings.subtitle")}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">{t("admin.settings.email.title")}</h3>
            <p className="panel__subtitle">{t("admin.settings.email.subtitle")}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label className="form-field">
            <span className="form-field__label">{t("admin.settings.email.provider")}</span>
            <select disabled style={{ opacity: 0.6 }}>
              <option value="log">Log (Development)</option>
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
              <option value="mailgun">Mailgun</option>
            </select>
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Şu anda: Log (Development) - Gerçek email gönderilmiyor
            </small>
          </label>
          <label className="form-field">
            <span className="form-field__label">Gönderen Email Adresi</span>
            <input type="email" value="noreply@kyradi.com" disabled style={{ opacity: 0.6 }} />
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Tüm sistem email'leri bu adresten gönderilir
            </small>
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">SMS Servisi Ayarları</h3>
            <p className="panel__subtitle">SMS gönderimi için kullanılan servis konfigürasyonu</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label className="form-field">
            <span className="form-field__label">{t("admin.settings.sms.provider")}</span>
            <select disabled style={{ opacity: 0.6 }}>
              <option value="log">Log (Development)</option>
              <option value="iletimerkezi">İleti Merkezi</option>
              <option value="twilio">Twilio</option>
            </select>
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Şu anda: Log (Development) - Gerçek SMS gönderilmiyor
            </small>
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h3 className="panel__title">Ödeme Gateway Ayarları</h3>
            <p className="panel__subtitle">Ödeme işlemleri için kullanılan gateway konfigürasyonu</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label className="form-field">
            <span className="form-field__label">{t("admin.settings.payment.provider")}</span>
            <select disabled style={{ opacity: 0.6 }}>
              <option value="MAGIC_PAY">MagicPay</option>
              <option value="iyzico">iyzico</option>
              <option value="stripe">Stripe</option>
              <option value="paytr">PAYTR</option>
            </select>
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Şu anda: MagicPay
            </small>
          </label>
          <label className="form-field">
            <span className="form-field__label">Payment Mode</span>
            <select disabled style={{ opacity: 0.6 }}>
              <option value="demo_local">Demo / Local</option>
              <option value="gateway_demo">Gateway Demo</option>
              <option value="gateway_live">Gateway Live (Production)</option>
            </select>
            <small style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Şu anda: Demo / Local - Test modunda çalışıyor
            </small>
          </label>
        </div>
      </div>

      <div className="panel">
        <div style={{ padding: "1.5rem", background: "rgba(59, 130, 246, 0.05)", borderRadius: "var(--radius-lg)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
          <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            <strong>Not:</strong> Bu ayarlar şu anda read-only modda gösterilmektedir. Gerçek konfigürasyon
            değişiklikleri için sistem yöneticisi ile iletişime geçin veya environment değişkenlerini güncelleyin.
          </p>
        </div>
      </div>
    </section>
  );
}

