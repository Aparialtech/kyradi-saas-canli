import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";

import { authService } from "../../services/auth";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { errorLogger } from "../../lib/errorLogger";
import { ArrowLeft, Database, Loader2, Mail, Send, Shield } from "../../lib/lucide";
import styles from "./ForgotPasswordPage.module.css";

export function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.requestPasswordReset({ email: normalizedEmail });
      navigate("/verify-reset-code", {
        state: {
          email: normalizedEmail,
          message: response.message || "Doğrulama kodu e-posta adresinize gönderildi.",
        },
        replace: true,
      });
    } catch (err) {
      errorLogger.error(err, {
        component: "AdminForgotPasswordPage",
        action: "handleSubmit",
      });
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let message = "Kod gönderme işlemi başarısız.";
        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail)) {
          const first = detail[0];
          if (first && typeof first === "object" && "msg" in first) {
            message = String(first.msg);
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

  return (
    <div className={styles.forgotPage}>
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>

      <div className={styles.forgotContainer}>
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
              <div className={styles.logoIcon}>
                <Database className={styles.logoIconSvg} />
              </div>
              <h1 className={styles.brandName}>KYRADI</h1>
            </motion.div>

            <p className={styles.tagline}>Yönetici Şifre Sıfırlama</p>

            <div className={styles.securityInfo}>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <Shield className={styles.securityIcon} />
                <span>Yönetici hesabı için güvenli sıfırlama</span>
              </motion.div>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <Mail className={styles.securityIcon} />
                <span>Kod yalnızca kayıtlı yönetici e-postasına gider</span>
              </motion.div>
            </div>

            <div className={styles.gradientBlob} />
          </div>
        </motion.div>

        <motion.div
          className={styles.formPanel}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.formContent}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Admin Şifre Sıfırlama</h2>
              <p className={styles.formSubtitle}>Yönetici e-posta adresinize doğrulama kodu gönderilir</p>
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

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formField}>
                <label className={styles.label}>
                  <Mail className={styles.labelIcon} />
                  Yönetici E-posta Adresi
                </label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="admin@kyradi.com"
                  disabled={submitting}
                />
              </div>

              <button type="submit" className={styles.submitButton} disabled={submitting || !email.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className={styles.buttonIcon} style={{ animation: "spin 1s linear infinite" }} />
                    Kod Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className={styles.buttonIcon} />
                    Doğrulama Kodu Gönder
                  </>
                )}
              </button>
            </form>

            <div className={styles.formFooter}>
              <Link to="/admin/login" className={styles.backLink}>
                <ArrowLeft className={styles.backIcon} />
                Admin giriş sayfasına dön
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
