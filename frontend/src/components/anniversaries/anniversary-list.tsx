"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Trash2, Plus, Pencil } from "lucide-react";
import { getAnniversaries, deleteAnniversary, AnniversaryData } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/utils";
import { emitDataChange, useDataChangeListener } from "@/lib/data-events";
import { AnniversaryDialog } from "./anniversary-dialog";
import { AnniversaryEditDialog } from "./anniversary-edit-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function daysUntilAnniversary(dateStr: string): { days: number; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  let next = thisYear;
  if (thisYear < today) {
    next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  }
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { days: 0, label: "就是今天！" };
  return { days: diff, label: `还有 ${diff} 天` };
}

export function AnniversaryList() {
  const { account, isAdmin } = useAuth();
  const [anniversaries, setAnniversaries] = useState<AnniversaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAnniversary, setEditingAnniversary] = useState<AnniversaryData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadAnniversaries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAnniversaries();
      setAnniversaries(data);
    } catch (error) {
      console.error("加载纪念日失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnniversaries();
  }, [loadAnniversaries]);

  // 监听其他组件实例的数据变更
  useDataChangeListener("anniversaries", loadAnniversaries);

  const handleDelete = async (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    if (id === null) return;
    setConfirmDeleteId(null);
    try {
      await deleteAnniversary(id);
      setAnniversaries((prev) => prev.filter((a) => a.id !== id));
      emitDataChange("anniversaries");
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  const handleCreated = (anniversary: AnniversaryData) => {
    setAnniversaries((prev) =>
      [...prev, anniversary].sort((a, b) => {
        const da = daysUntilAnniversary(a.date).days;
        const db = daysUntilAnniversary(b.date).days;
        return da - db;
      })
    );
    emitDataChange("anniversaries");
  };

  const handleEdit = (anniversary: AnniversaryData) => {
    setEditingAnniversary(anniversary);
    setEditDialogOpen(true);
  };

  const handleUpdated = (updated: AnniversaryData) => {
    setAnniversaries((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)).sort((a, b) => {
        const da = daysUntilAnniversary(a.date).days;
        const db = daysUntilAnniversary(b.date).days;
        return da - db;
      })
    );
    emitDataChange("anniversaries");
  };

  return (
    <>
      <Card className="card-hover overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-[15px] md:text-base font-semibold text-render-optimized">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <Gift className="h-4 w-4 text-rose-500" />
            </div>
            纪念日
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 rounded-lg text-xs font-medium px-3 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg shimmer bg-muted/30" />
              ))}
            </div>
          ) : anniversaries.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-3">
                <Gift className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <p className="text-muted-foreground text-sm font-normal">
                暂无纪念日
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                点击添加记录重要日子
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {anniversaries.map((item, i) => {
                const { days, label } = daysUntilAnniversary(item.date);
                return (
                  <div
                    key={item.id}
                    className="group relative flex items-start justify-between p-3.5 rounded-lg border border-border/50 bg-background hover:bg-muted/40 transition-all duration-200 animate-fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[13px] truncate text-foreground text-render-optimized">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                        {formatDate(item.date)}
                        {item.repeat_rule === "yearly" && (
                          <span className="ml-2 text-rose-400">每年</span>
                        )}
                        <span
                          className={`inline-flex items-center ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                            item.scope === "personal"
                              ? "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600"
                              : item.created_by === String(account?.id)
                              ? "bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
                              : "bg-teal-100 text-teal-600 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
                          }`}
                        >
                          {item.scope === "personal" ? "个人" : item.created_by === String(account?.id) ? "共享" : "组内共享"}
                        </span>
                      </p>
                      <p className={`text-[12px] mt-1.5 font-medium ${days === 0 ? "text-rose-500" : days <= 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {label}
                      </p>
                    </div>
                    {(item.created_by === String(account?.id) || isAdmin) && (
                      <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-muted"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => item.id && handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AnniversaryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
      <AnniversaryEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onUpdated={handleUpdated}
        anniversary={editingAnniversary}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="删除纪念日"
        message="确定删除这个纪念日吗？"
      />
    </>
  );
}

