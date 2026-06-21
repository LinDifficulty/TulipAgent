"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Phone } from "lucide-react";
import { updateMyProfile } from "@/lib/api";

interface PhoneDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentPhone: string | null;
}

export function PhoneDialog({
  open,
  onClose,
  onSaved,
  currentPhone,
}: PhoneDialogProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(currentPhone || "");
      setError("");
    }
  }, [open, currentPhone]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    // 简单校验：非空时必须是数字（可选带+号）
    if (trimmed && !trimmed.replace("+", "").replace(/\s/g, "").match(/^\d+$/)) {
      setError("请输入正确的手机号");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await updateMyProfile({ phone: trimmed || null });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
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
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-sm mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              编辑手机号
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
              手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号（选填）"
              autoFocus
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              填写后快递查询时会自动使用后四位
            </p>
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
              {submitting ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
