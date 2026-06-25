"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Shield,
  LogOut,
  Check,
  X,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { updateMyProfile } from "@/lib/api";

export function UserMenu() {
  const { account, isAdmin, logout, refreshAccount } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 同步初始值
  useEffect(() => {
    if (open && account) {
      setNickname(account.nickname || "");
      setPhone(account.phone || "");
      setToken(account.token || "");
      setError("");
      setSuccess("");
      setShowToken(false);
    }
  }, [open, account]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload: Record<string, unknown> = {};
    if (nickname.trim() && nickname.trim() !== account?.nickname) {
      payload.nickname = nickname.trim();
    }
    const phoneTrimmed = phone.trim();
    if (phoneTrimmed !== (account?.phone || "")) {
      payload.phone = phoneTrimmed || null;
    }
    if (token.trim() && token.trim() !== account?.token) {
      payload.token = token.trim();
    }

    if (Object.keys(payload).length === 0) {
      setSubmitting(false);
      return;
    }

    try {
      const updated = await updateMyProfile(
        payload as { nickname?: string; phone?: string | null; token?: string }
      );
      // 如果 token 更新了，更新 localStorage
      if (payload.token && typeof window !== "undefined") {
        localStorage.setItem("tulip_token", updated.token);
      }
      await refreshAccount();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToken = () => {
    if (account?.token) {
      navigator.clipboard.writeText(account.token);
      setSuccess("令牌已复制");
      setTimeout(() => setSuccess(""), 2000);
    }
  };

  const handleGoAdmin = () => {
    handleClose();
    router.push("/admin");
  };

  const handleLogout = () => {
    handleClose();
    logout();
  };

  if (!account) return null;

  const dialog = open && (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-xl w-[90vw] max-w-sm mx-4 animate-fade-in-up overflow-hidden">
        {/* 用户信息头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary">
                {account.nickname?.[0] || "?"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-foreground truncate">
                  {account.nickname}
                </p>
                {isAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                    管理员
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 编辑表单 */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            编辑资料
          </p>

          {/* 令牌 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              令牌
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="输入新令牌"
                autoFocus
                className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 pr-16 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleCopyToken}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="复制当前令牌"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 昵称 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="输入昵称"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          {/* 手机号 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="输入手机号（选填）"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          {/* 状态提示 */}
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-500 font-medium flex items-center gap-1">
              <Check className="h-4 w-4" />
              {success}
            </p>
          )}

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={submitting}
            className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              "保存中..."
            ) : (
              <>
                <Check className="h-4 w-4" />
                保存修改
              </>
            )}
          </button>
        </div>

        {/* 操作按钮区 */}
        <div className="border-t border-border p-3 flex items-center justify-center gap-2">
          {isAdmin && (
            <button
              onClick={handleGoAdmin}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-all"
            >
              <Shield className="h-4 w-4" />
              管理后台
            </button>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-all"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 触发按钮：头像 */}
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 transition-all duration-200 hover:bg-primary/20 hover:scale-105 active:scale-95"
        title={account.nickname || "用户"}
      >
        <span className="text-xs font-semibold text-primary">
          {account.nickname?.[0] || "?"}
        </span>
      </button>

      {createPortal(dialog, document.body)}
    </>
  );
}
