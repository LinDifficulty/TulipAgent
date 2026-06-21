"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ChatContainer } from "@/components/chat/chat-container";
import { EventList } from "@/components/events/event-list";
import { WeeklyCalendar } from "@/components/events/weekly-calendar";
import { TodoList } from "@/components/todos/todo-list";
import { PackageList } from "@/components/packages/package-list";
import { AnniversaryList } from "@/components/anniversaries/anniversary-list";
import { WorkHub } from "@/components/work/work-hub";
import { WorkLogList } from "@/components/work-logs/work-log-list";
import { MessageSquare, Briefcase, ArrowLeft, Shield, LogOut, Loader2, Phone } from "lucide-react";
import { PhoneDialog } from "@/components/profile/phone-dialog";

type WorkView = null | "events" | "todos" | "packages" | "anniversaries" | "worklogs";

const NAV_ITEMS = [
  { key: "chat", label: "聊天", icon: MessageSquare },
  { key: "work", label: "工作", icon: Briefcase },
] as const;

/** 工作子页面顶部的返回栏 */
function WorkBackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background shrink-0 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg px-2.5 py-1.5 -ml-2 hover:bg-muted active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-medium">返回</span>
      </button>
      <div className="w-px h-4 bg-border" />
      <span className="text-sm font-semibold text-foreground tracking-wide">
        {title}
      </span>
    </div>
  );
}

/** 根据 workView 渲染对应的功能组件 */
function WorkContent({
  workView,
  onBack,
}: {
  workView: WorkView;
  onBack: () => void;
}) {
  const titles = { events: "日程管理", todos: "待办事项", packages: "快递追踪", anniversaries: "纪念日", worklogs: "工作日志" };
  if (!workView) return null;
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WorkBackBar title={titles[workView]} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-container">
        {workView === "events" && (
          <div className="space-y-4">
            <EventList />
            <div className="card-hover overflow-hidden rounded-xl border border-border bg-card">
              <div className="h-[560px] md:h-[620px]">
                <WeeklyCalendar />
              </div>
            </div>
          </div>
        )}
        {workView === "todos" && <TodoList />}
        {workView === "packages" && <PackageList />}
        {workView === "anniversaries" && <AnniversaryList />}
        {workView === "worklogs" && <WorkLogList />}
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isAdmin, isLoading, account, logout, refreshAccount } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chat" | "work">("chat");
  const [workView, setWorkView] = useState<WorkView>(null);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);

  // 未登录跳转
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleTabChange = (tab: "chat" | "work") => {
    setActiveTab(tab);
    if (tab === "work") setWorkView(null);
  };

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 未登录（等待跳转）
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] bg-background relative overflow-hidden">
      {/* ===== 桌面端：左侧边栏 ===== */}
      <aside className="hidden md:flex w-64 lg:w-72 xl:w-80 border-r border-border flex-col shrink-0 overflow-y-auto bg-muted/30">
        {/* 侧边栏头部 — 品牌区域 + 用户信息 */}
        <div className="sticky top-0 z-10 border-b border-border px-5 py-4 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2.5">
            <span className="text-2xl select-none" role="img" aria-label="tulip">
              🌷
            </span>
            <h1 className="text-lg font-bold tracking-tight text-foreground text-render-optimized">
              TulipAgent
            </h1>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-1 font-normal tracking-widest uppercase">
            你们的专属助理
          </p>

          {/* 用户信息栏 */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {account?.nickname?.[0] || "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {account?.nickname}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {account?.role === "admin" ? "管理员" : "用户"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPhoneDialogOpen(true)}
                className={`p-1.5 rounded-lg transition-all ${
                  account?.phone
                    ? "text-muted-foreground hover:text-primary hover:bg-primary/10"
                    : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                }`}
                title={account?.phone || "点击填写手机号"}
              >
                <Phone className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => router.push("/admin")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  title="管理后台"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 侧边栏内容 */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto scroll-container">
          <div className="animate-fade-in-up stagger-1">
            <EventList />
          </div>
          <div className="animate-fade-in-up stagger-2">
            <TodoList />
          </div>
          <div className="animate-fade-in-up stagger-3">
            <PackageList />
          </div>
          <div className="animate-fade-in-up stagger-4">
            <AnniversaryList />
          </div>
        </div>
      </aside>

      {/* ===== 主内容区 ===== */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* 桌面端 */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {activeTab === "chat" && <ChatContainer />}
            {activeTab === "work" && workView === null && (
              <WorkHub onSelect={setWorkView} />
            )}
            {activeTab === "work" && workView !== null && (
              <WorkContent
                workView={workView}
                onBack={() => setWorkView(null)}
              />
            )}
          </div>
        </div>

        {/* 移动端 */}
        <div className="md:hidden flex flex-col flex-1 min-h-0 safe-area-top">
          {/* 移动端顶部用户栏 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-primary">
                  {account?.nickname?.[0] || "?"}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {account?.nickname}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPhoneDialogOpen(true)}
                className={`p-1.5 rounded-lg transition-all ${
                  account?.phone
                    ? "text-muted-foreground hover:text-primary"
                    : "text-muted-foreground/50 hover:text-primary"
                }`}
                title={account?.phone || "点击填写手机号"}
              >
                <Phone className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => router.push("/admin")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary"
                  title="管理后台"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" && <ChatContainer />}
            {activeTab === "work" && workView === null && (
              <WorkHub onSelect={setWorkView} />
            )}
            {activeTab === "work" && workView !== null && (
              <WorkContent
                workView={workView}
                onBack={() => setWorkView(null)}
              />
            )}
          </div>

          {/* ===== 移动端底部导航栏 ===== */}
          <nav className="flex border-t border-border bg-background safe-area-bottom shrink-0 z-20">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                style={{ touchAction: "manipulation" }}
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-all duration-200 ${
                  activeTab === key
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-all duration-200 ${
                    activeTab === key ? "scale-110" : ""
                  }`}
                />
                <span className="font-medium">{label}</span>
                {/* Indicator pill */}
                <span
                  className={`absolute bottom-1 h-[3px] rounded-full transition-all duration-300 ${
                    activeTab === key
                      ? "w-6 bg-primary opacity-100"
                      : "w-0 opacity-0"
                  }`}
                />
              </button>
            ))}
          </nav>
        </div>
      </main>

      {/* 手机号编辑对话框 */}
      <PhoneDialog
        open={phoneDialogOpen}
        onClose={() => setPhoneDialogOpen(false)}
        onSaved={refreshAccount}
        currentPhone={account?.phone ?? null}
      />
    </div>
  );
}
