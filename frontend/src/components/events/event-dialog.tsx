"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { X, CalendarPlus, Clock } from "lucide-react";
import { createEvent, updateEvent, EventData } from "@/lib/api";

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (event: EventData) => void;
  onUpdated?: (event: EventData) => void;
  editEvent?: EventData | null;
}

/** 生成 datetime-local 输入框兼容的字符串 (YYYY-MM-DDTHH:MM) */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 将 API 返回的 ISO 时间字符串转为 datetime-local 格式 (YYYY-MM-DDTHH:MM) */
function toDatetimeLocalFromISO(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return toDatetimeLocal(d);
}

export function EventDialog({ open, onClose, onCreated, onUpdated, editEvent }: EventDialogProps) {
  const isEdit = !!editEvent;
  const defaultTimes = useMemo(() => {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return {
      start: toDatetimeLocal(now),
      end: toDatetimeLocal(twoHoursLater),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const [startTime, setStartTime] = useState(defaultTimes.start);
  const [endTime, setEndTime] = useState(defaultTimes.end);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 弹窗打开时重置/填充表单
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setError("");
      if (editEvent) {
        setStartTime(editEvent.start_time ? toDatetimeLocalFromISO(editEvent.start_time) : defaultTimes.start);
        setEndTime(editEvent.end_time ? toDatetimeLocalFromISO(editEvent.end_time) : defaultTimes.end);
      } else {
        setStartTime(defaultTimes.start);
        setEndTime(defaultTimes.end);
      }
    }
  }, [open, defaultTimes.start, defaultTimes.end, editEvent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 单独处理 ref 赋值
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (titleRef.current) {
          titleRef.current.value = editEvent?.title || "";
        }
        if (descRef.current) {
          descRef.current.value = editEvent?.description || "";
        }
      });
    }
  }, [open, editEvent]);

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
    if (!startTime) {
      setError("请选择开始时间");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      // Backend expects "YYYY-MM-DD HH:MM" format
      const formatLocal = (dt: string) => dt.replace("T", " ");

      if (isEdit && editEvent?.id) {
        const updated = await updateEvent(editEvent.id, {
          title,
          description: description || undefined,
          start_time: formatLocal(startTime),
          end_time: endTime ? formatLocal(endTime) : undefined,
        });
        onUpdated?.(updated);
      } else {
        const event: EventData = {
          title,
          description: description || undefined,
          start_time: formatLocal(startTime),
          end_time: endTime ? formatLocal(endTime) : undefined,
        };
        const created = await createEvent(event);
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

  // 格式化显示文本
  const formatDisplay = (dt: string) => {
    if (!dt) return "点击选择";
    const [date, time] = dt.split("T");
    const [, m, d] = date.split("-");
    const [h, min] = time.split(":");
    return `${m}/${d} ${h}:${min}`;
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
              <CalendarPlus className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{isEdit ? "编辑日程" : "添加日程"}</h2>
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
              placeholder="例如：周末聚餐"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                开始时间 <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => setPickerTarget("start")}
                className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-all duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={startTime ? "text-foreground" : "text-muted-foreground/50"}>
                  {formatDisplay(startTime)}
                </span>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                结束时间
              </label>
              <button
                type="button"
                onClick={() => setPickerTarget("end")}
                className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-all duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring/50"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={endTime ? "text-foreground" : "text-muted-foreground/50"}>
                  {formatDisplay(endTime)}
                </span>
              </button>
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
      <DateTimePicker
        open={pickerTarget === "start"}
        onClose={() => setPickerTarget(null)}
        onConfirm={(val) => {
          setStartTime(val);
          // 如果结束时间早于开始时间，自动设为开始时间+2小时
          if (endTime && val > endTime) {
            const newEnd = new Date(val.replace("T", "T"));
            newEnd.setHours(newEnd.getHours() + 2);
            setEndTime(toDatetimeLocal(newEnd));
          }
        }}
        defaultValue={startTime}
        title="选择开始时间"
      />
      <DateTimePicker
        open={pickerTarget === "end"}
        onClose={() => setPickerTarget(null)}
        onConfirm={(val) => setEndTime(val)}
        defaultValue={endTime || startTime}
        title="选择结束时间"
      />
    </>
  );
}
