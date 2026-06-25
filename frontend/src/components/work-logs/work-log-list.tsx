"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Pencil,
} from "lucide-react";
import {
  getWorkLogs,
  deleteWorkLogContent,
  deleteWorkLog,
  getWeeklySummary,
  getMonthlySummary,
  WorkLogData,
} from "@/lib/api";
import { emitDataChange, useDataChangeListener } from "@/lib/data-events";
import { WorkLogDialog } from "./work-log-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WeekPicker, MonthPicker } from "@/components/ui/date-time-picker";

export function WorkLogList() {
  const [logs, setLogs] = useState<WorkLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "weekly" | "monthly">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // 添加/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ logId: number; index: number; content: string } | null>(null);

  // 日期选择器
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<number | null>(null);
  const [confirmDeleteContent, setConfirmDeleteContent] = useState<{ logId: number; index: number } | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWorkLogs({ limit: 50 });
      setLogs(data);
    } catch (error) {
      console.error("加载工作日志失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeeklySummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWeeklySummary(weekOffset);
      setLogs(data.logs);
    } catch (error) {
      console.error("加载周汇总失败:", error);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  const loadMonthlySummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMonthlySummary(year, month);
      setLogs(data.logs);
    } catch (error) {
      console.error("加载月汇总失败:", error);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // 刷新当前视图模式的数据
  const refreshCurrentView = useCallback(() => {
    if (viewMode === "list") {
      loadLogs();
    } else if (viewMode === "weekly") {
      loadWeeklySummary();
    } else {
      loadMonthlySummary();
    }
  }, [viewMode, loadLogs, loadWeeklySummary, loadMonthlySummary]);

  useEffect(() => {
    refreshCurrentView();
  }, [refreshCurrentView]);

  // 监听其他组件实例的数据变更
  useDataChangeListener("worklogs", refreshCurrentView);

  // 添加回调
  const handleAdded = (log: WorkLogData) => {
    setLogs((prev) => {
      const existingIndex = prev.findIndex((l) => l.id === log.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = log;
        return updated;
      }
      return [log, ...prev];
    });
    emitDataChange("worklogs");
  };

  // 周选择回调
  const handleWeekConfirm = (dateStr: string) => {
    const selected = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const todayDow = today.getDay();
    const todayMonday = new Date(today);
    todayMonday.setDate(today.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
    todayMonday.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    const diffDays = Math.round((selected.getTime() - todayMonday.getTime()) / 86400000);
    setWeekOffset(Math.floor(diffDays / 7));
  };

  // 月选择回调
  const handleMonthConfirm = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  // 打开编辑对话框
  const handleStartEdit = (logId: number, index: number, content: string) => {
    setEditData({ logId, index, content });
    setDialogOpen(true);
  };

  // 编辑保存回调
  const handleUpdated = (log: WorkLogData) => {
    setLogs((prev) => prev.map((l) => (l.id === log.id ? log : l)));
    emitDataChange("worklogs");
  };

  // 删除单条内容
  const handleDeleteContent = async (logId: number, index: number) => {
    setConfirmDeleteContent({ logId, index });
  };

  const handleConfirmDeleteContent = async () => {
    const params = confirmDeleteContent;
    if (params === null) return;
    setConfirmDeleteContent(null);
    try {
      const result = await deleteWorkLogContent(params.logId, params.index);
      if (!result.contents || result.contents.length === 0) {
        setLogs((prev) => prev.filter((l) => l.id !== params.logId));
      } else {
        setLogs((prev) => prev.map((l) => (l.id === result.id ? result : l)));
      }
      emitDataChange("worklogs");
    } catch (error) {
      console.error("删除工作内容失败:", error);
    }
  };

  // 删除整条日志
  const handleDeleteLog = async (logId: number) => {
    setConfirmDeleteLogId(logId);
  };

  const handleConfirmDeleteLog = async () => {
    const id = confirmDeleteLogId;
    if (id === null) return;
    setConfirmDeleteLogId(null);
    try {
      await deleteWorkLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      emitDataChange("worklogs");
    } catch (error) {
      console.error("删除工作日志失败:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", weekday: "short" });
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return "本周";
    if (weekOffset === -1) return "上周";
    return `${Math.abs(weekOffset)}周前`;
  };

  return (
    <>
    <Card className="card-hover overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2.5 text-[15px] md:text-base font-semibold text-render-optimized">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          工作日志
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            className="h-8 rounded-lg text-xs font-medium px-2"
          >
            列表
          </Button>
          <Button
            size="sm"
            variant={viewMode === "weekly" ? "default" : "outline"}
            onClick={() => setViewMode("weekly")}
            className="h-8 rounded-lg text-xs font-medium px-2"
          >
            周汇总
          </Button>
          <Button
            size="sm"
            variant={viewMode === "monthly" ? "default" : "outline"}
            onClick={() => setViewMode("monthly")}
            className="h-8 rounded-lg text-xs font-medium px-2"
          >
            月汇总
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          onClick={() => { setEditData(null); setDialogOpen(true); }}
          className="h-9 w-full rounded-lg text-xs font-medium mb-4 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          添加工作内容
        </Button>

        {/* 周汇总导航 */}
        {viewMode === "weekly" && (
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setWeekPickerOpen(true)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              {getWeekLabel()}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              disabled={weekOffset >= 0}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 月汇总导航 */}
        {viewMode === "monthly" && (
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (month === 1) {
                  setYear((prev) => prev - 1);
                  setMonth(12);
                } else {
                  setMonth((prev) => prev - 1);
                }
              }}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setMonthPickerOpen(true)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              {year}年{month}月
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (month === 12) {
                  setYear((prev) => prev + 1);
                  setMonth(1);
                } else {
                  setMonth((prev) => prev + 1);
                }
              }}
              disabled={year === new Date().getFullYear() && month === new Date().getMonth() + 1}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg shimmer bg-muted/30" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-3">
              <BookOpen className="h-7 w-7 text-muted-foreground/25" />
            </div>
            <p className="text-muted-foreground text-sm font-normal">
              暂无工作日志
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              点击上方「添加」按钮记录工作内容 ✨
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log, logIndex) => (
              <div
                key={log.id}
                className="border border-border/50 rounded-lg overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${logIndex * 60}ms` }}
              >
                {/* 日期头部 */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-muted/30 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">
                      {formatDate(log.log_date)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {log.contents.length}条记录
                    </span>
                  </div>
                  {viewMode !== "list" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteLog(log.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* 内容列表 */}
                <div className="divide-y divide-border/20">
                  {log.contents.map((item) => (
                    <div
                      key={item.index}
                      className="group flex items-start gap-2 px-3.5 py-2.5 hover:bg-muted/20 transition-colors"
                    >
                      <p className="flex-1 text-[13px] text-foreground leading-relaxed">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleStartEdit(log.id, item.index, item.content)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteContent(log.id, item.index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <WorkLogDialog
      open={dialogOpen}
      onClose={() => { setDialogOpen(false); setEditData(null); }}
      onAdded={handleAdded}
      onUpdated={handleUpdated}
      editData={editData}
    />
    <WeekPicker
      open={weekPickerOpen}
      onClose={() => setWeekPickerOpen(false)}
      onConfirm={handleWeekConfirm}
    />
    <MonthPicker
      open={monthPickerOpen}
      onClose={() => setMonthPickerOpen(false)}
      onConfirm={handleMonthConfirm}
      defaultYear={year}
      defaultMonth={month}
    />

    <ConfirmDialog
      open={confirmDeleteContent !== null}
      onClose={() => setConfirmDeleteContent(null)}
      onConfirm={handleConfirmDeleteContent}
      variant="danger"
      title="删除工作内容"
      message="确定删除这条工作内容吗？"
    />

    <ConfirmDialog
      open={confirmDeleteLogId !== null}
      onClose={() => setConfirmDeleteLogId(null)}
      onConfirm={handleConfirmDeleteLog}
      variant="danger"
      title="删除全部工作日志"
      message="确定删除这天的所有工作日志吗？"
    />
    </>
  );
}
