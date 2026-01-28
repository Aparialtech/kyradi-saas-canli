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
  const target = `${window.location.origin}/app`;
  return getPartnerLoginUrl(target);
}

export function RequireAuth({
  allowedRoles,
  redirectTo = "/login",
}: RequireAuthProps) {
  const { user, isLoading, hasRole } = useAuth();
  const hostType = detectHostType();
  const location = useLocation();
  const debugAuth = import.meta.env.VITE_DEBUG_AUTH === "true";

  if (isLoading) {
    return null;
  }

  if (!user) {
    if (debugAuth) {
      console.debug("[auth-guard] unauthenticated", { host: window.location.host, path: location.pathname });
    }
    if (debugAuth) {
      console.debug("[auth-guard] redirecting-to-login", { host: window.location.host, path: location.pathname });
    }
    // For tenant hosts (subdomain), redirect to app host with redirect param
    if (hostType === "tenant" && !isDevelopment()) {
      const loginUrl = buildPartnerLoginRedirect();
      const key = `redir:${window.location.host}:${loginUrl}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        safeHardRedirect(loginUrl);
      }
      return <FullPageSpinner />;
    }
    
    // For other hosts, use normal React Router redirect
    if (location.pathname + location.search === redirectTo) {
      return null;
    }
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    if (debugAuth) {
      console.debug("[auth-guard] role-mismatch", { role: user?.role, allowedRoles });
    }
    // Role mismatch → yönlendir
    const fallback = hasRole(["super_admin", "support"]) ? "/admin" : "/app";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
