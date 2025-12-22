import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import { env } from "../config/env";
import { tokenStorage } from "./tokenStorage";

const baseURL = env.API_URL.replace(/\/+$/, "");
// Startup log for debugging deployed envs
console.info("[HTTP] Using API base URL:", baseURL);

// Callback for handling 401 errors (will be set by AuthContext)
let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (callback: () => void) => {
  onUnauthorized = callback;
};

export const http = axios.create({
  baseURL,
  withCredentials: false,
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
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (env.TENANT_ID) {
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
          console.warn("[HTTP] Network changed, request aborted:", axiosError.config?.url);
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
        console.warn("[HTTP] 401 Unauthorized - token expired or invalid");
        tokenStorage.clear();
        // Trigger the logout callback if set
        if (onUnauthorized) {
          onUnauthorized();
        }
      }
      
      // 404 Not Found - don't log as error for optional endpoints
      if (axiosError.response?.status === 404) {
        console.debug("[HTTP] 404 Not Found:", axiosError.config?.url);
      } else {
        console.error("[HTTP] Error:", axiosError.response?.status, axiosError.config?.url, axiosError.response?.data || axiosError.message);
      }
    } else {
      console.error("[HTTP] Non-Axios error:", error);
    }
    
    return Promise.reject(error);
  }
);

export const testConnection = async () => {
  try {
    await http.get("/health");
  } catch (error) {
    console.warn("API OFFLINE", error);
  }
};
