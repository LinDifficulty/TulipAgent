"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Circle, Trash2, Plus, ListTodo, Pencil, Archive, RotateCcw, ChevronDown, CheckCircle2, X, AlignLeft } from "lucide-react";
import { getTodos, completeTodo, deleteTodo, restoreTodo, TodoData } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { emitDataChange, useDataChangeListener } from "@/lib/data-events";
import { TodoDialog } from "./todo-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function TodoList() {
  const { account, isAdmin } = useAuth();
  const [todos, setTodos] = useState<TodoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoData | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedTodos, setArchivedTodos] = useState<TodoData[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());
  const [detailTodo, setDetailTodo] = useState<TodoData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteArchivedId, setConfirmDeleteArchivedId] = useState<number | null>(null);

  const loadTodos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTodos({ completed: false });
      setTodos(data);
    } catch (error) {
      console.error("加载待办失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // 监听其他组件实例的数据变更
  useDataChangeListener("todos", loadTodos);

  const loadArchivedTodos = useCallback(async () => {
    try {
      setLoadingArchived(true);
      const data = await getTodos({ completed: true });
      setArchivedTodos(data);
    } catch (error) {
      console.error("加载归档失败:", error);
    } finally {
      setLoadingArchived(false);
    }
  }, []);

  const handleToggleArchived = useCallback(() => {
    const next = !showArchived;
    setShowArchived(next);
    if (next && archivedTodos.length === 0) {
      loadArchivedTodos();
    }
  }, [showArchived, archivedTodos.length, loadArchivedTodos]);

  const handleComplete = async (id: number) => {
    if (completingIds.has(id)) return;
    setCompletingIds((prev) => new Set(prev).add(id));
    // 动画播放完毕后再调用 API 移除
    setTimeout(async () => {
      try {
        await completeTodo(id);
      } catch (error) {
        console.error("完成失败:", error);
      }
      setTodos((prev) => prev.filter((t) => t.id !== id));
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      emitDataChange("todos");
    }, 850);
  };

  const handleDelete = async (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    if (id === null) return;
    setConfirmDeleteId(null);
    try {
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      emitDataChange("todos");
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const restored = await restoreTodo(id);
      setArchivedTodos((prev) => prev.filter((t) => t.id !== id));
      setTodos((prev) => [...prev, restored]);
      emitDataChange("todos");
    } catch (error) {
      console.error("恢复失败:", error);
    }
  };

  const handleDeleteArchived = async (id: number) => {
    setConfirmDeleteArchivedId(id);
  };

  const handleConfirmDeleteArchived = async () => {
    const id = confirmDeleteArchivedId;
    if (id === null) return;
    setConfirmDeleteArchivedId(null);
    try {
      await deleteTodo(id);
      setArchivedTodos((prev) => prev.filter((t) => t.id !== id));
      emitDataChange("todos");
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  const handleCreated = (todo: TodoData) => {
    setTodos((prev) => [...prev, todo]);
    emitDataChange("todos");
  };

  const handleUpdated = (todo: TodoData) => {
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
    emitDataChange("todos");
  };

  const handleEdit = (todo: TodoData) => {
    setEditingTodo(todo);
  };

  const priorityColors: Record<string, string> = {
    high: "text-red-500 dark:text-red-400",
    medium: "text-amber-500 dark:text-amber-400",
    low: "text-emerald-500 dark:text-emerald-400",
  };

  const priorityBorderColors: Record<string, string> = {
    high: "border-t-red-500 dark:border-t-red-400",
    medium: "border-t-amber-400 dark:border-t-amber-500",
    low: "border-t-emerald-400 dark:border-t-emerald-500",
  };

  const priorityLabels: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  return (
    <>
      <Card className="card-hover overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-[15px] md:text-base font-semibold text-render-optimized">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            待办事项
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
              {[1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg shimmer bg-muted/30" />
              ))}
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-3">
                <ListTodo className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <p className="text-muted-foreground text-sm font-normal">
                太棒了，没有待办事项！
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                享受轻松时光 ✨
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {todos.map((todo, i) => (
                <div
                  key={todo.id}
                  className={`group flex items-center gap-3 p-3.5 rounded-lg border border-t-2 border-border/50 bg-background transition-all duration-200 animate-fade-in-up ${
                    completingIds.has(todo.id!)
                      ? "animate-todo-complete-row"
                      : "hover:bg-muted/40"
                  } ${
                    priorityBorderColors[todo.priority || "medium"]
                  }`}
                  style={completingIds.has(todo.id!) ? undefined : { animationDelay: `${i * 60}ms` }}
                >
                  <button
                    onClick={() => todo.id && handleComplete(todo.id)}
                    disabled={completingIds.has(todo.id!)}
                    className={`shrink-0 p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center group/check relative ${
                      completingIds.has(todo.id!) ? "animate-todo-complete-burst" : ""
                    }`}
                    aria-label="完成待办"
                  >
                    {completingIds.has(todo.id!) ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-todo-complete-pop" />
                    ) : (
                      <Circle
                        className={`h-5 w-5 transition-all duration-200 group-hover/check:scale-110 ${
                          priorityColors[todo.priority || "medium"]
                        }`}
                      />
                    )}
                  </button>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setDetailTodo(todo)}
                  >
                    <p className="font-medium text-[13px] truncate text-foreground text-render-optimized">
                      {todo.title}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span
                        className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          todo.priority === "high"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : todo.priority === "low"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {priorityLabels[todo.priority || "medium"]}优先级
                      </span>
                      <span
                        className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          todo.scope === "personal"
                            ? "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600"
                            : todo.created_by === String(account?.id)
                            ? "bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
                            : "bg-teal-100 text-teal-600 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
                        }`}
                      >
                        {todo.scope === "personal" ? "个人" : todo.created_by === String(account?.id) ? "共享" : "组内共享"}
                      </span>
                      {todo.due_date && (
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          截止：{todo.due_date}
                        </p>
                      )}
                    </div>
                  </div>
                  {(todo.created_by === String(account?.id) || isAdmin) && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleEdit(todo)}
                        aria-label="编辑待办"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => todo.id && handleDelete(todo.id)}
                        aria-label="删除待办"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 归档按钮 */}
          <div className="mt-3 pt-3 border-t border-border/30">
            <button
              onClick={handleToggleArchived}
              className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 py-1.5 px-1 rounded-md hover:bg-muted/40"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>已归档事项</span>
              <ChevronDown
                className={`h-3.5 w-3.5 ml-auto transition-transform duration-200 ${
                  showArchived ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* 归档列表 */}
            {showArchived && (
              <div className="mt-2 space-y-1.5">
                {loadingArchived ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-10 rounded-lg shimmer bg-muted/30" />
                    ))}
                  </div>
                ) : archivedTodos.length === 0 ? (
                  <p className="text-center text-muted-foreground/60 text-xs py-4">
                    暂无归档事项
                  </p>
                ) : (
                  archivedTodos.map((todo, i) => (
                    <div
                      key={todo.id}
                      className="group flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/20 animate-fade-in-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500/60" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-muted-foreground line-through truncate text-render-optimized">
                          {todo.title}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span
                            className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                              todo.scope === "personal"
                                ? "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600"
                                : todo.created_by === String(account?.id)
                                ? "bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
                                : "bg-teal-100 text-teal-600 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
                            }`}
                          >
                            {todo.scope === "personal" ? "个人" : todo.created_by === String(account?.id) ? "共享" : "组内共享"}
                          </span>
                          {todo.completed_at && (
                            <p className="text-[10px] text-muted-foreground/50">
                              完成于 {todo.completed_at.slice(0, 10)}
                            </p>
                          )}
                        </div>
                      </div>
                      {(todo.created_by === String(account?.id) || isAdmin) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                            onClick={() => todo.id && handleRestore(todo.id)}
                            aria-label="恢复待办"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => todo.id && handleDeleteArchived(todo.id)}
                            aria-label="删除归档待办"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 创建对话框 */}
      <TodoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />

      {/* 编辑对话框 */}
      <TodoDialog
        open={!!editingTodo}
        onClose={() => setEditingTodo(null)}
        onUpdated={handleUpdated}
        editTodo={editingTodo}
      />

      {/* 描述详情对话框 */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="删除待办"
        message="确定删除这个待办吗？"
      />

      <ConfirmDialog
        open={confirmDeleteArchivedId !== null}
        onClose={() => setConfirmDeleteArchivedId(null)}
        onConfirm={handleConfirmDeleteArchived}
        variant="danger"
        title="删除已归档待办"
        message="确定删除这个已归档的待办吗？"
      />

      {detailTodo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setDetailTodo(null)}
          />
          <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-md mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
                  <AlignLeft className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">待办描述</h2>
              </div>
              <button
                onClick={() => setDetailTodo(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm font-medium text-foreground">{detailTodo.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {detailTodo.description || "暂无描述"}
              </p>
            </div>
            <div className="flex justify-end px-5 py-3 border-t border-border">
              <Button variant="ghost" onClick={() => setDetailTodo(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
