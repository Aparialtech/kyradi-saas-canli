import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

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
        navigate("/admin", { replace: true });
      } else {
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
