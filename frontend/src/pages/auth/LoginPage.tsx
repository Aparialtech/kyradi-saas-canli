import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { detectHostType, getTenantUrl, isDevelopment } from "../../lib/hostDetection";

/**
 * Login Page - Auto-redirects based on auth status
 * 
 * MENTOR REQUIREMENT:
 * - Admin ve Partner login aynı ekranda OLMAYACAK
 * - "Hesap türü seç" ekranı YOK
 * - /login -> /partner/login redirect
 * 
 * Routes:
 * - /partner/login -> Partner girişi
 * - /admin/login -> Admin girişi
 */
export function LoginPage() {
  const TENANT_SLUG_CACHE_KEY = "kyradi:tenant_slug";
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      // Already logged in - redirect to appropriate dashboard
      if (user.role === "super_admin" || user.role === "support") {
        navigate("/admin", { replace: true });
      } else {
        const hostType = detectHostType();
        if (!isDevelopment() && hostType === "app") {
          const cachedTenantSlug = localStorage.getItem(TENANT_SLUG_CACHE_KEY);
          if (cachedTenantSlug) {
            window.location.href = getTenantUrl(cachedTenantSlug, "/app");
            return;
          }
        }
        navigate("/app", { replace: true });
      }
    } else {
      // Not logged in - redirect to partner login (default)
      navigate("/partner/login", { replace: true });
    }
  }, [isLoading, user, navigate]);

  // Show nothing while redirecting
  return null;
}
