import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { authService } from "../../services/auth";
import { LanguageSwitcher } from "../../components/common/LanguageSwitcher";
import { useTranslation } from "../../hooks/useTranslation";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      setError("Geçersiz veya eksik token. Lütfen e-postanızdaki linki kullanın.");
    }
  }, [token]);

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

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-page__locale">
          <LanguageSwitcher />
        </div>
        <div className="auth-card">
          <header className="auth-card__header">
            <div className="auth-card__brand">KYRADİ</div>
            <h1 className="auth-card__title">Şifre Başarıyla Güncellendi</h1>
            <p className="auth-card__subtitle">
              Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yaptığınızda telefonunuza bir doğrulama kodu gönderilecek.
            </p>
          </header>
          <div className="auth-card__success">
            Giriş sayfasına yönlendiriliyorsunuz...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-page__locale">
        <LanguageSwitcher />
      </div>
      <div className="auth-card">
        <header className="auth-card__header">
          <div className="auth-card__brand">KYRADİ</div>
          <h1 className="auth-card__title">Şifre Sıfırlama</h1>
          <p className="auth-card__subtitle">Yeni şifrenizi belirleyin</p>
        </header>

        {error && <div className="auth-card__error">{error}</div>}

        <form className="auth-card__form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-field__label">Yeni Şifre</span>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
              placeholder="En az 8 karakter"
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">Şifre Tekrar</span>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Şifrenizi tekrar girin"
            />
          </label>

          <div className="form-actions">
            <button className="btn btn--primary" type="submit" disabled={submitting || !token}>
              {submitting ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </button>
          </div>
        </form>

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

