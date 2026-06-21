"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

// ─── 工具函数 ───────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function toDatetimeStr(y: number, m: number, d: number, h: number, min: number): string {
  return `${toDateStr(y, m, d)}T${pad(h)}:${pad(min)}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getWeekday(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// ─── 日历网格 ───────────────────────────────────────────────────────────────

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  today: { year: number; month: number; day: number };
}

function CalendarGrid({ year, month, selectedDay, onSelectDay, today }: CalendarGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getWeekday(year, month, 1);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="select-none">
      {/* 星期标题行 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs text-muted-foreground py-1.5 font-medium">
            {w}
          </div>
        ))}
      </div>
      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const isToday = year === today.year && month === today.month && day === today.day;
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`relative h-9 w-full rounded-lg text-sm font-medium transition-all duration-150 ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isToday
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 年月选择器 ───────────────────────────────────────────────────────────────

interface YearMonthSelectorProps {
  year: number;
  month: number;
  onSelectYearMonth: (year: number, month: number) => void;
}

function YearMonthSelector({ year, month, onSelectYearMonth }: YearMonthSelectorProps) {
  const [viewMode, setViewMode] = useState<"year" | "month">("year");
  const [yearRangeStart, setYearRangeStart] = useState(
    Math.floor((year - 1900) / 12) * 12 + 1900
  );

  const years = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => yearRangeStart + i),
  [yearRangeStart]);

  const months = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => i + 1),
  []);

  if (viewMode === "year") {
    return (
      <div className="px-5 pb-4">
        {/* 年份范围导航 */}
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={() => setYearRangeStart(yearRangeStart - 12)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {yearRangeStart} - {yearRangeStart + 11}
          </span>
          <button
            type="button"
            onClick={() => setYearRangeStart(yearRangeStart + 12)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        {/* 年份网格 */}
        <div className="grid grid-cols-4 gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                onSelectYearMonth(y, month);
                setViewMode("month");
              }}
              className={`h-10 rounded-lg text-sm font-medium transition-all ${
                y === year
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-4">
      {/* 显示已选年份，可返回 */}
      <div className="flex items-center justify-center px-2 py-2">
        <button
          type="button"
          onClick={() => setViewMode("year")}
          className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1"
        >
          {year}年 ▲
        </button>
      </div>
      {/* 月份网格 */}
      <div className="grid grid-cols-4 gap-1.5">
        {months.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSelectYearMonth(year, m)}
            className={`h-10 rounded-lg text-sm font-medium transition-all ${
              m === month
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground hover:bg-muted"
            }`}
          >
            {MONTHS[m - 1]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 时间滚轮 ───────────────────────────────────────────────────────────────

interface ScrollWheelProps {
  items: { value: number; label: string }[];
  selected: number;
  onChange: (value: number) => void;
  wheelRef?: React.MutableRefObject<HTMLDivElement | null>;
}

function ScrollWheel({ items, selected, onChange, wheelRef }: ScrollWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;
  const visibleCount = 5;
  const padding = (visibleCount - 1) / 2 * itemHeight;

  // 找到选中项的索引
  const selectedIndex = items.findIndex((it) => it.value === selected);

  // 滚动到选中项
  useEffect(() => {
    const el = containerRef.current;
    if (!el || selectedIndex < 0) return;
    el.scrollTo({ top: selectedIndex * itemHeight, behavior: "instant" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped] && items[clamped].value !== selected) {
      onChange(items[clamped].value);
    }
  }, [items, itemHeight, onChange, selected]);

  // snap 滚动结束时精确对齐
  const handleScrollEnd = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    el.scrollTo({ top: idx * itemHeight, behavior: "smooth" });
  }, [itemHeight]);

  return (
    <div
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (wheelRef) wheelRef.current = node;
      }}
      onScroll={handleScroll}
      onScrollEnd={handleScrollEnd}
      onTouchEnd={handleScrollEnd}
      className="relative overflow-y-scroll scrollbar-hide snap-y snap-mandatory"
      style={{ height: itemHeight * visibleCount, WebkitOverflowScrolling: "touch" }}
    >
      {/* 上方填充 */}
      <div style={{ height: padding }} />
      {items.map((it) => {
        const isSelected = it.value === selected;
        return (
          <div
            key={it.value}
            className={`snap-start flex items-center justify-center text-base font-medium transition-colors ${
              isSelected ? "text-foreground" : "text-muted-foreground/40"
            }`}
            style={{ height: itemHeight }}
            onClick={() => {
              onChange(it.value);
              const idx = items.indexOf(it);
              containerRef.current?.scrollTo({ top: idx * itemHeight, behavior: "smooth" });
            }}
          >
            {it.label}
          </div>
        );
      })}
      {/* 下方填充 */}
      <div style={{ height: padding }} />
    </div>
  );
}

// ─── DatePicker (日期选择) ──────────────────────────────────────────────────

export interface DatePickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dateStr: string) => void; // "YYYY-MM-DD"
  defaultValue?: string; // "YYYY-MM-DD"
}

export function DatePicker({ open, onClose, onConfirm, defaultValue }: DatePickerProps) {
  const now = useMemo(() => {
    const d = defaultValue ? new Date(defaultValue + "T00:00:00") : new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, [defaultValue]);

  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.day);
  const [showYM, setShowYM] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setYear(now.year);
      setMonth(now.month);
      setSelectedDay(now.day);
      setShowYM(false);
    }
  }, [open, now.year, now.month, now.day]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, []);

  const handlePrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const handleConfirm = () => {
    if (selectedDay) {
      onConfirm(toDateStr(year, month, selectedDay));
      onClose();
    }
  };

  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-lg w-full sm:w-[380px] max-h-[85vh] animate-slide-up sm:animate-fade-in-up">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            取消
          </button>
          <span className="text-sm font-semibold text-foreground">选择日期</span>
          <button
            type="button"
            onClick={handleConfirm}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1"
          >
            确定
          </button>
        </div>

        {/* 月份导航 */}
        <div className="flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowYM(true)}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1"
          >
            {year}年{MONTHS[month - 1]}
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 日历或年月选择 */}
        {showYM ? (
          <YearMonthSelector
            year={year}
            month={month}
            onSelectYearMonth={(y, m) => {
              setYear(y);
              setMonth(m);
              setShowYM(false);
            }}
          />
        ) : (
          <>
            <div className="px-5 pb-4">
              <CalendarGrid
                year={year}
                month={month}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                today={today}
              />
            </div>

            {/* 快捷按钮 */}
            <div className="px-5 pb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setYear(today.year);
              setMonth(today.month);
              setSelectedDay(today.day);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            今天
          </button>
          <button
            type="button"
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setYear(tomorrow.getFullYear());
              setMonth(tomorrow.getMonth() + 1);
              setSelectedDay(tomorrow.getDate());
            }}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            明天
          </button>
          <button
            type="button"
            onClick={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              setYear(nextWeek.getFullYear());
              setMonth(nextWeek.getMonth() + 1);
              setSelectedDay(nextWeek.getDate());
            }}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            下周
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

// ─── DateTimePicker (日期+时间选择) ─────────────────────────────────────────

export interface DateTimePickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (datetimeStr: string) => void; // "YYYY-MM-DDTHH:MM"
  defaultValue?: string; // "YYYY-MM-DDTHH:MM"
  title?: string;
}

type PickerStep = "date" | "time";

export function DateTimePicker({ open, onClose, onConfirm, defaultValue, title = "选择时间" }: DateTimePickerProps) {
  const parseDefault = useCallback(() => {
    if (defaultValue) {
      const [datePart, timePart] = defaultValue.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const [h, min] = timePart.split(":").map(Number);
      return { year: y, month: m, day: d, hour: h, minute: min };
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: Math.floor(now.getMinutes() / 5) * 5,
    };
  }, [defaultValue]);

  const [step, setStep] = useState<PickerStep>("date");
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [showYM, setShowYM] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      const def = parseDefault();
      setYear(def.year);
      setMonth(def.month);
      setSelectedDay(def.day);
      setHour(def.hour);
      setMinute(def.minute);
      setStep("date");
      setShowYM(false);
    }
  }, [open, parseDefault]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, []);

  const handlePrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const handleDateNext = () => {
    if (selectedDay) setStep("time");
  };

  const handleConfirm = () => {
    if (selectedDay) {
      onConfirm(toDatetimeStr(year, month, selectedDay, hour, minute));
      onClose();
    }
  };

  const hourItems = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad(i) })),
  []);

  const minuteItems = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => i * 5).map((v) => ({ value: v, label: pad(v) })),
  []);

  // 日期显示文本
  const dateDisplayText = selectedDay
    ? `${year}年${pad(month)}月${pad(selectedDay)}日`
    : "未选择";

  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-lg w-full sm:w-[380px] max-h-[85vh] animate-slide-up sm:animate-fade-in-up overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <button
            type="button"
            onClick={step === "date" ? onClose : () => setStep("date")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            {step === "date" ? "取消" : "返回"}
          </button>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {step === "date" ? (
            <button
              type="button"
              onClick={handleDateNext}
              disabled={!selectedDay}
              className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1"
            >
              确定
            </button>
          )}
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2 py-2.5">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${step === "date" ? "text-primary" : "text-muted-foreground"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step === "date" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>1</span>
            日期
          </div>
          <div className="w-8 h-px bg-border" />
          <div className={`flex items-center gap-1.5 text-xs font-medium ${step === "time" ? "text-primary" : "text-muted-foreground"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step === "time" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>2</span>
            时间
          </div>
        </div>

        {/* 日期步骤 */}
        {step === "date" && (
          <div>
            {/* 月份导航 */}
            <div className="flex items-center justify-between px-5 py-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowYM(true)}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1"
              >
                {year}年{MONTHS[month - 1]}
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* 日历或年月选择 */}
            {showYM ? (
              <YearMonthSelector
                year={year}
                month={month}
                onSelectYearMonth={(y, m) => {
                  setYear(y);
                  setMonth(m);
                  setShowYM(false);
                }}
              />
            ) : (
              <>
                <div className="px-5 pb-3">
                  <CalendarGrid
                    year={year}
                    month={month}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    today={today}
                  />
                </div>

                {/* 快捷按钮 */}
                <div className="px-5 pb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setYear(today.year);
                      setMonth(today.month);
                      setSelectedDay(today.day);
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    今天
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setYear(tomorrow.getFullYear());
                      setMonth(tomorrow.getMonth() + 1);
                      setSelectedDay(tomorrow.getDate());
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    明天
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 时间步骤 */}
        {step === "time" && (
          <div className="px-5 py-4">
            {/* 已选日期提示 */}
            <div className="text-center text-xs text-muted-foreground mb-4">
              {dateDisplayText}
            </div>

            {/* 时间滚轮 */}
            <div className="flex items-center justify-center gap-1">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-2 font-medium">时</div>
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 bg-muted/50 rounded-lg pointer-events-none z-0" />
                  <ScrollWheel
                    items={hourItems}
                    selected={hour}
                    onChange={setHour}
                  />
                </div>
              </div>
              <span className="text-lg font-bold text-foreground mx-1 self-center mt-5">:</span>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-2 font-medium">分</div>
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 bg-muted/50 rounded-lg pointer-events-none z-0" />
                  <ScrollWheel
                    items={minuteItems}
                    selected={minute}
                    onChange={setMinute}
                  />
                </div>
              </div>
            </div>

            {/* 快捷时间 */}
            <div className="mt-4 flex gap-2 flex-wrap justify-center">
              {[
                { label: "现在", h: new Date().getHours(), m: Math.floor(new Date().getMinutes() / 5) * 5 },
                { label: "09:00", h: 9, m: 0 },
                { label: "12:00", h: 12, m: 0 },
                { label: "14:00", h: 14, m: 0 },
                { label: "18:00", h: 18, m: 0 },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setHour(t.h);
                    setMinute(t.m);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    hour === t.h && minute === t.m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

// ─── WeekPicker (周选择) ───────────────────────────────────────────────────

export interface WeekPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dateStr: string) => void; // 返回所选周的周一 "YYYY-MM-DD"
  defaultValue?: string; // "YYYY-MM-DD"
}

export function WeekPicker({ open, onClose, onConfirm, defaultValue }: WeekPickerProps) {
  const now = useMemo(() => {
    const d = defaultValue ? new Date(defaultValue + "T00:00:00") : new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, [defaultValue]);

  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.day);
  const [showYM, setShowYM] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setYear(now.year);
      setMonth(now.month);
      setSelectedDay(now.day);
      setShowYM(false);
    }
  }, [open, now.year, now.month, now.day]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, []);

  // 计算所选日期所在周的周一
  const weekStart = useMemo(() => {
    if (!selectedDay) return null;
    const d = new Date(year, month - 1, selectedDay);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, [year, month, selectedDay]);

  const handlePrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const handleConfirm = () => {
    if (weekStart) {
      onConfirm(toDateStr(weekStart.year, weekStart.month, weekStart.day));
      onClose();
    }
  };

  if (!open) return null;

  const weekStartStr = weekStart
    ? `${weekStart.year}-${pad(weekStart.month)}-${pad(weekStart.day)}`
    : "";

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-lg w-full sm:w-[380px] max-h-[85vh] animate-slide-up sm:animate-fade-in-up">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <button type="button" onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
            取消
          </button>
          <span className="text-sm font-semibold text-foreground">选择周</span>
          <button type="button" onClick={handleConfirm} disabled={!selectedDay}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed">
            确定
          </button>
        </div>

        {/* 月份导航 */}
        <div className="flex items-center justify-between px-5 py-3">
          <button type="button" onClick={handlePrevMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowYM(true)}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2 py-1">
            {year}年{MONTHS[month - 1]}
          </button>
          <button type="button" onClick={handleNextMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {showYM ? (
          <YearMonthSelector year={year} month={month}
            onSelectYearMonth={(y, m) => { setYear(y); setMonth(m); setShowYM(false); }} />
        ) : (
          <>
            <div className="px-5 pb-3">
              <CalendarGrid year={year} month={month} selectedDay={selectedDay}
                onSelectDay={setSelectedDay} today={today} />
            </div>
            {/* 周起止提示 */}
            <div className="px-5 pb-2 text-center">
              <span className="text-xs text-muted-foreground">
                {weekStartStr ? `选中周：${weekStartStr} 起` : "点击日期选择所在周"}
              </span>
            </div>
            {/* 快捷按钮 */}
            <div className="px-5 pb-4 flex gap-2">
              <button type="button" onClick={() => {
                setYear(today.year); setMonth(today.month); setSelectedDay(today.day);
              }} className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                本周
              </button>
              <button type="button" onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - 7);
                setYear(d.getFullYear()); setMonth(d.getMonth() + 1); setSelectedDay(d.getDate());
              }} className="flex-1 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                上周
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

// ─── MonthPicker (月选择) ──────────────────────────────────────────────────

export interface MonthPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (year: number, month: number) => void;
  defaultYear?: number;
  defaultMonth?: number;
}

export function MonthPicker({ open, onClose, onConfirm, defaultYear, defaultMonth }: MonthPickerProps) {
  const now = useMemo(() => {
    const d = new Date();
    return { year: defaultYear ?? d.getFullYear(), month: defaultMonth ?? d.getMonth() + 1 };
  }, [defaultYear, defaultMonth]);

  const [year, setYear] = useState(now.year);
  const [viewMode, setViewMode] = useState<"year" | "month">("year");
  const [yearRangeStart, setYearRangeStart] = useState(
    Math.floor((now.year - 1900) / 12) * 12 + 1900
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setYear(now.year);
      setViewMode("year");
      setYearRangeStart(Math.floor((now.year - 1900) / 12) * 12 + 1900);
    }
  }, [open, now.year]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const years = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => yearRangeStart + i),
  [yearRangeStart]);

  const months = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => i + 1),
  []);

  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-lg w-full sm:w-[380px] max-h-[85vh] animate-slide-up sm:animate-fade-in-up">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <button type="button" onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
            取消
          </button>
          <span className="text-sm font-semibold text-foreground">选择月份</span>
          <div className="w-12" />
        </div>

        {viewMode === "year" ? (
          <div className="px-5 pb-4 pt-2">
            {/* 年份范围导航 */}
            <div className="flex items-center justify-between px-2 py-2">
              <button type="button" onClick={() => setYearRangeStart(yearRangeStart - 12)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronUp className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {yearRangeStart} - {yearRangeStart + 11}
              </span>
              <button type="button" onClick={() => setYearRangeStart(yearRangeStart + 12)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {/* 年份网格 */}
            <div className="grid grid-cols-4 gap-1.5">
              {years.map((y) => (
                <button key={y} type="button"
                  onClick={() => { setYear(y); setViewMode("month"); }}
                  className={`h-10 rounded-lg text-sm font-medium transition-all ${
                    y === year ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 pb-4 pt-2">
            {/* 返回年份选择 */}
            <div className="flex items-center justify-center px-2 py-2">
              <button type="button" onClick={() => setViewMode("year")}
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1">
                {year}年 ▲
              </button>
            </div>
            {/* 月份网格 */}
            <div className="grid grid-cols-4 gap-1.5">
              {months.map((m) => (
                <button key={m} type="button"
                  onClick={() => { onConfirm(year, m); onClose(); }}
                  className={`h-10 rounded-lg text-sm font-medium transition-all ${
                    m === now.month && year === now.year ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"
                  }`}>
                  {MONTHS[m - 1]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
