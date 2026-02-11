import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import { env } from "../config/env";
import { detectHostType, isDevelopment } from "./hostDetection";
import { tokenStorage } from "./tokenStorage";
import { errorLogger, ErrorSeverity } from "./errorLogger";

const JUST_LOGGED_IN_AT_KEY = "kyradi.justLoggedInAt";
const JUST_LOGGED_IN_GRACE_MS = 10_000;
const AUTH_ME_RETRY_DELAYS_MS = [150, 300, 600] as const;

const hostType = typeof window === "undefined" ? "app" : detectHostType();
const resolvedBaseUrl = isDevelopment() ? env.API_URL.replace(/\/+$/, "") : "";
// In production, prefer HttpOnly cookie auth to avoid stale bearer token mismatches.
const shouldAttachBearer = isDevelopment();
// Startup log for debugging deployed envs
if (import.meta.env.DEV) {
  console.debug("[HTTP] Using API base URL:", resolvedBaseUrl || "(relative)");
}

// Callback for handling 401 errors (will be set by AuthContext)
let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (callback: () => void) => {
  onUnauthorized = callback;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _authMeRetryCount?: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function clearJustLoggedInAt(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(JUST_LOGGED_IN_AT_KEY);
  } catch {
    // ignore storage failures
  }
}

function isGraceWindowActive(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = sessionStorage.getItem(JUST_LOGGED_IN_AT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < JUST_LOGGED_IN_GRACE_MS;
  } catch {
    return false;
  }
}

function isAuthMeRequest(config?: InternalAxiosRequestConfig): boolean {
  if (!config?.url) return false;
  const method = (config.method || "get").toLowerCase();
  if (method !== "get") return false;
  const normalized = config.url.split("?")[0].replace(/\/+$/, "");
  return normalized.endsWith("/auth/me") || normalized === "auth/me";
}

export const http = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers = config.headers ?? {};
    if (!config.headers["X-Requested-With"]) {
      config.headers["X-Requested-With"] = "XMLHttpRequest";
    }
    const token = tokenStorage.get();
    // In production we rely on HttpOnly cookies to avoid stale bearer/header conflicts.
    if (token && shouldAttachBearer) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (env.TENANT_ID && hostType !== "tenant") {
      config.headers["X-Tenant-ID"] = env.TENANT_ID;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with network error handling
http.interceptors.response.use(
  (response) => {
    if (isAuthMeRequest(response.config)) {
      clearJustLoggedInAt();
    }
    return response;
  },
  (error: AxiosError | Error) => {
    // Handle network errors (ERR_NETWORK_CHANGED, connection resets)
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      // Network errors (no response)
      if (!axiosError.response) {
        const message = axiosError.message || "Network error";
        const isNetworkChanged = message.includes("ERR_NETWORK_CHANGED") || 
                                  message.includes("Network Error") ||
                                  message.includes("Failed to fetch");
        
        if (isNetworkChanged) {
          errorLogger.warn(axiosError, {
            component: "HTTP",
            action: "networkChanged",
            url: axiosError.config?.url,
            method: axiosError.config?.method,
          });
          // Return a structured error that React Query can handle
          return Promise.reject({
            ...axiosError,
            response: {
              status: 0,
              statusText: "Network Error",
              data: { detail: "Network connection changed. Please retry." },
            },
            isNetworkError: true,
          });
        }
      }
      
      // 401 Unauthorized
      if (axiosError.response?.status === 401) {
        const requestConfig = axiosError.config as RetryableRequestConfig | undefined;
        if (requestConfig && isAuthMeRequest(requestConfig) && isGraceWindowActive()) {
          const retryCount = requestConfig._authMeRetryCount ?? 0;
          if (retryCount < AUTH_ME_RETRY_DELAYS_MS.length) {
            const delayMs = AUTH_ME_RETRY_DELAYS_MS[retryCount];
            requestConfig._authMeRetryCount = retryCount + 1;
            return new Promise((resolve, reject) => {
              window.setTimeout(() => {
                http
                  .request(requestConfig)
                  .then(resolve)
                  .catch(reject);
              }, delayMs);
            });
          }
        }

        errorLogger.warn(axiosError, {
          component: "HTTP",
          action: "unauthorized",
          url: axiosError.config?.url,
          method: axiosError.config?.method,
        });
        const url = axiosError.config?.url || "";
        const isAuthEndpoint =
          url.includes("/auth/me") ||
          url.includes("/auth/partner/login") ||
          url.includes("/auth/admin/login") ||
          url.includes("/auth/login");
        // /auth/me: normal unauthorized handling applies only after grace retries are exhausted.
        if (url.includes("/auth/me")) {
          tokenStorage.clear();
          if (onUnauthorized) {
            onUnauthorized();
          }
        } else if (!isAuthEndpoint) {
          tokenStorage.clear();
          if (onUnauthorized) {
            onUnauthorized();
          }
        }
      }
      
      // 404 Not Found - log as low severity for optional endpoints
      if (axiosError.response?.status === 404) {
        errorLogger.warn(axiosError, {
          component: "HTTP",
          action: "notFound",
          url: axiosError.config?.url,
          method: axiosError.config?.method,
        });
      } else if (axiosError.response?.status) {
        // Log other HTTP errors with appropriate severity
        const status = axiosError.response.status;
        const severity = status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
        
        errorLogger.log(axiosError, severity, {
          component: "HTTP",
          action: "httpError",
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          statusCode: status,
          responseData: axiosError.response?.data,
        });
      } else {
        // No response - network or timeout error
        errorLogger.error(axiosError, {
          component: "HTTP",
          action: "noResponse",
          url: axiosError.config?.url,
          method: axiosError.config?.method,
        });
      }
    } else {
      errorLogger.error(error, {
        component: "HTTP",
        action: "nonAxiosError",
      });
    }
    
    return Promise.reject(error);
  }
);

export const testConnection = async () => {
  try {
    await http.get("/health");
  } catch (error) {
    errorLogger.warn(error, {
      component: "HTTP",
      action: "testConnection",
    });
  }
};
