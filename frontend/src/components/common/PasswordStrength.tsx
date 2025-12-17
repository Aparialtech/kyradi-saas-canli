import { useMemo } from "react";

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  requirements: {
    label: string;
    met: boolean;
  }[];
}

/**
 * Calculate password strength score and requirements
 */
export function calculatePasswordStrength(password: string): StrengthResult {
  const requirements = [
    { label: "En az 8 karakter", met: password.length >= 8 },
    { label: "Büyük harf (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Küçük harf (a-z)", met: /[a-z]/.test(password) },
    { label: "Rakam (0-9)", met: /[0-9]/.test(password) },
    { label: "Özel karakter (!@#$%...)", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const score = metCount / requirements.length;

  let label = "";
  let color = "";

  if (password.length === 0) {
    label = "";
    color = "transparent";
  } else if (score <= 0.2) {
    label = "Çok Zayıf";
    color = "#dc2626"; // red-600
  } else if (score <= 0.4) {
    label = "Zayıf";
    color = "#ea580c"; // orange-600
  } else if (score <= 0.6) {
    label = "Orta";
    color = "#ca8a04"; // yellow-600
  } else if (score <= 0.8) {
    label = "Güçlü";
    color = "#16a34a"; // green-600
  } else {
    label = "Çok Güçlü";
    color = "#059669"; // emerald-600
  }

  return { score, label, color, requirements };
}

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div style={{ marginTop: "var(--space-2)" }}>
      {/* Strength bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: showRequirements ? "var(--space-2)" : 0 }}>
        <div
          style={{
            flex: 1,
            height: "6px",
            borderRadius: "var(--radius-full)",
            background: "var(--bg-tertiary)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${strength.score * 100}%`,
              height: "100%",
              background: strength.color,
              borderRadius: "var(--radius-full)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        </div>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--font-medium)",
            color: strength.color,
            minWidth: "80px",
            textAlign: "right",
          }}
        >
          {strength.label}
        </span>
      </div>

      {/* Requirements list */}
      {showRequirements && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {strength.requirements.map((req) => (
            <div
              key={req.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: req.met ? "#16a34a" : "var(--text-tertiary)",
              }}
            >
              <span style={{ fontSize: "10px" }}>{req.met ? "✓" : "○"}</span>
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Validate password against policy
 * Returns error message if invalid, null if valid
 */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) {
    return "Şifre en az 8 karakter olmalıdır";
  }
  if (!/[A-Z]/.test(password)) {
    return "Şifre en az bir büyük harf içermelidir";
  }
  if (!/[a-z]/.test(password)) {
    return "Şifre en az bir küçük harf içermelidir";
  }
  if (!/[0-9]/.test(password)) {
    return "Şifre en az bir rakam içermelidir";
  }
  return null;
}

/**
 * Check if password meets minimum requirements
 */
export function isPasswordValid(password: string): boolean {
  return validatePasswordPolicy(password) === null;
}

