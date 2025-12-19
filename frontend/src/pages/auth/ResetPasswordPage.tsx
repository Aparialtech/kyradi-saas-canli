import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";

import { authService } from "../../services/auth";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { Lock, Database, Shield, CheckCircle, ArrowLeft, Eye, EyeOff } from "../../lib/lucide";
import styles from "./ResetPasswordPage.module.css";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get token from state (after code verification)
  const token = (location.state as { reset_token?: string })?.reset_token || "";
  
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);

  // Password strength calculation
  const getPasswordStrength = (password: string): { level: number; text: string } => {
    if (password.length === 0) return { level: 0, text: "" };
    if (password.length < 6) return { level: 1, text: "Zayıf" };
    if (password.length < 8) return { level: 2, text: "Orta" };
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (password.length >= 12 && score >= 3) return { level: 4, text: "Çok Güçlü" };
    if (password.length >= 8 && score >= 2) return { level: 3, text: "Güçlü" };
    return { level: 2, text: "Orta" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    if (!token) {
      // Redirect to forgot password if no token
      navigate("/forgot-password", { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Token gerekli.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setSubmitting(true);

    try {
      await authService.resetPassword({
        token,
        new_password: newPassword,
      });
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let message = "Şifre sıfırlama başarısız.";

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
    <div className={styles.resetPage}>
      {/* Language Switcher */}
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>

      {/* Main Container */}
      <div className={styles.resetContainer}>
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
              Güvenli Şifre Yenileme
            </p>

            <div className={styles.securityInfo}>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <Shield className={styles.securityIcon} />
                <span>256-bit SSL şifreleme</span>
              </motion.div>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <Lock className={styles.securityIcon} />
                <span>Güvenli şifre saklama</span>
              </motion.div>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <CheckCircle className={styles.securityIcon} />
                <span>SMS doğrulama ile giriş</span>
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
            {success ? (
              /* Success State */
              <motion.div
                className={styles.successState}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  className={styles.successIcon}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle className={styles.successIconSvg} />
                </motion.div>
                <h2 className={styles.successTitle}>Şifre Başarıyla Güncellendi</h2>
                <p className={styles.successMessage}>
                  Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yaptığınızda telefonunuza bir doğrulama kodu gönderilecek.
                </p>
                <div className={styles.redirectNotice}>
                  <div className={styles.spinner} />
                  <span>Giriş sayfasına yönlendiriliyorsunuz...</span>
                </div>
              </motion.div>
            ) : (
              /* Reset Form */
              <>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>Şifre Sıfırlama</h2>
                  <p className={styles.formSubtitle}>Yeni şifrenizi belirleyin</p>
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
                      <Lock className={styles.labelIcon} />
                      Yeni Şifre
                    </label>
                    <div className={styles.passwordInput}>
                      <input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        className={styles.input}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                        minLength={8}
                        placeholder="En az 8 karakter"
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {newPassword && (
                      <>
                        <div className={styles.passwordStrength}>
                          {[1, 2, 3, 4].map((level) => {
                            let colorClass = "";
                            if (passwordStrength.level >= level) {
                              if (level <= 1) colorClass = styles.weak;
                              else if (level <= 2) colorClass = styles.medium;
                              else colorClass = styles.strong;
                            }
                            return (
                              <div
                                key={level}
                                className={`${styles.strengthBar} ${colorClass}`}
                              />
                            );
                          })}
                        </div>
                        <span className={styles.strengthText}>{passwordStrength.text}</span>
                      </>
                    )}
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.label}>
                      <Lock className={styles.labelIcon} />
                      Şifre Tekrar
                    </label>
                    <div className={styles.passwordInput}>
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        className={styles.input}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        minLength={8}
                        placeholder="Şifrenizi tekrar girin"
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword && (
                      <span className={styles.strengthText}>
                        {confirmPassword === newPassword ? "✓ Şifreler eşleşiyor" : "✗ Şifreler eşleşmiyor"}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={submitting || !token}
                  >
                    {submitting ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                  </button>
                </form>

                <div className={styles.formFooter}>
                  <Link to="/login" className={styles.backLink}>
                    <ArrowLeft className={styles.backIcon} />
                    Giriş sayfasına dön
                  </Link>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
