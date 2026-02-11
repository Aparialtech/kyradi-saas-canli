import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { authService } from "../services/auth";
import { tokenStorage } from "../lib/tokenStorage";
import { setOnUnauthorized } from "../lib/http";
import { errorLogger } from "../lib/errorLogger";
import type { AuthUser, LoginPayload, UserRole } from "../types/auth";
import { detectHostType, getPartnerLoginUrl, isDevelopment } from "../lib/hostDetection";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const handlingUnauthorizedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const initialize = async () => {
      const storedToken = tokenStorage.get();
      if (storedToken) {
        setToken(storedToken);
      }
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        let recovered = false;
        if (storedToken) {
          // Retry once to avoid transient post-login cookie propagation races.
          await new Promise((resolve) => setTimeout(resolve, 250));
          try {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
            recovered = true;
          } catch {
            recovered = false;
          }
        }
        if (!recovered) {
          errorLogger.error(error, {
            component: "AuthContext",
            action: "getCurrentUser",
          });
          if (storedToken) {
            tokenStorage.clear();
            setToken(null);
          }
        }
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

  const logout = useCallback(() => {
    void authService.logout().catch((error) => {
      errorLogger.warn(error, { component: "AuthContext", action: "logout" });
    });
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    const hostType = detectHostType();
    if (hostType === "admin") {
      navigate("/admin/login");
      return;
    }
    navigate("/partner/login");
  }, [navigate]);

  // Register the 401 handler callback
  useEffect(() => {
    setOnUnauthorized(() => {
      if (handlingUnauthorizedRef.current) {
        return;
      }
      handlingUnauthorizedRef.current = true;
      const releaseGuard = () => {
        window.setTimeout(() => {
          handlingUnauthorizedRef.current = false;
        }, 1000);
      };
      errorLogger.warn(new Error("Session expired"), {
        component: "AuthContext",
        action: "sessionExpired",
      });
      setToken(null);
      setUser(null);
      tokenStorage.clear();

      const hostType = detectHostType();
      if (hostType === "tenant" && !isDevelopment()) {
        releaseGuard();
        window.location.href = getPartnerLoginUrl(window.location.href);
        return;
      }
      if (hostType === "admin") {
        releaseGuard();
        navigate("/admin/login");
        return;
      }
      releaseGuard();
      navigate("/partner/login");
    });
    
    return () => {
      handlingUnauthorizedRef.current = false;
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
      hasRole,
    }),
    [user, token, isLoading, login, logout, hasRole],
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
