import axios from "axios";
import type { FormEvent } from "react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { authService } from "../../services/auth";
import { partnerSettingsService } from "../../services/partner/settings";
import { tokenStorage } from "../../lib/tokenStorage";
import { errorLogger } from "../../lib/errorLogger";
import { detectHostType, getTenantUrl, isDevelopment } from "../../lib/hostDetection";
import { Lock, Mail, Eye, EyeOff, Hotel, Building2, CheckCircle2 } from "../../lib/lucide";
import { sanitizeRedirect } from "../../utils/safeRedirect";
import styles from "./LoginPage.module.css";

export function PartnerLoginPage() {
  const TENANT_SLUG_CACHE_KEY = "kyradi:tenant_slug";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading } = useAuth();

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

  const resolveTenantRedirect = useCallback(
    (tenantSlug: string) => {
      const tenantAppUrl = getTenantUrl(tenantSlug, "/app");
      if (!hasValidRedirect) {
        return tenantAppUrl;
      }

      // Keep tenant-intended absolute redirects, ignore app/admin/self-host redirects.
      try {
        const parsed = new URL(redirectUrl);
        const host = parsed.hostname.toLowerCase();
        const isKyradi = host === "kyradi.com" || host.endsWith(".kyradi.com");
        const isReservedHost =
          host === "app.kyradi.com" ||
          host === "admin.kyradi.com" ||
          host === "www.kyradi.com" ||
          host === "kyradi.com";

        if (isKyradi && !isReservedHost) {
          return redirectUrl;
        }
      } catch {
        // Relative path redirects (e.g. "/app") should stay on tenant host.
      }

      return tenantAppUrl;
    },
    [hasValidRedirect, redirectUrl],
  );

  // Redirect if already logged in as partner
  useEffect(() => {
    if (isLoading || !user) {
      return;
    }
    if (user.role === "super_admin" || user.role === "support") {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!user.tenant_id) {
      return;
    }
    if (hasValidRedirect) {
      window.location.href = redirectUrl;
      return;
    }

    const hostType = detectHostType();
    if (hostType !== "app" || isDevelopment()) {
      navigate("/app", { replace: true });
      return;
    }

    const cachedTenantSlug = localStorage.getItem(TENANT_SLUG_CACHE_KEY);
    if (cachedTenantSlug) {
      window.location.href = getTenantUrl(cachedTenantSlug, "/app");
      return;
    }

    void (async () => {
      try {
        const settings = await partnerSettingsService.getSettings();
        if (settings.tenant_slug) {
          localStorage.setItem(TENANT_SLUG_CACHE_KEY, settings.tenant_slug);
          window.location.href = getTenantUrl(settings.tenant_slug, "/app");
          return;
        }
      } catch (err) {
        errorLogger.warn(err, { component: "PartnerLoginPage", action: "resolveTenantSlugAfterSession" });
      }
      navigate("/app", { replace: true });
    })();
  }, [isLoading, user, navigate, redirectUrl, hasValidRedirect]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await authService.loginPartner({ email, password });

      if (response.access_token) {
        tokenStorage.set(response.access_token);
        const cachedTenantSlug = localStorage.getItem(TENANT_SLUG_CACHE_KEY);
        const directTenantSlug = response.tenant_slug || cachedTenantSlug;
        if (directTenantSlug) {
          localStorage.setItem(TENANT_SLUG_CACHE_KEY, directTenantSlug);
          const targetUrl = isDevelopment() ? "/app" : resolveTenantRedirect(directTenantSlug);
          window.location.href = targetUrl;
          return;
        }

        if (hasValidRedirect) {
          window.location.href = redirectUrl;
          return;
        }

        if (!isDevelopment()) {
          try {
            const settings = await partnerSettingsService.getSettings();
            if (settings.tenant_slug) {
              localStorage.setItem(TENANT_SLUG_CACHE_KEY, settings.tenant_slug);
              window.location.href = getTenantUrl(settings.tenant_slug, "/app");
              return;
            }
          } catch (err) {
            errorLogger.warn(err, { component: "PartnerLoginPage", action: "resolveTenantSlugAfterLogin" });
          }
        }

        window.location.href = "/app";
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
