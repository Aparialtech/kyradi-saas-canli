import type { FormEvent } from "react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

import { authService } from "../../services/auth";
import { tokenStorage } from "../../lib/tokenStorage";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";

export function SMSVerificationPage() {
  const location = useLocation();
  
  // Get verification_id from location state or query params
  const initialVerificationId = (location.state as { verification_id?: string })?.verification_id || 
                                new URLSearchParams(location.search).get("verification_id");
  
  const [verificationId, setVerificationId] = useState<string | null>(initialVerificationId);
  const [code, setCode] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [resending, setResending] = useState<boolean>(false);

  if (!verificationId) {
    return (
      <div className="auth-page">
        <div className="auth-page__locale">
          <LanguageSwitcher />
        </div>
        <div className="auth-card">
          <header className="auth-card__header">
            <div className="auth-card__brand">KYRADİ</div>
            <h1 className="auth-card__title">Hata</h1>
            <p className="auth-card__subtitle">Doğrulama bilgisi bulunamadı.</p>
          </header>
          <div className="auth-card__error">
            Lütfen giriş sayfasından tekrar deneyin.
          </div>
          <footer className="auth-card__footer">
            <a href="/login" className="auth-link-button">
              Giriş sayfasına dön
            </a>
          </footer>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (code.length !== 6) {
      setError("Lütfen 6 haneli kodu girin.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.verifyLoginSMS({
        verification_id: verificationId,
        code: code.trim(),
      });
      
      // Save token
      tokenStorage.set(response.access_token);
      
      // Get user to determine redirect
      const currentUser = await authService.getCurrentUser();
      
      // Redirect and let AuthContext initialize from token
      if (currentUser.role === "super_admin" || currentUser.role === "support") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/app";
      }
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let message = "Doğrulama kodu geçersiz.";

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

  const handleResend = async () => {
    if (!verificationId) {
      return;
    }
    
    setResending(true);
    setError("");
    
    try {
      const response = await authService.resendLoginSMS(verificationId);
      // Update verification_id with new one
      setVerificationId(response.verification_id);
      window.history.replaceState(
        { ...location.state, verification_id: response.verification_id },
        "",
        `?verification_id=${response.verification_id}`
      );
      setError(""); // Clear any previous errors
      alert("✅ Doğrulama kodu yeniden gönderildi!");
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown })?.detail;
        let message = "Kod yeniden gönderilemedi.";
        
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
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__locale">
        <LanguageSwitcher />
      </div>
      <div className="auth-card">
        <header className="auth-card__header">
          <div className="auth-card__brand">KYRADİ</div>
          <h1 className="auth-card__title">SMS Doğrulama</h1>
          <p className="auth-card__subtitle">
            Telefonunuza gönderilen 6 haneli kodu girin.
          </p>
        </header>

        {error && <div className="auth-card__error">{error}</div>}

        <form className="auth-card__form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-field__label">Doğrulama Kodu</span>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, ""); // Only digits
                setCode(value);
              }}
              required
              placeholder="123456"
              style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5rem", fontFamily: "monospace" }}
            />
          </label>

          <div className="form-actions">
            <button className="btn btn--primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? "Doğrulanıyor..." : "Doğrula"}
            </button>
          </div>
        </form>

        <div className="auth-card__helper">
          <button
            type="button"
            className="auth-link-button"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Gönderiliyor..." : "Kodu Yeniden Gönder"}
          </button>
        </div>

        <footer className="auth-card__footer">
          <p>
            <a href="/login" className="auth-link-button">
              Giriş sayfasına dön
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
