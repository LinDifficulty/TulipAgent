"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquare, Plus, Loader2 } from "lucide-react";
import { getConversations, ConversationSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
  activeSessionId: string | null;
}

/** 格式化时间显示 */
function formatTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 86400000;

  const timeStr = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return `今天 ${timeStr}`;
  } else if (diff < 2 * oneDay && date.getDate() === now.getDate() - 1) {
    return `昨天 ${timeStr}`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

export function ChatHistoryDialog({
  open,
  onClose,
  onSelectSession,
  onNewConversation,
  activeSessionId,
}: ChatHistoryDialogProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getConversations();
        setConversations(data);
      } catch {
        setConversations([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [open]);

  if (!open) return null;

  const handleSelect = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const handleNew = () => {
    onNewConversation();
    onClose();
  };

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog card */}
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-lg w-[90vw] max-w-md mx-4 max-h-[80vh] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">聊天记录</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New conversation button */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-all text-sm font-medium active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            开启新对话
          </button>
        </div>

        {/* Divider */}
        <div className="px-5 py-2 shrink-0">
          <div className="border-t border-border" />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 scroll-container">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">暂无聊天记录</p>
              <p className="text-xs mt-1 opacity-60">开始一段新对话吧</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {conversations.map((conv) => (
                <button
                  key={conv.session_id}
                  onClick={() => handleSelect(conv.session_id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg transition-all border",
                    activeSessionId === conv.session_id
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent hover:bg-muted/60 hover:border-border"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(conv.last_active)}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                      {conv.message_count} 条
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5 truncate">
                    {conv.preview || "(空消息)"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
