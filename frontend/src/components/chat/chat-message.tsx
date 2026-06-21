"use client";

import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 md:gap-3.5 py-2.5 md:py-3.5",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex h-9 w-9 md:h-10 md:w-10 select-none items-center justify-center rounded-full relative z-10 transition-transform duration-200 hover:scale-105",
            isUser
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4 md:h-[18px] md:w-[18px]" />
          ) : (
            <Bot className="h-4 w-4 md:h-[18px] md:w-[18px]" />
          )}
        </div>
      </div>

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col gap-1.5 min-w-0 max-w-[83%] md:max-w-[72%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "relative px-4 py-3 md:px-5 md:py-3.5 text-[14px] leading-[1.7]",
            isUser
              ? [
                  "bg-primary text-primary-foreground",
                  "rounded-2xl rounded-tr-md",
                  "shadow-sm shadow-primary/15",
                ]
              : [
                  "bg-card",
                  "border border-border/80",
                  "text-card-foreground",
                  "rounded-2xl rounded-tl-md",
                  "shadow-sm",
                ]
          )}
        >
          <p className="whitespace-pre-wrap break-words text-render-optimized">
            {message.content}
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] md:text-[11px] text-muted-foreground/60 px-2 font-normal tabular-nums",
            isUser ? "pr-3" : "pl-3"
          )}
        >
          {message.timestamp.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
