import axios from "axios";

import { env } from "../config/env";
import { tokenStorage } from "./tokenStorage";

const baseURL = env.API_URL.replace(/\/+$/, "");
// Startup log for debugging deployed envs
console.info("[HTTP] Using API base URL:", baseURL);

export const http = axios.create({
  baseURL,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (env.TENANT_ID) {
    config.headers["X-Tenant-ID"] = env.TENANT_ID;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("HTTP ERROR:", error.response || error.message);
    if (error.response?.status === 401) {
      tokenStorage.clear();
    }
    return Promise.reject(error);
  },
);

export const testConnection = async () => {
  try {
    await http.get("/health");
  } catch (error) {
    console.warn("API OFFLINE", error);
  }
};
