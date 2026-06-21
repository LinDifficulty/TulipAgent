"use client";

import { Calendar, ListTodo, Package, Gift, BookOpen, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface WorkHubProps {
  onSelect: (view: "events" | "todos" | "packages" | "anniversaries" | "worklogs") => void;
}

const FEATURES = [
  {
    key: "events" as const,
    label: "日程管理",
    description: "\u67e5\u770b\u548c\u7ba1\u7406\u65e5\u7a0b\u5b89\u6392\u3001\u4f1a\u8bae\u63d0\u9192",
    icon: Calendar,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/40",
  },
  {
    key: "todos" as const,
    label: "待办事项",
    description: "跟踪任务进度，管理待办清单",
    icon: ListTodo,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/40",
  },
  {
    key: "packages" as const,
    label: "快递追踪",
    description: "追踪包裹状态，自动识别快递公司",
    icon: Package,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
  },
  {
    key: "anniversaries" as const,
    label: "纪念日",
    description: "记录重要日子，倒数计时提醒",
    icon: Gift,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/40",
  },
  {
    key: "worklogs" as const,
    label: "工作日志",
    description: "记录工作内容，生成周/月汇报",
    icon: BookOpen,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
];

export function WorkHub({ onSelect }: WorkHubProps) {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 scroll-container">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h2 className="text-2xl font-bold text-foreground text-render-optimized tracking-tight">
            工作台
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 font-normal">
            管理你们的日程和待办
          </p>
        </div>

        {/* Feature cards */}
        <div className="space-y-4">
          {FEATURES.map(({ key, label, description, icon: Icon, color, bg }, i) => (
            <Card
              key={key}
              className={`group cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.99] animate-fade-in-up overflow-hidden`}
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
              onClick={() => onSelect(key)}
            >
              <CardContent className="flex items-center gap-4 p-5 md:p-6 relative">
                <div
                  className={`flex items-center justify-center w-14 h-14 rounded-2xl ${bg} shrink-0 transition-transform duration-200 group-hover:scale-105`}
                >
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div className="flex-1 min-w-0 relative">
                  <h3 className="font-bold text-[15px] text-foreground text-render-optimized">
                    {label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 font-normal leading-relaxed">
                    {description}
                  </p>
                </div>
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0 transition-all duration-200 group-hover:bg-muted/80">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-colors duration-200 group-hover:text-foreground/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
