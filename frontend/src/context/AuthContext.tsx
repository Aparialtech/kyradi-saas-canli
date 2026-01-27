import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { authService } from "../services/auth";
import { tokenStorage } from "../lib/tokenStorage";
import { setOnUnauthorized } from "../lib/http";
import { errorLogger } from "../lib/errorLogger";
import type { AuthUser, LoginPayload, UserRole } from "../types/auth";
import { safeNavigate } from "../utils/safeNavigate";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initialize = async () => {
      const storedToken = tokenStorage.get();
      const debugAuth = import.meta.env.VITE_DEBUG_AUTH === "true";
      try {
        if (storedToken) {
          setToken(storedToken);
        }
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        if (debugAuth) {
          console.debug("[auth] /auth/me ok", { role: currentUser.role, host: window.location.host });
        }
      } catch (error) {
        errorLogger.error(error, {
          component: "AuthContext",
          action: "getCurrentUser",
        });
        if (debugAuth) {
          console.debug("[auth] /auth/me failed", { host: window.location.host });
        }
        tokenStorage.clear();
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authService.login(payload);
    
    // If SMS verification is required, don't set token yet
    if (response.status === "phone_verification_required") {
      // Return a special response that the LoginPage can handle
      throw new Error("PHONE_VERIFICATION_REQUIRED");
    }
    
    if (!response.access_token) {
      throw new Error("No access token received");
    }
    
    tokenStorage.set(response.access_token);
    setToken(response.access_token);

    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);

    return currentUser;
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      errorLogger.error(error, {
        component: "AuthContext",
        action: "refreshUser",
      });
      tokenStorage.clear();
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    localStorage.removeItem("tenant_slug");
    setToken(null);
    setUser(null);
    safeNavigate(navigate, "/login");
  }, [navigate]);

  // Register the 401 handler callback
  useEffect(() => {
    setOnUnauthorized(() => {
      errorLogger.warn(new Error("Session expired"), {
        component: "AuthContext",
        action: "sessionExpired",
      });
      setToken(null);
      setUser(null);
      localStorage.removeItem("tenant_slug");
      safeNavigate(navigate, "/login");
    });
    
    return () => {
      setOnUnauthorized(() => {}); // Cleanup
    };
  }, [navigate]);

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]) => {
      if (!user) return false;
      const roleList = Array.isArray(roles) ? roles : [roles];
      return roleList.includes(user.role);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
      refreshUser,
      hasRole,
    }),
    [user, token, isLoading, login, logout, refreshUser, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
