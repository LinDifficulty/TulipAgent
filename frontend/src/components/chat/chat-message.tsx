"use client";

import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

const markdownComponents: Components = {
  // 代码块
  pre: ({ children }) => (
    <pre className="bg-muted/60 rounded-lg p-3 my-2 overflow-x-auto text-[13px] leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className?.includes("hljs");
    if (isInline) {
      return (
        <code
          className="bg-muted/60 rounded px-1.5 py-0.5 text-[13px] font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("font-mono text-[13px]", className)} {...props}>
        {children}
      </code>
    );
  },
  // 段落
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  // 链接
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  // 列表
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  // 标题
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mt-3 mb-1.5">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-2.5 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
  ),
  // 引用
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-primary/30 pl-3 my-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  // 分割线
  hr: () => <hr className="my-3 border-border/60" />,
  // 表格
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5">{children}</td>
  ),
  // 加粗
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  // 删除线
  del: ({ children }) => (
    <del className="line-through text-muted-foreground">{children}</del>
  ),
};

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
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-render-optimized">
              {message.content}
            </p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
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
