const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const DEFAULT_API_URL = "";
const DEFAULT_TENANT_ID = "";

const normalize = (url?: string): string => {
  if (!url || !url.trim()) return "";
  return url.trim().replace(/\/+$/, "");
};

export const env = {
  API_URL: import.meta.env.DEV
    ? normalize(import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? DEFAULT_API_URL)
    : "",
  TENANT_ID: (import.meta.env.VITE_TENANT_ID ?? DEFAULT_TENANT_ID).trim(),
  ENABLE_INTERNAL_RESERVATIONS: parseBoolean(
    import.meta.env.VITE_ENABLE_INTERNAL_RESERVATIONS,
    false
  ),
  PUBLIC_CDN_BASE: import.meta.env.VITE_PUBLIC_CDN_BASE ?? "",
} as const;
