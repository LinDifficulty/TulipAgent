"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { KeyRound, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("请输入令牌");
      return;
    }

    setLoading(true);
    setError("");

    const success = await login(token.trim());
    if (success) {
      router.push("/");
    } else {
      setError("令牌无效或账户已被禁用");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-background px-4">
      <div className="w-full max-w-sm">
        {/* 品牌标识 */}
        <div className="text-center mb-8">
          <span className="text-5xl select-none block mb-3" role="img" aria-label="tulip">
            🌷
          </span>
          <h1 className="text-2xl font-bold text-foreground">TulipAgent</h1>
          <p className="text-sm text-muted-foreground mt-1.5">你们的专属助理</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-foreground mb-2">
              令牌
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError("");
                }}
                placeholder="请输入您的登录令牌"
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3.5 py-2.5 animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "登录"
            )}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          令牌由管理员在后台创建和分发
        </p>
      </div>
    </div>
  );
}
