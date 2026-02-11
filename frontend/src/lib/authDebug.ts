export function dumpAuthDebug(label: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const storageToken =
      localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
    // HttpOnly cookies are not visible here; this still helps detect non-HttpOnly auth remnants.
    console.log(`[AUTH_DEBUG] ${label}`, {
      host: window.location.host,
      origin: window.location.origin,
      cookie: document.cookie,
      storageToken,
      justLoggedInAt: sessionStorage.getItem("kyradi.justLoggedInAt"),
    });
  } catch {
    // ignore debug failures
  }
}
