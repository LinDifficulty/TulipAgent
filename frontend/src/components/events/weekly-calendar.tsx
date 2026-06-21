"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { getEvents, EventData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDataChangeListener } from "@/lib/data-events";

// ── 常量 ──────────────────────────────────────────────
const MIN_HOUR_HEIGHT = 40; // 每小时最小高度 (px)
const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const HEADER_HEIGHT = 56; // 星期头行高 (px)

// ── 工具函数 ──────────────────────────────────────────

/** 获取本周一的日期 (00:00) */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 格式化日期为 YYYY-MM-DD */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 判断两个 Date 是否是同一天 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 解析时间字符串为 Date */
function parseTime(s: string): Date {
  return new Date(s);
}

/** 默认 8:00–22:00，事件超出范围时自动扩充 */
function getTimeRange(events: EventData[]): { startHour: number; endHour: number } {
  let startHour = 8;
  let endHour = 22;

  for (const ev of events) {
    const s = parseTime(ev.start_time);
    const e = ev.end_time ? parseTime(ev.end_time) : new Date(s.getTime() + 3600000);
    const sh = s.getHours() + (s.getMinutes() > 0 ? 0 : 0); // 取整点向下
    const eh = e.getHours() + (e.getMinutes() > 0 ? 1 : 0); // 有分钟就进一位
    if (sh < startHour) startHour = Math.max(0, sh);
    if (eh > endHour) endHour = Math.min(24, eh);
  }

  return { startHour, endHour };
}

/**
 * 获取事件在某天的定位 (基于可见范围而非 24h)
 * 返回 { top, height }，均为 0~1 之间的比例
 */
function getEventPosition(
  event: EventData,
  day: Date,
  startHour: number,
  endHour: number,
) {
  const start = parseTime(event.start_time);
  const end = event.end_time
    ? parseTime(event.end_time)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // 可见窗口 (当天内)
  const rangeStart = new Date(dayStart);
  rangeStart.setHours(startHour, 0, 0, 0);
  const rangeEnd = new Date(dayStart);
  rangeEnd.setHours(endHour, 0, 0, 0);

  // 事件与可见窗口的交集
  const effectiveStart = start < rangeStart ? rangeStart : start;
  const effectiveEnd = end > rangeEnd ? rangeEnd : end;

  if (effectiveStart >= effectiveEnd) return null;

  const totalMs = (endHour - startHour) * 60 * 60 * 1000;
  const top = (effectiveStart.getTime() - rangeStart.getTime()) / totalMs;
  const height = (effectiveEnd.getTime() - effectiveStart.getTime()) / totalMs;

  return { top, height: Math.max(height, 0.02) };
}

/** 检测某天的事件冲突 */
function detectConflicts(events: EventData[], day: Date): Map<number, EventData[]> {
  const dayStr = fmtDate(day);
  const dayEvents = events.filter((e) => {
    const s = fmtDate(parseTime(e.start_time));
    const endStr = e.end_time ? fmtDate(parseTime(e.end_time)) : s;
    return s <= dayStr && endStr >= dayStr;
  });

  const conflicts = new Map<number, EventData[]>();
  for (let i = 0; i < dayEvents.length; i++) {
    for (let j = i + 1; j < dayEvents.length; j++) {
      const a = dayEvents[i];
      const b = dayEvents[j];
      const aStart = parseTime(a.start_time);
      const aEnd = a.end_time ? parseTime(a.end_time) : new Date(aStart.getTime() + 3600000);
      const bStart = parseTime(b.start_time);
      const bEnd = b.end_time ? parseTime(b.end_time) : new Date(bStart.getTime() + 3600000);

      if (aStart < bEnd && bStart < aEnd) {
        if (!conflicts.has(a.id!)) conflicts.set(a.id!, []);
        if (!conflicts.has(b.id!)) conflicts.set(b.id!, []);
        conflicts.get(a.id!)!.push(b);
        conflicts.get(b.id!)!.push(a);
      }
    }
  }
  return conflicts;
}

// ── 冲突提示组件 ──────────────────────────────────────

function ConflictBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
      <AlertTriangle className="h-3 w-3" />
      {count} 天冲突
    </span>
  );
}

// ── 事件块组件 ─────────────────────────────────────────

function EventBlock({
  event,
  top,
  height,
  isConflict,
  style,
}: {
  event: EventData;
  top: number;
  height: number;
  isConflict: boolean;
  style?: React.CSSProperties;
}) {
  const startTime = parseTime(event.start_time);
  const endTime = event.end_time ? parseTime(event.end_time) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = endTime
    ? `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}–${pad(endTime.getHours())}:${pad(endTime.getMinutes())}`
    : `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`;

  return (
    <div
      className={cn(
        "absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-[11px] leading-tight overflow-hidden cursor-default border transition-shadow z-10",
        isConflict
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-sm shadow-amber-200/50"
          : "bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30 hover:shadow-sm"
      )}
      style={{ top: `${top * 100}%`, height: `${Math.max(height * 100, 2.5)}%`, ...style }}
      title={`${event.title}\n${timeStr}${event.description ? "\n" + event.description : ""}`}
    >
      <p className="font-semibold truncate text-foreground/90 text-[11px]">
        {event.title}
      </p>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {timeStr}
      </p>
    </div>
  );
}

// ── 主组件 ─────────────────────────────────────────────

export function WeeklyCalendar() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const today = useMemo(() => new Date(), []);

  // 本周 7 天
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentMonday]);

  // 加载日程 (按周范围)
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = fmtDate(currentMonday);
      const end = new Date(currentMonday);
      end.setDate(end.getDate() + 7);
      const endDate = fmtDate(end);
      const data = await getEvents({ start_date: startDate, end_date: endDate });
      setEvents(data);
    } catch (err) {
      console.error("加载日程失败:", err);
    } finally {
      setLoading(false);
    }
  }, [currentMonday]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 监听其他组件实例的数据变更（如 EventList 增删改后）
  useDataChangeListener("events", loadEvents);

  // 监听容器高度变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 动态时间范围
  const { startHour, endHour } = useMemo(() => getTimeRange(events), [events]);
  const hourCount = endHour - startHour;
  const visibleHours = useMemo(
    () => Array.from({ length: hourCount }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  // 动态每小时高度：优先撑满容器，低于最小值时启用滚动
  const gridHeight = containerHeight - HEADER_HEIGHT;
  const fitHeight = gridHeight / hourCount;
  const needsScroll = fitHeight < MIN_HOUR_HEIGHT;
  const hourHeight = needsScroll ? MIN_HOUR_HEIGHT : fitHeight;
  const totalPx = hourCount * hourHeight;

  // 需要滚动时，初始滚到靠前位置
  useEffect(() => {
    if (needsScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [needsScroll, startHour, endHour]);

  // 每天的冲突统计
  const dailyConflicts = useMemo(() => {
    return weekDays.map((day) => detectConflicts(events, day).size);
  }, [events, weekDays]);

  const totalConflictDays = dailyConflicts.filter((c) => c > 0).length;

  // 周导航
  const goWeek = (offset: number) => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset * 7);
      return d;
    });
  };

  const goToday = () => setCurrentMonday(getMonday(new Date()));

  // 周标题
  const weekLabel = useMemo(() => {
    const s = currentMonday;
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    const sm = s.getMonth() + 1;
    const em = e.getMonth() + 1;
    if (sm === em) return `${s.getFullYear()}年${sm}月 ${s.getDate()}–${e.getDate()}日`;
    return `${sm}月${s.getDate()}日 – ${em}月${e.getDate()}日`;
  }, [currentMonday]);

  const isCurrentWeek = isSameDay(currentMonday, getMonday(today));

  // 当前时间是否在可见范围内
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const rangeStartMinutes = startHour * 60;
  const rangeEndMinutes = endHour * 60;
  const nowInRange = nowMinutes >= rangeStartMinutes && nowMinutes <= rangeEndMinutes;

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goWeek(-1)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="上一周"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
              isCurrentWeek
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            本周
          </button>
          <button
            onClick={() => goWeek(1)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="下一周"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{weekLabel}</span>
          {totalConflictDays > 0 && <ConflictBadge count={totalConflictDays} />}
        </div>
      </div>

      {/* 日历主体 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col">
          {/* 星期头 */}
          <div className="flex border-b border-border bg-muted/30 shrink-0" style={{ height: `${HEADER_HEIGHT}px` }}>
            <div className="w-12 shrink-0" />
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-center border-l border-border/50"
                >
                  <span className="text-[10px] text-muted-foreground font-medium">
                    周{DAY_LABELS[i]}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {dailyConflicts[i] > 0 && (
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </div>
              );
            })}
          </div>

          {/* 时间网格 */}
          <div
            ref={scrollRef}
            className={cn("flex-1", needsScroll && "overflow-y-auto scroll-container")}
          >
            <div className="flex" style={{ height: needsScroll ? `${totalPx}px` : "100%" }}>
              {/* 时间刻度列 */}
              <div className="w-12 shrink-0 relative">
                {visibleHours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full flex items-start justify-end pr-1.5"
                    style={{ top: `${(h - startHour) * hourHeight}px`, height: `${hourHeight}px` }}
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums -translate-y-2">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* 每天的列 */}
              {weekDays.map((day, dayIdx) => {
                const isToday = isSameDay(day, today);
                const dayEvents = events.filter((e) => {
                  const s = fmtDate(parseTime(e.start_time));
                  const endStr = e.end_time ? fmtDate(parseTime(e.end_time)) : s;
                  const dStr = fmtDate(day);
                  return s <= dStr && endStr >= dStr;
                });

                const conflictMap = detectConflicts(events, day);

                // 贪心列分配 (处理重叠事件)
                const sorted = [...dayEvents].sort(
                  (a, b) => parseTime(a.start_time).getTime() - parseTime(b.start_time).getTime()
                );

                const positioned: Array<{
                  event: EventData;
                  top: number;
                  height: number;
                  col: number;
                  cols: number;
                }> = [];

                const colEnds: number[] = [];
                for (const ev of sorted) {
                  const pos = getEventPosition(ev, day, startHour, endHour);
                  if (!pos) continue;
                  const evEnd =
                    parseTime(ev.end_time || ev.start_time).getTime() +
                    (ev.end_time ? 0 : 3600000);

                  let col = colEnds.findIndex(
                    (end) => end <= parseTime(ev.start_time).getTime()
                  );
                  if (col === -1) {
                    col = colEnds.length;
                    colEnds.push(0);
                  }
                  colEnds[col] = evEnd;
                  positioned.push({ event: ev, ...pos, col, cols: 0 });
                }

                // 设置每组重叠事件的总列数
                for (let i = 0; i < positioned.length; i++) {
                  let maxCols = positioned[i].col + 1;
                  for (let j = i + 1; j < positioned.length; j++) {
                    if (positioned[j].top < positioned[i].top + positioned[i].height) {
                      maxCols = Math.max(maxCols, positioned[j].col + 1);
                    } else break;
                  }
                  for (let j = i; j < positioned.length; j++) {
                    if (
                      j === i ||
                      positioned[j].top < positioned[i].top + positioned[i].height
                    ) {
                      positioned[j].cols = Math.max(positioned[j].cols, maxCols);
                    } else break;
                  }
                }

                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "flex-1 relative border-l border-border/50",
                      isToday && "bg-primary/[0.03]"
                    )}
                  >
                    {/* 小时线 */}
                    {visibleHours.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-border/30"
                        style={{ top: `${(h - startHour) * hourHeight}px` }}
                      />
                    ))}

                    {/* 当前时间红线 */}
                    {isToday && nowInRange && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{
                          top: `${((nowMinutes - rangeStartMinutes) / (rangeEndMinutes - rangeStartMinutes)) * 100}%`,
                        }}
                      >
                        <div className="relative">
                          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-destructive shadow-sm" />
                          <div className="h-[2px] bg-destructive/70" />
                        </div>
                      </div>
                    )}

                    {/* 事件块 */}
                    {positioned.map((p, pi) => {
                      const colWidth = 100 / (p.cols || 1);
                      return (
                        <EventBlock
                          key={`${p.event.id}-${pi}`}
                          event={p.event}
                          top={p.top}
                          height={p.height}
                          isConflict={conflictMap.has(p.event.id!)}
                          style={{
                            left: `${p.col * colWidth}%`,
                            width: `${colWidth - 1}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
