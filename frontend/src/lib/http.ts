import axios from "axios";

import { env } from "../config/env";
import { tokenStorage } from "./tokenStorage";

export const http = axios.create({
  baseURL: env.API_URL,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.clear();
    }
    return Promise.reject(error);
  },
);
