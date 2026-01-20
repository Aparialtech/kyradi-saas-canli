/**
 * Host detection utilities for multi-tenant routing
 * 
 * Host types:
 * - admin.kyradi.com -> Admin Panel
 * - app.kyradi.com -> Main App (Signup, Partner Login, Onboarding)
 * - {slug}.kyradi.com -> Partner Panel (Tenant specific)
 * - custom domain -> Partner Panel (Tenant specific)
 */

export type HostType = "admin" | "app" | "tenant" | "unknown";

// Environment variables with fallbacks for development
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "kyradi.com";
const ADMIN_HOST = import.meta.env.VITE_ADMIN_HOST || "admin.kyradi.com";
const APP_HOST = import.meta.env.VITE_APP_HOST || "app.kyradi.com";

// Development hosts
const DEV_HOSTS = ["localhost", "127.0.0.1"];

/**
 * Get current hostname without port
 */
export function getCurrentHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

/**
 * Get current host with port (for dev)
 */
export function getCurrentHostWithPort(): string {
  if (typeof window === "undefined") return "";
  return window.location.host.toLowerCase();
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  const host = getCurrentHost();
  return DEV_HOSTS.includes(host);
}

/**
 * Detect the type of host
 */
export function detectHostType(): HostType {
  const host = getCurrentHost();
  const hostWithPort = getCurrentHostWithPort();
  
  // Development mode - use path-based routing
  if (isDevelopment()) {
    // In dev, we'll use path to determine context
    // /admin/* -> admin
    // /partner/* or /app/* -> app
    // Default -> app (for signup/onboarding)
    const path = window.location.pathname;
    if (path.startsWith("/admin")) return "admin";
    return "app";
  }
  
  // Production mode - use host-based routing
  
  // Admin host
  if (host === ADMIN_HOST || hostWithPort === ADMIN_HOST) {
    return "admin";
  }
  
  // App host (main application)
  if (host === APP_HOST || hostWithPort === APP_HOST) {
    return "app";
  }
  
  // Tenant subdomain ({slug}.kyradi.com)
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = host.replace(`.${ROOT_DOMAIN}`, "");
    // Exclude known subdomains
    if (!["admin", "app", "www", "api"].includes(subdomain)) {
      return "tenant";
    }
  }
  
  // Custom domain (not our domain at all)
  if (!host.endsWith(ROOT_DOMAIN) && !isDevelopment()) {
    return "tenant";
  }
  
  return "unknown";
}

/**
 * Extract tenant slug from host
 * Returns null if not a tenant host
 */
export function extractTenantSlug(): string | null {
  const host = getCurrentHost();
  
  // Development mode - no tenant from host
  if (isDevelopment()) {
    return null;
  }
  
  // Subdomain pattern
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = host.replace(`.${ROOT_DOMAIN}`, "");
    if (!["admin", "app", "www", "api"].includes(subdomain)) {
      return subdomain;
    }
  }
  
  return null;
}

/**
 * Get custom domain if current host is a custom domain
 */
export function getCustomDomain(): string | null {
  const host = getCurrentHost();
  
  if (isDevelopment()) return null;
  if (host.endsWith(ROOT_DOMAIN)) return null;
  
  return host;
}

/**
 * Build URL for admin host
 */
export function getAdminUrl(path: string = "/"): string {
  if (isDevelopment()) {
    return `${window.location.origin}${path}`;
  }
  return `https://${ADMIN_HOST}${path}`;
}

/**
 * Build URL for app host
 */
export function getAppUrl(path: string = "/"): string {
  if (isDevelopment()) {
    return `${window.location.origin}${path}`;
  }
  return `https://${APP_HOST}${path}`;
}

/**
 * Build URL for tenant host
 */
export function getTenantUrl(slug: string, path: string = "/"): string {
  if (isDevelopment()) {
    // In dev, stay on same host but use path
    return `${window.location.origin}/app${path}`;
  }
  return `https://${slug}.${ROOT_DOMAIN}${path}`;
}

/**
 * Build partner login URL with optional redirect
 */
export function getPartnerLoginUrl(redirectUrl?: string): string {
  const baseUrl = getAppUrl("/partner/login");
  if (redirectUrl) {
    return `${baseUrl}?redirect=${encodeURIComponent(redirectUrl)}`;
  }
  return baseUrl;
}

/**
 * Build admin login URL
 */
export function getAdminLoginUrl(): string {
  return getAdminUrl("/login");
}

/**
 * Check if current user should be redirected based on host and role
 */
export function shouldRedirectToCorrectHost(userRole: string): { shouldRedirect: boolean; targetUrl: string | null } {
  const hostType = detectHostType();
  const isAdmin = userRole === "super_admin" || userRole === "support";
  
  // Admin on non-admin host
  if (isAdmin && hostType !== "admin" && !isDevelopment()) {
    return { shouldRedirect: true, targetUrl: getAdminUrl("/admin") };
  }
  
  // Non-admin on admin host
  if (!isAdmin && hostType === "admin" && !isDevelopment()) {
    return { shouldRedirect: true, targetUrl: getAppUrl("/partner/login") };
  }
  
  return { shouldRedirect: false, targetUrl: null };
}

export const hostConfig = {
  ROOT_DOMAIN,
  ADMIN_HOST,
  APP_HOST,
  isDevelopment,
  detectHostType,
  extractTenantSlug,
  getCustomDomain,
  getAdminUrl,
  getAppUrl,
  getTenantUrl,
  getPartnerLoginUrl,
  getAdminLoginUrl,
};
