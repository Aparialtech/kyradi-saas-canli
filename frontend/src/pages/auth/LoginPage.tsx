import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { safeNavigate } from "../../utils/safeNavigate";

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
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      // Already logged in - redirect to appropriate dashboard
      if (user.role === "super_admin" || user.role === "support") {
        safeNavigate(navigate, "/admin");
      } else {
        safeNavigate(navigate, "/app");
      }
    } else {
      // Not logged in - redirect to partner login (default)
      safeNavigate(navigate, "/partner/login");
    }
  }, [isLoading, user, navigate]);

  // Show nothing while redirecting
  return null;
}
