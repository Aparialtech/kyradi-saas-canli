import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageSpinner } from "../common/FullPageSpinner";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/auth";
import { detectHostType, getPartnerLoginUrl, isDevelopment } from "../../lib/hostDetection";
import { safeHardRedirect } from "../../utils/safeNavigate";

interface RequireAuthProps {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

/**
 * Build redirect URL for partner login with current URL as redirect param.
 * Only allows redirects to kyradi.com subdomains for security.
 */
function buildPartnerLoginRedirect(): string {
  const currentUrl = window.location.href;
  
  // Security: Only allow redirects to kyradi.com domains
  try {
    const url = new URL(currentUrl);
    const isKyradiDomain = url.hostname.endsWith(".kyradi.com") || 
                          url.hostname === "kyradi.com" ||
                          url.hostname === "localhost" ||
                          url.hostname === "127.0.0.1";
    
    if (isKyradiDomain) {
      return getPartnerLoginUrl(currentUrl);
    }
  } catch {
    // Invalid URL, don't add redirect
  }
  
  return getPartnerLoginUrl();
}

export function RequireAuth({
  allowedRoles,
  redirectTo = "/login",
}: RequireAuthProps) {
  const { user, isLoading, hasRole } = useAuth();
  const hostType = detectHostType();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!user) {
    if (import.meta.env.DEV) {
      console.debug("[auth-guard] unauthenticated", { host: window.location.host, path: location.pathname });
    }
    // For tenant hosts (subdomain), redirect to app host with redirect param
    if (hostType === "tenant" && !isDevelopment()) {
      const loginUrl = buildPartnerLoginRedirect();
      safeHardRedirect(loginUrl);
      return <FullPageSpinner />;
    }
    
    // For other hosts, use normal React Router redirect
    if (location.pathname + location.search === redirectTo) {
      return null;
    }
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    // Role mismatch → yönlendir
    const fallback = hasRole(["super_admin", "support"]) ? "/admin" : "/app";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
