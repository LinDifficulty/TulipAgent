"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time-picker";
import { X, Gift, CalendarDays } from "lucide-react";
import { createAnniversary, AnniversaryData } from "@/lib/api";

interface AnniversaryDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (anniversary: AnniversaryData) => void;
}

function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function AnniversaryDialog({ open, onClose, onCreated }: AnniversaryDialogProps) {
  const defaultDate = useMemo(() => toDateInput(new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]);

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const [anniversaryDate, setAnniversaryDate] = useState(defaultDate);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [repeatRule, setRepeatRule] = useState("yearly");
  const [scope, setScope] = useState("shared");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setRepeatRule("yearly");
      setScope("shared");
      setError("");
      setAnniversaryDate(defaultDate);
    }
  }, [open, defaultDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = titleRef.current?.value?.trim() ?? "";
    const description = descRef.current?.value?.trim() ?? "";

    if (!title) {
      setError("请输入纪念日名称");
      return;
    }
    if (!anniversaryDate) {
      setError("请选择日期");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const data: AnniversaryData = {
        title,
        description: description || undefined,
        date: anniversaryDate,
        repeat_rule: repeatRule,
        scope,
      };
      const created = await createAnniversary(data);
      onCreated(created);
      handleClose();
    } catch (err) {
      setError("创建失败，请重试");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const REPEAT_OPTIONS = [
    { value: "yearly", label: "每年" },
    { value: "none", label: "不重复" },
  ];

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-md mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <Gift className="h-4 w-4 text-rose-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">添加纪念日</h2>
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
              名称 <span className="text-destructive">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              placeholder="例如：结婚纪念日"
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
              日期 <span className="text-destructive">*</span>
            </label>
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-all duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
            >
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className={anniversaryDate ? "text-foreground" : "text-muted-foreground/50"}>
                {anniversaryDate || "点击选择"}
              </span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              重复
            </label>
            <div className="flex gap-2">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepeatRule(opt.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                    repeatRule === opt.value
                      ? "bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/30"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {opt.label}
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
              {submitting ? "创建中..." : "创建"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(dialog, document.body)}
      <DatePicker
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(val) => setAnniversaryDate(val)}
        defaultValue={anniversaryDate}
      />
    </>
  );
}

