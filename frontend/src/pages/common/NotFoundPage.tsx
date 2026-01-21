import { useNavigate } from "react-router-dom";

import { AlertTriangle } from "../../lib/lucide";
import { ModernCard } from "../../components/ui/ModernCard";
import { ModernButton } from "../../components/ui/ModernButton";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "720px", margin: "0 auto" }}>
      <ModernCard variant="glass" padding="lg">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius-lg)",
            background: "rgba(245, 158, 11, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <AlertTriangle className="h-5 w-5" style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", margin: 0 }}>
              404 – Sayfa Bulunamadı
            </h1>
            <p style={{ margin: 0, color: "var(--text-tertiary)" }}>
              Aradığınız sayfa bu host üzerinde kullanılamıyor.
            </p>
          </div>
        </div>

        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
          Partner panel dokümantasyonu yalnızca tenant host üzerinden erişilebilir.
        </p>

        <ModernButton variant="primary" onClick={() => navigate("/")}>
          Ana Sayfaya Dön
        </ModernButton>
      </ModernCard>
    </div>
  );
}
