import type { FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";

import { authService } from "../../services/auth";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { errorLogger } from "../../lib/errorLogger";
import { detectHostType, isDevelopment } from "../../lib/hostDetection";
import { Mail, Database, Shield, ArrowLeft, CheckCircle, Loader2, RefreshCw } from "../../lib/lucide";
import styles from "./VerifyResetCodePage.module.css";

export function VerifyResetCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const email = (location.state as { email?: string })?.email || "";
  const message = (location.state as { message?: string })?.message || "";
  
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>(message);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email
  useEffect(() => {
    const hostType = detectHostType();
    if (hostType === "admin" && !isDevelopment()) {
      navigate("/admin/verify-reset-code", { state: location.state, replace: true });
      return;
    }
    if (!email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate, location.state]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    
    if (pastedData) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);
      
      // Focus last filled input or last input
      const lastIndex = Math.min(pastedData.length - 1, 5);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const fullCode = code.join("");
    
    if (fullCode.length !== 6) {
      setError("Lütfen 6 haneli kodu tam olarak girin.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.verifyResetCode({ email, code: fullCode });
      
      // Navigate to reset password page with token
      navigate("/reset-password", { 
        state: { 
          email,
          reset_token: response.reset_token
        },
        replace: true 
      });
    } catch (err) {
      errorLogger.error(err, {
        component: "VerifyResetCodePage",
        action: "handleSubmit",
      });
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let errorMessage = "Kod doğrulama başarısız.";

        if (typeof detail === "string") {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          const first = detail[0];
          if (first && typeof first === "object" && "msg" in first) {
            errorMessage = String(first.msg);
          }
        }

        setError(errorMessage);
      } else {
        setError("Beklenmeyen bir hata oluştu.");
      }
      
      // Clear code on error
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resending) return;
    
    setResending(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await authService.requestPasswordReset({ email });
      setSuccessMessage(response.message || "Yeni doğrulama kodu gönderildi.");
      setResendCooldown(60); // 60 second cooldown
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        setError(typeof detail === "string" ? detail : "Kod gönderme başarısız.");
      } else {
        setError("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setResending(false);
    }
  };

  const isCodeComplete = code.every(digit => digit !== "");

  return (
    <div className={styles.verifyPage}>
      {/* Language Switcher */}
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>

      {/* Main Container */}
      <div className={styles.verifyContainer}>
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
              Kod Doğrulama
            </p>

            <div className={styles.securityInfo}>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <Shield className={styles.securityIcon} />
                <span>Güvenli doğrulama</span>
              </motion.div>
              <motion.div
                className={styles.securityItem}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <Mail className={styles.securityIcon} />
                <span>6 haneli kod ile</span>
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
              <motion.div
                className={styles.mailIcon}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <Mail className={styles.mailIconSvg} />
              </motion.div>
              <h2 className={styles.formTitle}>Kodu Doğrulayın</h2>
              <p className={styles.formSubtitle}>
                <strong>{email}</strong> adresine gönderilen 6 haneli kodu girin
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

            {successMessage && (
              <motion.div
                className={styles.successMessage}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CheckCircle className={styles.successIcon} />
                {successMessage}
              </motion.div>
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.codeInputs}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={styles.codeInput}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={submitting}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting || !isCodeComplete}
              >
                {submitting ? (
                  <>
                    <Loader2 className={styles.buttonIcon} style={{ animation: "spin 1s linear infinite" }} />
                    Doğrulanıyor...
                  </>
                ) : (
                  <>
                    <CheckCircle className={styles.buttonIcon} />
                    Kodu Doğrula
                  </>
                )}
              </button>
            </form>

            <div className={styles.resendSection}>
              <p className={styles.resendText}>Kod gelmedi mi?</p>
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || resending}
              >
                {resending ? (
                  <>
                    <Loader2 className={styles.resendIcon} style={{ animation: "spin 1s linear infinite" }} />
                    Gönderiliyor...
                  </>
                ) : resendCooldown > 0 ? (
                  `Tekrar gönder (${resendCooldown}s)`
                ) : (
                  <>
                    <RefreshCw className={styles.resendIcon} />
                    Tekrar Gönder
                  </>
                )}
              </button>
            </div>

            <div className={styles.formFooter}>
              <Link to="/forgot-password" className={styles.backLink}>
                <ArrowLeft className={styles.backIcon} />
                E-posta adresini değiştir
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
