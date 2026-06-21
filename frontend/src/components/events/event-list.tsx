"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Trash2, Plus, Pencil } from "lucide-react";
import { getEvents, deleteEvent, EventData } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { emitDataChange, useDataChangeListener } from "@/lib/data-events";
import { EventDialog } from "./event-dialog";

export function EventList() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      console.error("加载事件失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 监听其他组件实例的数据变更
  useDataChangeListener("events", loadEvents);

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除这个事件吗？")) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      emitDataChange("events");
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  const handleCreated = (event: EventData) => {
    setEvents((prev) => [...prev, event].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ));
    emitDataChange("events");
  };

  const handleUpdated = (event: EventData) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? event : e)).sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
    );
    emitDataChange("events");
  };

  const handleEdit = (event: EventData) => {
    setEditingEvent(event);
  };

  return (
    <>
      <Card className="card-hover overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-[15px] md:text-base font-semibold text-render-optimized">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            日程安排
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
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-3">
                <Calendar className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <p className="text-muted-foreground text-sm font-normal">
                暂无日程
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                点击添加开始记录
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event, i) => (
                <div
                  key={event.id}
                  className="group relative flex items-start justify-between p-3.5 rounded-lg border border-border/50 bg-background hover:bg-muted/40 transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[13px] truncate text-foreground text-render-optimized">
                      {event.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {formatDateTime(event.start_time)}
                    </p>
                    {event.description && (
                      <p className="text-[12px] mt-2 text-muted-foreground line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleEdit(event)}
                      aria-label="编辑日程"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => event.id && handleDelete(event.id)}
                      aria-label="删除日程"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建对话框 */}
      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />

      {/* 编辑对话框 */}
      <EventDialog
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onUpdated={handleUpdated}
        editEvent={editingEvent}
      />
    </>
  );
}
