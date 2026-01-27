import axios from "axios";
import type { FormEvent } from "react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { authService } from "../../services/auth";
import { tokenStorage } from "../../lib/tokenStorage";
import { errorLogger } from "../../lib/errorLogger";
import { detectHostType, getAdminLoginUrl, getPartnerLoginUrl, getTenantUrl, isDevelopment } from "../../lib/hostDetection";
import { Lock, Mail, Eye, EyeOff, Hotel, Building2, CheckCircle2 } from "../../lib/lucide";
import { sanitizeRedirect } from "../../utils/safeRedirect";
import { safeHardRedirect, safeNavigate } from "../../utils/safeNavigate";
import styles from "./LoginPage.module.css";

export function PartnerLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading, refreshUser } = useAuth();
  const debugAuth = import.meta.env.VITE_DEBUG_AUTH === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const rawRedirectUrl = searchParams.get("redirect");
  
  const redirectUrl = useMemo(() => sanitizeRedirect(rawRedirectUrl), [rawRedirectUrl]);
  const hasValidRedirect = useMemo(() => {
    if (!rawRedirectUrl) return false;
    return redirectUrl === rawRedirectUrl.trim();
  }, [rawRedirectUrl, redirectUrl]);

  useEffect(() => {
    if (!isDevelopment() && detectHostType() !== "app") {
      safeHardRedirect(getPartnerLoginUrl());
    }
  }, []);

  // Redirect if already logged in as partner
  useEffect(() => {
    if (!isLoading && user) {
      if (debugAuth) {
        console.debug("[login] already-authenticated", { role: user.role, host: window.location.host });
      }
      // Admin users shouldn't be here
      if (user.role === "super_admin" || user.role === "support") {
        safeHardRedirect(getAdminLoginUrl());
        return;
      }
      
      // Partner user - redirect to their panel
      if (user.tenant_id) {
        if (hasValidRedirect) {
          safeHardRedirect(redirectUrl);
        } else {
          safeNavigate(navigate, "/app");
        }
      }
    }
  }, [isLoading, user, navigate, redirectUrl]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      if (debugAuth) {
        console.debug("[login] partner submit", { host: window.location.host });
      }
      const response = await authService.loginPartner({ email, password });

      if (response.access_token) {
        tokenStorage.set(response.access_token);
        await refreshUser();
        if (response.tenant_slug) {
          localStorage.setItem("tenant_slug", response.tenant_slug);
        }
        if (debugAuth) {
          console.debug("[login] success -> redirect", { tenant: response.tenant_slug });
        }
        
        // Redirect to tenant URL or app
        if (response.tenant_slug) {
          if (isDevelopment()) {
            // In dev, just go to /app
            safeNavigate(navigate, "/app");
          } else {
            // In production, redirect to tenant subdomain
            const targetUrl = hasValidRedirect ? redirectUrl : getTenantUrl(response.tenant_slug, "/app");
            safeHardRedirect(targetUrl);
          }
        } else if (hasValidRedirect) {
          safeHardRedirect(redirectUrl);
        } else {
          safeNavigate(navigate, "/app");
        }
      }
    } catch (err) {
      errorLogger.error(err, { component: "PartnerLoginPage", action: "handleSubmit" });
      
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: string })?.detail;
        setError(detail || "Giriş başarısız");
      } else {
        setError("Beklenmeyen bir hata oluştu");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>

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
                <Hotel style={{ width: "32px", height: "32px", color: "white" }} />
              </div>
              <h1 className={styles.brandName}>KYRADI</h1>
            </motion.div>

            <p className={styles.tagline}>
              Otel Partner Paneli
            </p>

            <div className={styles.features}>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Building2 className={styles.featureIcon} />
                <span>Otelinizi yönetin</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <CheckCircle2 className={styles.featureIcon} />
                <span>Rezervasyonları takip edin</span>
              </motion.div>
            </div>

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
              <h2 className={styles.formTitle}>Partner Girişi</h2>
              <p className={styles.formSubtitle}>
                Otel yönetim panelinize giriş yapın
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

            <form className={styles.form} onSubmit={handleSubmit} autoComplete="on">
              <div className={styles.formField}>
                <label className={styles.label}>
                  <Mail className={styles.labelIcon} />
                  E-posta
                </label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="ornek@oteliniz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  name="email"
                  autoComplete="email"
                  required
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Lock className={styles.labelIcon} />
                  Şifre
                </label>
                <div className={styles.passwordInput}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={styles.input}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    name="password"
                    autoComplete="current-password"
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
                {submitting ? "Giriş yapılıyor..." : "Partner Girişi"}
              </button>
            </form>

            <div className={styles.formFooter}>
              <Link
                to="/forgot-password"
                style={{ color: "var(--text-tertiary)", textDecoration: "none" }}
              >
                Şifremi unuttum
              </Link>
              
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Hesabınız yok mu? </span>
                <Link
                  to="/signup"
                  style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
                >
                  Kayıt Ol
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
