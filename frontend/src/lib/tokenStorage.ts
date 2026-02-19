import { getHostMode } from "./hostMode";

const STORAGE_KEY = "kyradi_access_token";
const TENANT_SLUG_KEY = "tenant_slug";

const getPrefix = (): string => {
  if (typeof window === "undefined") return "kyradi:app:";
  const mode = getHostMode(window.location.hostname);
  return `kyradi:${mode}:`;
};

const tokenKey = () => `${getPrefix()}${STORAGE_KEY}`;
const tenantSlugKey = () => `${getPrefix()}${TENANT_SLUG_KEY}`;

export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(tokenKey());
  },
  set(token: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tokenKey(), token);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(tokenKey());
  },
};

export const tenantSlugStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(tenantSlugKey());
  },
  set(value: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tenantSlugKey(), value);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(tenantSlugKey());
  },
};
