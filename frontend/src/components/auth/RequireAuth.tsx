import { Navigate, Outlet } from "react-router-dom";

import { FullPageSpinner } from "../common/FullPageSpinner";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/auth";

interface RequireAuthProps {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export function RequireAuth({
  allowedRoles,
  redirectTo = "/login",
}: RequireAuthProps) {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    // Role mismatch → yönlendir
    const fallback = hasRole(["super_admin", "support"]) ? "/admin" : "/app";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
