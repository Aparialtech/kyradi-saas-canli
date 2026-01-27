export type HostMode = "branding" | "admin" | "app" | "panel";

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

function normalizeHostname(hostname: string): string {
  return hostname.split(":")[0].trim().toLowerCase();
}

export function getHostMode(hostname: string): HostMode {
  const host = normalizeHostname(hostname);

  if (!host) return "panel";
  if (host === "branding.kyradi.com" || host === "kyradi.com" || host === "www.kyradi.com") {
    return "branding";
  }
  if (host === "admin.kyradi.com") return "admin";
  if (host === "app.kyradi.com") return "app";
  if (host === "localhost" || host === "127.0.0.1") return "app";
  if (host.endsWith(".vercel.app")) return "branding";

  if (host.endsWith(".kyradi.com")) {
    const subdomain = host.replace(".kyradi.com", "");
    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
      return "panel";
    }
  }

  return "branding";
}
