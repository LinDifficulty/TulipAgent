"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AccountInfo {
  id: number;
  token: string;
  nickname: string;
  phone: string | null;
  role: string;
  group_id: number | null;
}

interface AuthState {
  token: string | null;
  account: AccountInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "tulip_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：从 localStorage 恢复 token 并验证
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      validateToken(savedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data: AccountInfo = await res.json();
        setAccount(data);
        setToken(t);
      } else {
        // token 无效，清除
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setAccount(null);
      }
    } catch {
      // 网络错误时保留 token，下次重试
    }
  };

  const login = useCallback(async (t: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setAccount(data.account);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAccount(null);
  }, []);

  const refreshAccount = useCallback(async () => {
    const t = token || localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data: AccountInfo = await res.json();
        setAccount(data);
      }
    } catch {
      // 忽略网络错误
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        account,
        isAuthenticated: !!token && !!account,
        isAdmin: account?.role === "admin",
        isLoading,
        login,
        logout,
        refreshAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
