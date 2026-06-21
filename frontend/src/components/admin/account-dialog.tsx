"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, RefreshCw } from "lucide-react";
import {
  adminCreateAccount,
  adminUpdateAccount,
  type AdminAccount,
  type AdminGroup,
} from "@/lib/api";

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editAccount?: AdminAccount | null;
  groups: AdminGroup[];
}

export function AccountDialog({
  open,
  onClose,
  onSaved,
  editAccount,
  groups,
}: AccountDialogProps) {
  const isEdit = !!editAccount;

  const [token, setToken] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user");
  const [groupId, setGroupId] = useState<string>("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tokenSpinning, setTokenSpinning] = useState(false);

  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editAccount) {
        setToken(editAccount.token);
        setNickname(editAccount.nickname);
        setPhone(editAccount.phone || "");
        setRole(editAccount.role);
        setGroupId(editAccount.group_id?.toString() || "");
      } else {
        setToken("");
        setNickname("");
        setPhone("");
        setRole("user");
        setGroupId("");
      }
      setError("");
      requestAnimationFrame(() => tokenRef.current?.focus());
    }
  }, [open, editAccount]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !nickname.trim()) {
      setError("令牌和昵称不能为空");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isEdit && editAccount) {
        const gid = groupId ? parseInt(groupId) : 0;
        await adminUpdateAccount(editAccount.id, {
          token: token.trim(),
          nickname: nickname.trim(),
          phone: phone.trim() || null,
          role,
          group_id: gid,
        });
      } else {
        const gid = groupId ? parseInt(groupId) : null;
        await adminCreateAccount({
          token: token.trim(),
          nickname: nickname.trim(),
          phone: phone.trim() || null,
          role,
          group_id: gid,
        });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-md mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? "编辑账号" : "新增账号"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              令牌 <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-1.5">
              <input
                ref={tokenRef}
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="登录令牌"
                className="flex h-10 flex-1 min-w-0 rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
              />
              <button
                type="button"
                onClick={() => {
                  const chars =
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                  let t = "";
                  for (let i = 0; i < 16; i++) {
                    t += chars.charAt(
                      Math.floor(Math.random() * chars.length)
                    );
                  }
                  setToken(t);
                  setTokenSpinning(true);
                  setTimeout(() => setTokenSpinning(false), 500);
                }}
                className="flex items-center justify-center w-10 h-10 bg-muted text-muted-foreground rounded-lg hover:text-foreground hover:bg-muted/80 transition-all shrink-0"
                title="随机生成令牌"
              >
                <RefreshCw
                  className={`h-4 w-4 transition-transform ${
                    tokenSpinning ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              昵称 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="用户昵称"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号（选填）"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              角色
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              用户组
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            >
              <option value="">无（独立用户）</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {submitting
                ? isEdit
                  ? "保存中..."
                  : "创建中..."
                : isEdit
                ? "保存"
                : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
