import axios from "axios";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { authService } from "../../services/auth";
import { tokenStorage } from "../../lib/tokenStorage";
import { errorLogger } from "../../lib/errorLogger";
import { Lock, Mail, Eye, EyeOff, Shield, Database } from "../../lib/lucide";
import styles from "./LoginPage.module.css";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "super_admin" || user.role === "support") {
        navigate("/admin", { replace: true });
      }
    }
  }, [isLoading, user, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await authService.login({ email, password });

      if (response.access_token) {
        tokenStorage.set(response.access_token);
        const currentUser = await authService.getCurrentUser();
        
        // Only allow admin users
        if (currentUser.role !== "super_admin" && currentUser.role !== "support") {
          tokenStorage.clear();
          setError("Bu giriş sayfası sadece yöneticiler içindir.");
          return;
        }
        
        navigate("/admin", { replace: true });
      }
    } catch (err) {
      errorLogger.error(err, { component: "AdminLoginPage", action: "handleSubmit" });
      
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
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)" }}
        >
          <div className={styles.brandingContent}>
            <motion.div
              className={styles.logo}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className={styles.logoIcon} style={{ background: "rgba(255,255,255,0.15)" }}>
                <Shield style={{ width: "32px", height: "32px", color: "white" }} />
              </div>
              <h1 className={styles.brandName}>KYRADI</h1>
            </motion.div>

            <p className={styles.tagline} style={{ color: "rgba(255,255,255,0.9)" }}>
              Yönetim Paneli
            </p>

            <div className={styles.features}>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Database className={styles.featureIcon} />
                <span>Tüm otelleri yönetin</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Shield className={styles.featureIcon} />
                <span>Güvenli admin erişimi</span>
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
              <h2 className={styles.formTitle}>Yönetici Girişi</h2>
              <p className={styles.formSubtitle}>
                Kyradi yönetim paneline giriş yapın
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
                  E-posta
                </label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="admin@kyradi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                style={{ background: "linear-gradient(135deg, #4338ca 0%, #6366f1 100%)" }}
                disabled={submitting}
              >
                {submitting ? "Giriş yapılıyor..." : "Yönetici Girişi"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
