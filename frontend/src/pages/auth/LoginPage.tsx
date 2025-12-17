import axios from "axios";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import type { AuthUser } from "../../types/auth";
import { authService } from "../../services/auth";
import { useTranslation } from "../../hooks/useTranslation";
import { tokenStorage } from "../../lib/tokenStorage";
import { Lock, Mail, Building2, BarChart3, CreditCard, Eye, EyeOff, Database, UserCog } from "../../lib/lucide";
import styles from "./LoginPage.module.css";

type LoginMode = "partner" | "admin";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  const [mode, setMode] = useState<LoginMode>("partner");
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
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
        tenant_slug: mode === "partner" && tenantSlug?.trim() ? tenantSlug.trim() : undefined,
      });
      
      if (response.status === "phone_verification_required" && response.verification_id) {
        navigate("/verify-sms", {
          state: { verification_id: response.verification_id },
          replace: true,
        });
        return;
      }
      
      if (response.access_token) {
        tokenStorage.set(response.access_token);
        const currentUser = await authService.getCurrentUser();
        window.location.href = currentUser.role === "super_admin" || currentUser.role === "support" 
          ? "/admin" 
          : "/app";
      } else {
        setError(t("login.error.generic"));
      }
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let message = t("login.error.invalidCredentials");

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
        setError(t("login.error.unexpected"));
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
        tenant_slug: mode === "partner" && resetTenantSlug?.trim() ? resetTenantSlug.trim() : undefined,
      });
      
      let message = response.message;
      
      if (response.reset_token) {
        const resetUrl = `${window.location.origin}/reset-password?token=${response.reset_token}`;
        message = `Şifre sıfırlama linki oluşturuldu!\n\nDevelopment Modu - Link:\n${resetUrl}\n\nNot: Development modunda email gönderilmiyor. Linki kopyalayıp tarayıcıda açabilirsiniz.`;
        
        try {
          await navigator.clipboard.writeText(resetUrl);
          message += "\n\nLink panoya kopyalandı!";
        } catch {
          // Clipboard erişimi yoksa devam et
        }
      }
      
      setResetMessage(message);
      
      setTimeout(() => {
        setShowResetPanel(false);
      }, 10000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        setResetError(typeof detail === "string" ? detail : "Şifre sıfırlama başarısız.");
      } else {
        setResetError(t("login.resetError.unexpected"));
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      {/* Language Switcher */}
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>

      {/* Main Container */}
      <div className={styles.loginContainer}>
        {/* Branding Panel */}
        <motion.div
          className={styles.brandingPanel}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.brandingContent}>
            <motion.div
              className={styles.logo}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className={styles.logoIcon}>
                <Database className={styles.logoIconSvg} />
              </div>
              <h1 className={styles.brandName}>KYRADI</h1>
            </motion.div>

            <p className={styles.tagline}>
              Akıllı Depolama ve Rezervasyon Yönetimi
            </p>

            <div className={styles.features}>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <BarChart3 className={styles.featureIcon} />
                <span>{t("login.feature1")}</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <CreditCard className={styles.featureIcon} />
                <span>{t("login.feature2")}</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <Building2 className={styles.featureIcon} />
                <span>{t("login.feature4")}</span>
              </motion.div>
            </div>

            {/* Decorative Gradient Blob */}
            <div className={styles.gradientBlob} />
          </div>
        </motion.div>

        {/* Form Panel */}
        <motion.div
          className={styles.formPanel}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.formContent}>
            {/* Mode Toggle */}
            <div className={styles.modeToggle}>
              <motion.button
                type="button"
                className={clsx(styles.toggleButton, mode === "partner" && styles.toggleButtonActive)}
                onClick={() => setMode("partner")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Building2 className={styles.toggleIcon} />
                Partner Girişi
              </motion.button>
              <motion.button
                type="button"
                className={clsx(styles.toggleButton, mode === "admin" && styles.toggleButtonActive)}
                onClick={() => setMode("admin")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <UserCog className={styles.toggleIcon} />
                Admin Girişi
              </motion.button>
            </div>

            {/* Form */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === "partner" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "partner" ? 20 : -20 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>
                    {mode === "partner" ? "Partner Panel Girişi" : "Admin Panel Girişi"}
                  </h2>
                  <p className={styles.formSubtitle}>
                    {mode === "partner"
                      ? "Otel yönetim paneline giriş yapın"
                      : "Sistem yönetim paneline giriş yapın"}
                  </p>
                </div>

                {error && (
                  <motion.div
                    className={styles.errorMessage}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.div>
                )}

                <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
                  {mode === "partner" && (
                    <div className={styles.formField}>
                      <label className={styles.label}>
                        <Building2 className={styles.labelIcon} />
                        {t("login.tenantLabel")}
                      </label>
                    <input
                      id="tenant"
                      type="text"
                      className={styles.input}
                      placeholder={t("login.tenantPlaceholder")}
                      value={tenantSlug}
                      onChange={(event) => setTenantSlug(event.target.value)}
                      autoComplete="off"
                    />
                    </div>
                  )}

                  <div className={styles.formField}>
                    <label className={styles.label}>
                      <Mail className={styles.labelIcon} />
                      {t("login.emailLabel")}
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={styles.input}
                      autoComplete="off"
                      placeholder={mode === "partner" ? "admin@demo.com" : "admin@kyradi.com"}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.label}>
                      <Lock className={styles.labelIcon} />
                      {t("login.passwordLabel")}
                    </label>
                    <div className={styles.passwordInput}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className={styles.input}
                        autoComplete="off"
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={submitting}
                  >
                    {submitting ? t("login.submitting") : t("login.submit")}
                  </button>
                </form>

                <div className={styles.formFooter}>
                  <button
                    type="button"
                    className={styles.forgotButton}
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

                {/* Reset Password Panel */}
                <AnimatePresence>
                  {showResetPanel && (
                    <motion.form
                      className={styles.resetForm}
                      onSubmit={handleForgotPassword}
                      autoComplete="off"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h3 className={styles.resetTitle}>{t("login.resetTitle")}</h3>
                      
                      {mode === "partner" && (
                        <div className={styles.formField}>
                          <label className={styles.label}>
                            <Building2 className={styles.labelIcon} />
                            {t("login.resetTenantLabel")}
                          </label>
                          <input
                            type="text"
                            className={styles.input}
                            value={resetTenantSlug}
                            onChange={(event) => setResetTenantSlug(event.target.value)}
                            placeholder={t("login.resetTenantPlaceholder")}
                            autoComplete="off"
                          />
                        </div>
                      )}
                      
                      <div className={styles.formField}>
                        <label className={styles.label}>
                          <Mail className={styles.labelIcon} />
                          {t("login.resetEmailLabel")}
                        </label>
                        <input
                          type="email"
                          className={styles.input}
                          value={resetEmail}
                          onChange={(event) => setResetEmail(event.target.value)}
                          autoComplete="off"
                          required
                        />
                      </div>
                      
                      {resetError && (
                        <div className={styles.errorMessage}>{resetError}</div>
                      )}
                      
                      {resetMessage && (
                        <div className={styles.successMessage} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                          {resetMessage}
                        </div>
                      )}
                      
                      <button
                        type="submit"
                        className={styles.resetButton}
                        disabled={resetSubmitting}
                      >
                        {resetSubmitting ? t("login.resetSubmitting") : t("login.resetButton")}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
