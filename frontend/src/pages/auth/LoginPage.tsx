import axios from "axios";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import type { AuthUser } from "../../types/auth";
import { authService } from "../../services/auth";
import { useTranslation } from "../../hooks/useTranslation";
import { tokenStorage } from "../../lib/tokenStorage";
import { Lock, Mail, BarChart3, CreditCard, Eye, EyeOff, Database, Building2 } from "../../lib/lucide";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

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

  const handleForgotPassword = () => {
    navigate("/forgot-password");
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
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Kyradi Panel Girişi</h2>
              <p className={styles.formSubtitle}>
                Hesabınıza giriş yapın
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
                  placeholder="ornek@email.com"
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
                onClick={handleForgotPassword}
              >
                {t("login.forgot")}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
