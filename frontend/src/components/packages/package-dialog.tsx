"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PackagePlus, X } from "lucide-react";
import { createPackage, PackageData } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface PackageDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (pkg: PackageData) => void;
}

export function PackageDialog({ open, onClose, onCreated }: PackageDialogProps) {
  const { account } = useAuth();
  const trackingRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState("shared");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setError("");
      // 从账户手机号取后四位作为默认值
      const phone = account?.phone;
      setPhoneLast4(phone && phone.length >= 4 ? phone.slice(-4) : "");
    }
  }, [open, account]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trackingNumber = trackingRef.current?.value?.trim() ?? "";
    const itemName = nameRef.current?.value?.trim() ?? "";

    if (!trackingNumber) {
      setError("请输入快递单号");
      return;
    }
    if (!itemName) {
      setError("请输入物品名称");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const created = await createPackage({
        tracking_number: trackingNumber,
        item_name: itemName,
        scope,
        phone_last4: phoneLast4 || undefined,
      });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "添加失败，请重试";
      setError(message);
      console.error(err);
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
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40">
              <PackagePlus className="h-4 w-4 text-orange-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">添加快递</h2>
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
              快递单号 <span className="text-destructive">*</span>
            </label>
            <input
              ref={trackingRef}
              type="text"
              placeholder="例如：SF1234567890123"
              autoFocus
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-mono transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              支持顺丰、中通、圆通、韵达、申通、极兔、京东等主流快递
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              物品名称 <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              placeholder="例如：给宝贝的礼物"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              手机号后四位
            </label>
            <input
              ref={phoneRef}
              type="text"
              value={phoneLast4}
              onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              placeholder="部分快递公司查询需要"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-mono transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              选填，部分快递公司查询物流时需要验证
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              可见范围
            </label>
            <div className="flex gap-2">
              {[
                { value: "personal", label: "个人" },
                { value: "shared", label: "共享" },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                    scope === s.value
                      ? "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/30"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "添加中..." : "添加"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
