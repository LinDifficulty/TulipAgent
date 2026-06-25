"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, BookOpen, Pencil } from "lucide-react";
import { addWorkLogContent, updateWorkLogContent, WorkLogData } from "@/lib/api";

interface WorkLogDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded?: (log: WorkLogData) => void;
  onUpdated?: (log: WorkLogData) => void;
  /** 如果提供 editData，对话框为编辑模式 */
  editData?: {
    logId: number;
    index: number;
    content: string;
  } | null;
}

export function WorkLogDialog({ open, onClose, onAdded, onUpdated, editData }: WorkLogDialogProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEditMode = !!editData;

  useEffect(() => {
    if (open) {
      setError("");
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.value = editData?.content ?? "";
          contentRef.current.focus();
        }
      });
    }
  }, [open, editData]);

  if (!open) return null;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = contentRef.current?.value?.trim() ?? "";
    if (!content) {
      setError("请输入工作内容");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      if (isEditMode && editData) {
        const result = await updateWorkLogContent(editData.logId, editData.index, content);
        onUpdated?.(result);
      } else {
        const result = await addWorkLogContent({ content });
        onAdded?.(result);
      }
      handleClose();
    } catch (err) {
      setError(isEditMode ? "保存失败，请重试" : "添加失败，请重试");
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
        onClick={handleClose}
      />
      {/* Dialog */}
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-md mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
              {isEditMode ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <BookOpen className="h-4 w-4 text-primary" />
              )}
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isEditMode ? "编辑工作内容" : "添加工作内容"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              工作内容 <span className="text-destructive">*</span>
            </label>
            <textarea
              ref={contentRef}
              placeholder="今天做了什么..."
              rows={4}
              autoFocus
              className="flex w-full rounded-lg border border-input bg-background px-4 py-3 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (isEditMode ? "保存中..." : "添加中...") : (isEditMode ? "保存" : "添加")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
