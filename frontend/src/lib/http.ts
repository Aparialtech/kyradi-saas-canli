import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import { env } from "../config/env";
import { detectHostType, isDevelopment } from "./hostDetection";
import { tokenStorage } from "./tokenStorage";
import { errorLogger, ErrorSeverity } from "./errorLogger";

const hostType = typeof window === "undefined" ? "app" : detectHostType();
const resolvedBaseUrl = isDevelopment() ? env.API_URL.replace(/\/+$/, "") : "";
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
  (response) => response,
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
      
      // 401 Unauthorized - clear token and trigger logout
      if (axiosError.response?.status === 401) {
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
        // Avoid hard logout loops on auth endpoints; let AuthContext handle /auth/me failures.
        if (!isAuthEndpoint) {
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
