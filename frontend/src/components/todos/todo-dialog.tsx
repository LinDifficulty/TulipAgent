"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import { X, ListTodo, CalendarDays } from "lucide-react";
import { createTodo, updateTodo, TodoData } from "@/lib/api";

interface TodoDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (todo: TodoData) => void;
  onUpdated?: (todo: TodoData) => void;
  editTodo?: TodoData | null;
}

const PRIORITIES = [
  { value: "low", label: "低", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/30" },
  { value: "medium", label: "中", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/30" },
  { value: "high", label: "高", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/30" },
];

export function TodoDialog({ open, onClose, onCreated, onUpdated, editTodo }: TodoDialogProps) {
  const isEdit = !!editTodo;

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const [dueDate, setDueDate] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [scope, setScope] = useState("shared");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 弹窗打开时重置/填充表单
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      if (editTodo) {
        setPriority(editTodo.priority || "medium");
        setDueDate(editTodo.due_date || "");
        setScope(editTodo.scope || "shared");
      } else {
        setPriority("medium");
        setDueDate("");
        setScope("shared");
      }
      setError("");
    }
  }, [open, editTodo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 单独处理 ref 赋值（因为 ref 不在 deps 中）
  useEffect(() => {
    if (open) {
      // 延迟一帧确保 ref 已挂载
      requestAnimationFrame(() => {
        if (titleRef.current) {
          titleRef.current.value = editTodo?.title || "";
        }
        if (descRef.current) {
          descRef.current.value = editTodo?.description || "";
        }
      });
    }
  }, [open, editTodo]);

  if (!open) return null;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = titleRef.current?.value?.trim() ?? "";
    const description = descRef.current?.value?.trim() ?? "";

    if (!title) {
      setError("请输入标题");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      if (isEdit && editTodo?.id) {
        const updated = await updateTodo(editTodo.id, {
          title,
          description: description || undefined,
          due_date: dueDate || "",
          priority: priority as "low" | "medium" | "high",
          scope,
        });
        onUpdated?.(updated);
      } else {
        const todo: TodoData = {
          title,
          description: description || undefined,
          due_date: dueDate || "",
          priority: priority as "low" | "medium" | "high",
          scope,
        };
        const created = await createTodo(todo);
        onCreated?.(created);
      }
      handleClose();
    } catch (err) {
      setError(isEdit ? "更新失败，请重试" : "创建失败，请重试");
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
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{isEdit ? "编辑待办" : "添加待办"}</h2>
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
              标题 <span className="text-destructive">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              placeholder="例如：买牛奶"
              autoFocus
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              描述
            </label>
            <input
              ref={descRef}
              type="text"
              placeholder="可选的补充说明"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all duration-150 placeholder:text-muted-foreground/50 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              截止日期
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDatePickerOpen(true)}
                className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-all duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
              >
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={dueDate ? "text-foreground" : "text-muted-foreground/50"}>
                  {dueDate || "无需截止日期"}
                </span>
              </button>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="h-10 w-10 shrink-0 rounded-lg border border-input bg-background flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all duration-150"
                  aria-label="清除截止日期"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              优先级
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                    priority === p.value
                      ? p.color
                      : "bg-background text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
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
            <Button type="button" variant="ghost" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "保存中..."
                  : "创建中..."
                : isEdit
                  ? "保存"
                  : "创建"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  // 使用 portal 渲染到 document.body，避免被父级 overflow-hidden 裁剪
  return (
    <>
      {createPortal(dialog, document.body)}
      <DatePicker
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(val) => setDueDate(val)}
        defaultValue={dueDate}
      />
    </>
  );
}
