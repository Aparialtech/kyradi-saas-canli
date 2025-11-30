import axios from "axios";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import type { AuthUser } from "../../types/auth";
import { authService } from "../../services/auth";
import { useTranslation } from "../../hooks/useTranslation";
import { tokenStorage } from "../../lib/tokenStorage";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  const [tenantSlug, setTenantSlug] = useState<string>("demo-hotel");
  const [email, setEmail] = useState<string>("admin@demo.com");
  const [password, setPassword] = useState<string>("Kyradi!2025");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showResetPanel, setShowResetPanel] = useState<boolean>(false);
  const [resetSubmitting, setResetSubmitting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string>("");
  const [resetError, setResetError] = useState<string>("");
  const [resetEmail, setResetEmail] = useState<string>(email);
  const [resetTenantSlug, setResetTenantSlug] = useState<string>(tenantSlug);

  const handleSuccessRedirect = useCallback(
    (authenticatedUser: AuthUser) => {
      if (authenticatedUser.role === "super_admin" || authenticatedUser.role === "support") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!isLoading && user) {
      handleSuccessRedirect(user);
    }
  }, [handleSuccessRedirect, isLoading, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await authService.login({
        email,
        password,
        tenant_slug: tenantSlug?.trim() ? tenantSlug.trim() : undefined,
      });
      
      // Check if SMS verification is required
      if (response.status === "phone_verification_required" && response.verification_id) {
        // Redirect to SMS verification page
        navigate("/verify-sms", {
          state: { verification_id: response.verification_id },
          replace: true,
        });
        return;
      }
      
      // Normal login flow - token already received, just get user
      if (response.access_token) {
        tokenStorage.set(response.access_token);
        
        // Get user and update context
        const currentUser = await authService.getCurrentUser();
        
        // Manually update auth context by reloading
        window.location.href = currentUser.role === "super_admin" || currentUser.role === "support" 
          ? "/admin" 
          : "/app";
      } else {
        setError("Giriş başarısız. Lütfen tekrar deneyin.");
      }
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let message = "Giriş başarısız. Bilgilerinizi kontrol edin.";

        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail)) {
          const first = detail[0];
          if (first && typeof first === "object" && "msg" in first) {
            message = String(first.msg);
          } else {
            message = detail.map((item) => JSON.stringify(item)).join(", ");
          }
        }

        setError(message);
      } else {
        setError("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError("");
    setResetMessage("");
    setResetSubmitting(true);
    try {
      const response = await authService.requestPasswordReset({
        email: resetEmail,
        tenant_slug: resetTenantSlug?.trim() || undefined,
      });
      
      let message = response.message;
      
      // Development modunda token varsa göster ve link oluştur
      if (response.reset_token) {
        const resetUrl = `${window.location.origin}/reset-password?token=${response.reset_token}`;
        message = `✅ Şifre sıfırlama linki oluşturuldu!\n\n🔗 Development Modu - Link:\n${resetUrl}\n\n💡 Not: Development modunda email gönderilmiyor. Linki kopyalayıp tarayıcıda açabilirsiniz.`;
        
        // Linki otomatik kopyala
        try {
          await navigator.clipboard.writeText(resetUrl);
          message += "\n\n✅ Link panoya kopyalandı!";
        } catch {
          // Clipboard erişimi yoksa devam et
        }
      }
      
      setResetMessage(message);
      
      // Close reset panel after showing message (daha uzun süre göster)
      setTimeout(() => {
        setShowResetPanel(false);
      }, 10000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        setResetError(typeof detail === "string" ? detail : "Şifre sıfırlama başarısız.");
      } else {
        setResetError("Şifre sıfırlanırken beklenmeyen bir hata oluştu.");
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__locale">
        <LanguageSwitcher />
      </div>
      <div className="auth-card">
        <header className="auth-card__header">
          <div className="auth-card__brand">KYRADİ</div>
          <h1 className="auth-card__title">{t("login.title")}</h1>
          <p className="auth-card__subtitle">{t("login.subtitle")}</p>
        </header>

        {error && <div className="auth-card__error">{error}</div>}

        <form className="auth-card__form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-field__label">{t("login.tenantLabel")}</span>
            <input
              id="tenant"
              placeholder={t("login.tenantPlaceholder")}
              value={tenantSlug}
              onChange={(event) => setTenantSlug(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">{t("login.emailLabel")}</span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">{t("login.passwordLabel")}</span>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <div className="form-actions">
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? t("login.submitting") : t("login.submit")}
            </button>
          </div>
        </form>
        <div className="auth-card__helper">
          <button
            type="button"
            className="auth-link-button"
            onClick={() => {
              setShowResetPanel((prev) => !prev);
              setResetEmail(email);
              setResetTenantSlug(tenantSlug);
              setResetError("");
              setResetMessage("");
            }}
          >
            {t("login.forgot")}
          </button>
        </div>

        {showResetPanel && (
          <form className="auth-card__form auth-card__form--secondary" onSubmit={handleForgotPassword}>
            <h2 className="auth-card__subtitle" style={{ marginBottom: "0.5rem" }}>
              {t("login.resetTitle")}
            </h2>
            <label className="form-field">
              <span className="form-field__label">{t("login.resetTenantLabel")}</span>
              <input
                value={resetTenantSlug}
                onChange={(event) => setResetTenantSlug(event.target.value)}
                placeholder={t("login.resetTenantPlaceholder")}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t("login.resetEmailLabel")}</span>
              <input
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                required
              />
            </label>
            {resetError && <div className="auth-card__error">{resetError}</div>}
            {resetMessage && (
              <div className="auth-card__success" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {resetMessage}
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn--ghost" type="submit" disabled={resetSubmitting}>
                {resetSubmitting ? t("login.resetSubmitting") : t("login.resetButton")}
              </button>
            </div>
          </form>
        )}

        <footer className="auth-card__footer">
          <p>{t("login.footerNote")}</p>
        </footer>
      </div>
    </div>
  );
}
