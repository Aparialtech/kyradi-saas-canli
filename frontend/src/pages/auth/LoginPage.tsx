import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { Database, Hotel, Shield } from "../../lib/lucide";
import styles from "./LoginPage.module.css";

/**
 * Login Page - Redirects to appropriate login based on user type
 * - Logged in admin -> /admin
 * - Logged in partner -> /app
 * - Not logged in -> Show selection (Partner/Admin)
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "super_admin" || user.role === "support") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    }
  }, [isLoading, user, navigate]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className={styles.loginPage}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <div style={{ textAlign: "center" }}>
            <Database style={{ width: "48px", height: "48px", color: "var(--primary)", marginBottom: "1rem" }} />
            <p style={{ color: "var(--text-tertiary)" }}>Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

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

            <div className={styles.gradientBlob} />
          </div>
        </motion.div>

        {/* Selection Panel */}
        <motion.div
          className={styles.formPanel}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.formContent}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Hoş Geldiniz</h2>
              <p className={styles.formSubtitle}>
                Giriş yapmak için hesap türünüzü seçin
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "2rem" }}>
              {/* Partner Login Button */}
              <Link
                to="/partner/login"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1.5rem",
                  borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "white",
                  textDecoration: "none",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(99, 102, 241, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Hotel style={{ width: "24px", height: "24px" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Otel Partner Girişi</div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>Otel yönetim panelinize giriş yapın</div>
                </div>
              </Link>

              {/* Admin Login Button */}
              <Link
                to="/admin/login"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1.5rem",
                  borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                  color: "white",
                  textDecoration: "none",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(30, 27, 75, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Shield style={{ width: "24px", height: "24px" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Yönetici Girişi</div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>Kyradi yönetim paneline giriş yapın</div>
                </div>
              </Link>
            </div>

            <div className={styles.formFooter} style={{ marginTop: "2rem" }}>
              <div style={{ textAlign: "center" }}>
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
