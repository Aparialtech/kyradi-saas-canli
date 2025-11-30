const LOCAL_DEFAULT = "http://localhost:8000";

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();

const resolveClientOrigin = () => {
  if (typeof window === "undefined") {
    return LOCAL_DEFAULT;
  }
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local");
  return isLocalhost ? LOCAL_DEFAULT : window.location.origin;
};

const normalizeApiUrl = () => {
  if (!rawApiUrl || rawApiUrl === "auto") {
    return resolveClientOrigin();
  }
  if (rawApiUrl.startsWith("/")) {
    return `${resolveClientOrigin()}${rawApiUrl}`;
  }
  return rawApiUrl;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export const env = {
  API_URL: normalizeApiUrl(),
  ENABLE_INTERNAL_RESERVATIONS: parseBoolean(import.meta.env.VITE_ENABLE_INTERNAL_RESERVATIONS, false),
  PUBLIC_CDN_BASE: import.meta.env.VITE_PUBLIC_CDN_BASE ?? "",
};
