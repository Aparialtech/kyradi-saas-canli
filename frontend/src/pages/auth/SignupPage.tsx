import axios from "axios";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

import { authService } from "../../services/auth";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { tokenStorage } from "../../lib/tokenStorage";
import { errorLogger } from "../../lib/errorLogger";
import { Lock, Mail, User, Phone, Eye, EyeOff, Database, CheckCircle2 } from "../../lib/lucide";
import styles from "./LoginPage.module.css";

export function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    // Validation
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.signup({
        email,
        password,
        full_name: fullName || undefined,
        phone_number: phoneNumber || undefined,
      });

      // Auto-login with returned token
      if (response.access_token) {
        tokenStorage.set(response.access_token);
        // Redirect to onboarding
        navigate("/onboarding", { replace: true });
      }
    } catch (err) {
      errorLogger.error(err, {
        component: "SignupPage",
        action: "handleSubmit",
      });
      
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else {
          setError("Kayıt sırasında bir hata oluştu.");
        }
      } else {
        setError("Beklenmeyen bir hata oluştu.");
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
                <CheckCircle2 className={styles.featureIcon} />
                <span>Hızlı kayıt, kolay başlangıç</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <CheckCircle2 className={styles.featureIcon} />
                <span>Kendi subdomain'iniz</span>
              </motion.div>
              <motion.div
                className={styles.feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <CheckCircle2 className={styles.featureIcon} />
                <span>Ücretsiz deneme süresi</span>
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
              <h2 className={styles.formTitle}>Hesap Oluştur</h2>
              <p className={styles.formSubtitle}>
                Kyradi'ye katılın ve otelinizi yönetmeye başlayın
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
                  <User className={styles.labelIcon} />
                  Ad Soyad
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Adınız Soyadınız"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Mail className={styles.labelIcon} />
                  E-posta *
                </label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Phone className={styles.labelIcon} />
                  Telefon
                </label>
                <input
                  type="tel"
                  className={styles.input}
                  placeholder="05XX XXX XX XX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Lock className={styles.labelIcon} />
                  Şifre *
                </label>
                <div className={styles.passwordInput}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={styles.input}
                    placeholder="En az 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
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

              <div className={styles.formField}>
                <label className={styles.label}>
                  <Lock className={styles.labelIcon} />
                  Şifre Tekrar *
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  className={styles.input}
                  placeholder="Şifrenizi tekrar girin"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting}
              >
                {submitting ? "Kayıt yapılıyor..." : "Hesap Oluştur"}
              </button>
            </form>

            <div className={styles.formFooter}>
              <span style={{ color: "var(--text-tertiary)" }}>Zaten hesabınız var mı?</span>
              <Link
                to="/login"
                style={{ 
                  color: "var(--primary)", 
                  fontWeight: 600, 
                  marginLeft: "0.5rem",
                  textDecoration: "none"
                }}
              >
                Giriş Yap
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
