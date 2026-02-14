import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";

import { authService } from "../../services/auth";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { errorLogger } from "../../lib/errorLogger";
import { ArrowLeft, CheckCircle, Database, Eye, EyeOff, Lock, Shield } from "../../lib/lucide";
import styles from "./ResetPasswordPage.module.css";

export function AdminResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = (location.state as { reset_token?: string })?.reset_token || "";

  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);

  const getPasswordStrength = (password: string): { level: number; text: string } => {
    if (password.length === 0) return { level: 0, text: "" };
    if (password.length < 6) return { level: 1, text: "Zayıf" };
    if (password.length < 8) return { level: 2, text: "Orta" };
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?\":{}|<>]/.test(password);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (password.length >= 12 && score >= 3) return { level: 4, text: "Çok Güçlü" };
    if (password.length >= 8 && score >= 2) return { level: 3, text: "Güçlü" };
    return { level: 2, text: "Orta" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    if (!token) {
      navigate("/admin/forgot-password", { replace: true });
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
      await authService.resetPassword({ token, new_password: newPassword });
      setSuccess(true);
      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 3000);
    } catch (err) {
      errorLogger.error(err, {
        component: "AdminResetPasswordPage",
        action: "handleSubmit",
      });
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
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>
      <div className={styles.resetContainer}>
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
            <p className={styles.tagline}>Admin Güvenli Şifre Yenileme</p>
            <div className={styles.securityInfo}>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <Shield className={styles.securityIcon} />
                <span>Yönetici hesabı için ayrılmış akış</span>
              </motion.div>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <Lock className={styles.securityIcon} />
                <span>Güçlü şifre saklama</span>
              </motion.div>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <CheckCircle className={styles.securityIcon} />
                <span>Admin login'e güvenli dönüş</span>
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
            {success ? (
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
                <h2 className={styles.successTitle}>Admin Şifresi Güncellendi</h2>
                <p className={styles.successMessage}>Yeni şifrenizle yönetici girişi yapabilirsiniz.</p>
                <div className={styles.redirectNotice}>
                  <div className={styles.spinner} />
                  <span>Admin giriş sayfasına yönlendiriliyorsunuz...</span>
                </div>
              </motion.div>
            ) : (
              <>
                <div className={styles.formHeader}>
                  <h2 className={styles.formTitle}>Admin Şifre Sıfırlama</h2>
                  <p className={styles.formSubtitle}>Yönetici hesabınız için yeni şifre belirleyin</p>
                </div>

                {error && (
                  <motion.div className={styles.errorMessage} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
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
                      <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {newPassword && (
                      <>
                        <div className={styles.passwordStrength}>
                          <div className={styles.strengthBars}>
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`${styles.strengthBar} ${level <= passwordStrength.level ? styles.active : ""} ${
                                  passwordStrength.level <= 1
                                    ? styles.weak
                                    : passwordStrength.level <= 2
                                      ? styles.medium
                                      : passwordStrength.level <= 3
                                        ? styles.strong
                                        : styles.veryStrong
                                }`}
                              />
                            ))}
                          </div>
                          <span className={styles.strengthText}>{passwordStrength.text}</span>
                        </div>
                        <div className={styles.passwordRequirements}>
                          <span className={newPassword.length >= 8 ? styles.requirementMet : styles.requirement}>
                            ✓ En az 8 karakter
                          </span>
                        </div>
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
                    {confirmPassword && (
                      <div className={styles.passwordMatch}>
                        {newPassword === confirmPassword ? (
                          <span className={styles.matchSuccess}>✓ Şifreler eşleşiyor</span>
                        ) : (
                          <span className={styles.matchError}>✗ Şifreler eşleşmiyor</span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={submitting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  >
                    {submitting ? "Şifre güncelleniyor..." : "Admin Şifresini Güncelle"}
                  </button>
                </form>

                <div className={styles.formFooter}>
                  <Link to="/admin/login" className={styles.backLink}>
                    <ArrowLeft className={styles.backIcon} />
                    Admin giriş sayfasına dön
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
