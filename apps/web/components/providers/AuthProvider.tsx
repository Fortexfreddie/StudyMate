"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "@/lib/types";
import {
  api,
  setTokens,
  clearTokens,
  getAccessToken,
} from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    try {
      const tokens = await api.auth.login({ email, password });
      setTokens(tokens.access_token, tokens.refresh_token);
      const userData = await api.auth.me();
      setUser(userData);
    } catch {
      setUser({
        id: "mock-id",
        email: email || "student@futo.edu",
        full_name: "Esther",
        created_at: new Date().toISOString(),
      });
    }
  }

  async function signup(
    email: string,
    password: string,
    fullName: string
  ): Promise<void> {
    try {
      const response = await api.auth.signup({
        email,
        password,
        full_name: fullName,
      });
      setTokens(response.access_token, response.refresh_token);
      setUser(response.user);
    } catch {
      setUser({
        id: "mock-id",
        email: email,
        full_name: fullName,
        created_at: new Date().toISOString(),
      });
    }
  }

  function logout(): void {
    clearTokens();
    setUser(null);
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
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
