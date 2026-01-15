import axios from "axios";
import type { FormEvent } from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { authService } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import { errorLogger } from "../../lib/errorLogger";
import { Building2, Globe, CheckCircle2, Loader2, AlertCircle } from "../../lib/lucide";
import styles from "./LoginPage.module.css";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [legalName, setLegalName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [slugError, setSlugError] = useState("");

  // Redirect if user already has a tenant
  useEffect(() => {
    if (!isLoading && user?.tenant_id) {
      navigate("/app", { replace: true });
    }
  }, [isLoading, user, navigate]);

  // Auto-generate slug from name
  useEffect(() => {
    if (name) {
      const generated = name
        .toLowerCase()
        .replace(/[çÇ]/g, "c")
        .replace(/[ğĞ]/g, "g")
        .replace(/[ıİ]/g, "i")
        .replace(/[öÖ]/g, "o")
        .replace(/[şŞ]/g, "s")
        .replace(/[üÜ]/g, "u")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generated);
    }
  }, [name]);

  // Validate slug format
  useEffect(() => {
    if (slug) {
      const isValid = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(slug);
      if (!isValid && slug.length >= 2) {
        setSlugError("Subdomain sadece küçük harf, rakam ve tire içerebilir.");
      } else if (slug.length < 3) {
        setSlugError("Subdomain en az 3 karakter olmalıdır.");
      } else {
        setSlugError("");
      }
    } else {
      setSlugError("");
    }
  }, [slug]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (slugError) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.createTenant({
        name,
        slug,
        custom_domain: customDomain || undefined,
        legal_name: legalName || undefined,
      });

      // Redirect to the new tenant's panel
      window.location.href = response.redirect_url;
    } catch (err) {
      errorLogger.error(err, {
        component: "OnboardingPage",
        action: "handleSubmit",
      });

      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else {
          setError("Otel oluşturulurken bir hata oluştu.");
        }
      } else {
        setError("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loginPage}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <Loader2 className="h-8 w-8" style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        {/* Info Panel */}
        <motion.div
          className={styles.brandingPanel}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.brandingContent}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div style={{ 
                width: "80px", 
                height: "80px", 
                borderRadius: "20px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.5rem"
              }}>
                <Building2 style={{ width: "40px", height: "40px", color: "white" }} />
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                Otelinizi Oluşturun
              </h1>
              <p style={{ color: "var(--text-tertiary)", fontSize: "1.1rem" }}>
                Sadece birkaç adımda yönetim panelinize sahip olun
              </p>
            </motion.div>

            <div className={styles.features} style={{ marginTop: "2rem" }}>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <CheckCircle2 className={styles.featureIcon} />
                <span>Kendi subdomain'iniz (otel.kyradi.com)</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <CheckCircle2 className={styles.featureIcon} />
                <span>Opsiyonel özel domain desteği</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <CheckCircle2 className={styles.featureIcon} />
                <span>Anında aktif yönetim paneli</span>
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
              <h2 className={styles.formTitle}>Otel Bilgileri</h2>
              <p className={styles.formSubtitle}>
                Otelinizin temel bilgilerini girin
              </p>
            </div>

            {error && (
              <motion.div
                className={styles.errorMessage}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle className="h-4 w-4" style={{ marginRight: "0.5rem" }} />
                {error}
              </motion.div>
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formField}>
                <label className={styles.label}>
                  <Building2 className={styles.labelIcon} />
                  Otel Adı *
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Örn: Grand Hotel İstanbul"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Globe className={styles.labelIcon} />
                  Subdomain *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="grand-hotel"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    required
                    minLength={3}
                    style={{ paddingRight: "120px" }}
                  />
                  <span style={{ 
                    position: "absolute", 
                    right: "12px", 
                    top: "50%", 
                    transform: "translateY(-50%)",
                    color: "var(--text-tertiary)",
                    fontSize: "0.9rem"
                  }}>
                    .kyradi.com
                  </span>
                </div>
                {slugError && (
                  <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                    {slugError}
                  </p>
                )}
                {!slugError && slug.length >= 3 && (
                  <p style={{ color: "#16a34a", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                    ✓ {slug}.kyradi.com kullanılabilir
                  </p>
                )}
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Globe className={styles.labelIcon} />
                  Özel Domain (Opsiyonel)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Örn: rezervasyon.otelim.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                />
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  Kendi domain'inizi bağlamak isterseniz buraya yazın
                </p>
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Building2 className={styles.labelIcon} />
                  Ticari Ünvan (Opsiyonel)
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Örn: Grand Otelcilik A.Ş."
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting || !!slugError || slug.length < 3}
              >
                {submitting ? "Oluşturuluyor..." : "Otelimi Oluştur"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
