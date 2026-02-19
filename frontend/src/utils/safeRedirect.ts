type SafeRedirectOptions = {
  defaultPath?: string;
};

const DEFAULT_PATH = "/app";
const ALLOWED_HOSTS = ["kyradi.com"];

export function sanitizeRedirect(input: string | null, opts: SafeRedirectOptions = {}): string {
  const fallback = opts.defaultPath ?? DEFAULT_PATH;

  if (!input) {
    return fallback;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("//")) {
    return fallback;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return fallback;
    }

    const host = parsed.hostname.toLowerCase();
    const isAllowed =
      ALLOWED_HOSTS.includes(host) || ALLOWED_HOSTS.some((allowed) => host.endsWith(`.${allowed}`));

    return isAllowed ? trimmed : fallback;
  } catch {
    return fallback;
  }
}
