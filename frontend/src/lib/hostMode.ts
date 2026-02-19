export type HostMode = "admin" | "app" | "tenant" | "public";

const RESERVED_HOSTS = new Set([
  "admin.kyradi.com",
  "app.kyradi.com",
  "branding.kyradi.com",
  "www.kyradi.com",
  "kyradi.com",
]);

const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "app",
  "branding",
  "www",
  "api",
  "mail",
  "cdn",
  "status",
]);

function normalize(hostname: string): string {
  return hostname.split(":")[0].trim().toLowerCase();
}

export function getHostMode(hostname: string): HostMode {
  const host = normalize(hostname);

  if (!host) return "public";
  if (host === "admin.kyradi.com") return "admin";
  if (host === "app.kyradi.com") return "app";
  if (RESERVED_HOSTS.has(host)) return "public";

  if (host.endsWith(".kyradi.com")) {
    const subdomain = host.replace(".kyradi.com", "");
    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
      return "tenant";
    }
  }

  if (host === "localhost" || host === "127.0.0.1") return "app";

  return "public";
}

export function isTenantHost(hostname: string): boolean {
  return getHostMode(hostname) === "tenant";
}
