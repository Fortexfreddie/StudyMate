"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import {
  api,
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  AUTH_EXPIRED_EVENT,
  type AuthExpiredReason,
} from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  /** Replace the cached user (e.g. after a profile update). */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Single global handler for terminal auth failures (expired session or a
  // suspension enforced mid-session). The API layer emits this when a request's
  // 401 can't be recovered; we clear state once and redirect to login, carrying a
  // reason so the login screen can show the right message — rather than leaving a
  // stray error on whatever page happened to make the failing request.
  useEffect(() => {
    function onAuthExpired(event: Event) {
      const reason: AuthExpiredReason =
        (event as CustomEvent<{ reason?: AuthExpiredReason }>).detail?.reason ??
        "expired";
      clearTokens();
      setUser(null);
      router.replace(`/login?reason=${reason}`);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, [router]);

  useEffect(() => {
    async function hydrate() {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const tokens = await api.auth.login({ email, password });
    setTokens(tokens.access_token, tokens.refresh_token);
    const userData = await api.auth.me();
    setUser(userData);
  }

  async function signup(
    email: string,
    password: string,
    fullName: string
  ): Promise<void> {
    const response = await api.auth.signup({
      email,
      password,
      full_name: fullName,
    });
    setTokens(response.access_token, response.refresh_token);
    setUser(response.user);
  }

  function logout(): void {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Revoke the refresh token server-side; fire-and-forget so logout is instant.
      api.auth.logout(refreshToken).catch(() => {});
    }
    clearTokens();
    setUser(null);
  }

  function updateUser(updated: User): void {
    setUser(updated);
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    updateUser,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
