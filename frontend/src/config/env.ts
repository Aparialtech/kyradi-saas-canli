const DEFAULT_API_URL = "https://kyradi-saas-canli-production.up.railway.app";

const normalize = (url: string | undefined): string => {
  if (!url || !url.trim()) return DEFAULT_API_URL;
  return url.replace(/\/+$/, "");
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export const env = {
  API_URL: normalize(import.meta.env.VITE_API_URL),
  ENABLE_INTERNAL_RESERVATIONS: parseBoolean(import.meta.env.VITE_ENABLE_INTERNAL_RESERVATIONS, false),
  PUBLIC_CDN_BASE: import.meta.env.VITE_PUBLIC_CDN_BASE ?? "",
};
