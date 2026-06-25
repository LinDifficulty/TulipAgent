"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { emitDataChange } from "@/lib/data-events";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatHistoryDialog } from "@/components/chat/chat-history-dialog";
import { EventList } from "@/components/events/event-list";
import { WeeklyCalendar } from "@/components/events/weekly-calendar";
import { TodoList } from "@/components/todos/todo-list";
import { PackageList } from "@/components/packages/package-list";
import { AnniversaryList } from "@/components/anniversaries/anniversary-list";
import { WorkHub } from "@/components/work/work-hub";
import { WorkLogList } from "@/components/work-logs/work-log-list";
import { MessageSquare, Briefcase, ArrowLeft, Loader2, History } from "lucide-react";
import { UserMenu } from "@/components/profile/user-menu";

type WorkView = null | "events" | "todos" | "packages" | "anniversaries" | "worklogs";

const STORAGE_KEY = "tulip_last_session_id";

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
  const { isAuthenticated, isLoading, account } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chat" | "work">("chat");
  const [workView, setWorkView] = useState<WorkView>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // 会话管理：从 localStorage 恢复上次会话 ID
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });
  const [chatKey, setChatKey] = useState(0); // 用于强制重新挂载 ChatContainer

  const handleSessionChange = (newSessionId: string) => {
    setSessionId(newSessionId);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newSessionId);
    }
  };

  const handleSelectSession = (sid: string) => {
    setSessionId(sid);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, sid);
    }
    setChatKey((k) => k + 1); // 强制 ChatContainer 重新挂载以加载新会话
  };

  const handleNewConversation = () => {
    setSessionId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setChatKey((k) => k + 1);
  };

  // 未登录跳转
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // 点击进入快递追踪时触发所有 PackageList 实例从数据库拉取最新数据
  useEffect(() => {
    if (workView === "packages") {
      emitDataChange("packages");
    }
  }, [workView]);

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
      {/* ===== 桌面端：左侧导航栏 ===== */}
      <aside className="hidden md:flex w-[72px] lg:w-20 border-r border-border flex-col shrink-0 bg-muted/30 select-none">
        {/* 品牌图标 */}
        <div className="flex items-center justify-center py-4 border-b border-border">
          <span
            className="text-2xl select-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
            role="img"
            aria-label="tulip"
            onClick={() => handleTabChange("chat")}
          >
            🌷
          </span>
        </div>

        {/* 导航按钮 */}
        <nav className="flex-1 flex flex-col items-center gap-1.5 px-2 pt-4">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`relative flex flex-col items-center gap-1 w-full py-3 rounded-xl text-[11px] transition-all duration-200 group ${
                activeTab === key
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={label}
            >
              <Icon
                className={`h-5 w-5 transition-all duration-200 ${
                  activeTab === key ? "scale-110" : "group-hover:scale-105"
                }`}
              />
              <span className="font-medium leading-none">{label}</span>
              {/* 左侧激活指示条 */}
              {activeTab === key && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        {/* 底部用户功能区 */}
        <div className="border-t border-border p-2 flex flex-col items-center gap-2">
          <UserMenu />
          <button
            onClick={() => setHistoryDialogOpen(true)}
            className="p-1.5 rounded-lg transition-all text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="聊天记录"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* ===== 主内容区 ===== */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* 桌面端 */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {activeTab === "chat" && (
              <ChatContainer
                key={chatKey}
                sessionId={sessionId}
                onSessionChange={handleSessionChange}
              />
            )}
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
              <UserMenu />
              <span className="text-sm font-medium text-foreground">
                {account?.nickname}
              </span>
            </div>
            <button
              onClick={() => setHistoryDialogOpen(true)}
              className="p-1.5 rounded-lg transition-all text-muted-foreground hover:text-primary"
              title="聊天记录"
            >
              <History className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" && (
              <ChatContainer
                key={chatKey}
                sessionId={sessionId}
                onSessionChange={handleSessionChange}
              />
            )}
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

      {/* 聊天记录对话框 */}
      <ChatHistoryDialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        onSelectSession={handleSelectSession}
        onNewConversation={handleNewConversation}
        activeSessionId={sessionId}
      />

    </div>
  );
}
