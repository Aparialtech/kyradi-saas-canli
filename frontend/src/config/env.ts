const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const DEFAULT_API_URL = "";
const DEFAULT_TENANT_ID = "";

const normalize = (url?: string): string => {
  if (!url || !url.trim()) return "";
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://")) {
    return trimmed.replace("http://", "https://");
  }
  return trimmed;
};

const resolveApiUrl = (): string => {
  const raw = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;
  const normalized = normalize(raw);
  // In production always use same-origin to avoid mixed-host auth/CSP issues.
  if (import.meta.env.PROD) return "";
  return normalized;
};

export const env = {
  API_URL: resolveApiUrl(),
  TENANT_ID: (import.meta.env.VITE_TENANT_ID ?? DEFAULT_TENANT_ID).trim(),
  ENABLE_INTERNAL_RESERVATIONS: parseBoolean(
    import.meta.env.VITE_ENABLE_INTERNAL_RESERVATIONS,
    false
  ),
  PUBLIC_CDN_BASE: import.meta.env.VITE_PUBLIC_CDN_BASE ?? "",
} as const;
