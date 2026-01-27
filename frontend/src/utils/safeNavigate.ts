import type { NavigateFunction } from "react-router-dom";

const REDIRECT_PREFIX = "redir:";

function getCurrentPath(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function shouldSkipRedirect(target: string): boolean {
  if (typeof window === "undefined") return false;
  const currentPath = getCurrentPath();
  if (target === currentPath) return true;

  const key = `${REDIRECT_PREFIX}${window.location.host}:${target}`;
  if (sessionStorage.getItem(key)) return true;
  sessionStorage.setItem(key, "1");
  return false;
}

function devNavigationGuard(target: string) {
  if (typeof window === "undefined" || !import.meta.env.DEV) return;
  const now = Date.now();
  const key = "nav:guard";
  const raw = sessionStorage.getItem(key);
  const data = raw ? JSON.parse(raw) as { count: number; ts: number } : { count: 0, ts: now };
  const elapsed = now - data.ts;
  const next = elapsed < 2000 ? { count: data.count + 1, ts: data.ts } : { count: 1, ts: now };
  sessionStorage.setItem(key, JSON.stringify(next));

  if (next.count > 5 && elapsed < 2000) {
    // Minimal dev-only warning to help detect redirect loops
    console.debug(`[nav-guard] yüksek yönlendirme: ${next.count} kez -> ${target}`);
  }
}

export function safeNavigate(navigate: NavigateFunction, to: string, replace: boolean = true) {
  if (typeof window !== "undefined") {
    if (shouldSkipRedirect(to)) return;
    devNavigationGuard(to);
  }
  navigate(to, { replace });
}

export function safeHardRedirect(url: string) {
  if (typeof window === "undefined") return;
  if (window.location.href === url) return;
  if (shouldSkipRedirect(url)) return;
  devNavigationGuard(url);
  window.location.assign(url);
}
