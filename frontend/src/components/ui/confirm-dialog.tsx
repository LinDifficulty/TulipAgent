"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, AlertTriangle, Info, ShieldAlert } from "lucide-react";

export type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 弹窗标题 */
  title: string;
  /** 弹窗描述信息 */
  message: string;
  /** 风格变体：danger（删除/危险操作）、warning（警告）、info（一般提示） */
  variant?: ConfirmVariant;
  /** 确认按钮文字，默认根据 variant 自动设置 */
  confirmLabel?: string;
  /** 取消按钮文字，默认"取消" */
  cancelLabel?: string;
  /** 是否正在执行操作（显示加载状态） */
  loading?: boolean;
}

const VARIANT_CONFIG: Record<
  ConfirmVariant,
  {
    icon: typeof AlertTriangle;
    iconBg: string;
    iconColor: string;
    confirmVariant: "default" | "destructive";
    defaultConfirmLabel: string;
  }
> = {
  danger: {
    icon: ShieldAlert,
    iconBg: "bg-destructive/10 dark:bg-destructive/20",
    iconColor: "text-destructive",
    confirmVariant: "destructive",
    defaultConfirmLabel: "确定删除",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    confirmVariant: "default",
    defaultConfirmLabel: "确定",
  },
  info: {
    icon: Info,
    iconBg: "bg-primary/10 dark:bg-primary/20",
    iconColor: "text-primary",
    confirmVariant: "default",
    defaultConfirmLabel: "确定",
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  variant = "info",
  confirmLabel,
  cancelLabel = "取消",
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    if (loading) return;
    onConfirm();
  };

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={loading ? undefined : onClose}
      />

      {/* Dialog card */}
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-sm mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg",
                config.iconBg
              )}
            >
              <Icon className={cn("h-4 w-4", config.iconColor)} />
            </div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "处理中..." : (confirmLabel ?? config.defaultConfirmLabel)}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
