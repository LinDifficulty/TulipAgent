"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage, Message } from "./chat-message";
import { ChatInput } from "./chat-input";
import { sendMessage, getWelcomeMessage } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadWelcome = async () => {
      try {
        const welcomeMsg = await getWelcomeMessage();
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: welcomeMsg,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "你好呀~ 我是 TulipAgent 🌷 有什么需要帮忙的吗？",
            timestamp: new Date(),
          },
        ]);
      }
    };
    loadWelcome();
  }, []);

  const handleSend = async (content: string) => {
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendMessage({
        message: content,
        session_id: sessionId || undefined,
      });

      if (!sessionId) {
        setSessionId(response.session_id);
      }

      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "抱歉，出现了点问题，请稍后再试~",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 space-y-0.5 scroll-container">
        {messages.map((message, i) => (
          <div
            key={message.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }}
          >
            <ChatMessage message={message} />
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3 py-3 animate-fade-in">
            {/* Bot avatar placeholder */}
            <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <svg
                className="h-4 w-4 md:h-[18px] md:w-[18px] animate-pulse"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 8V12L15 15" strokeLinecap="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            {/* Typing dots in a bubble */}
            <div className="bg-card border border-border/80 rounded-2xl rounded-tl-md px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-[7px] h-[7px] rounded-full bg-primary/40"
                    style={{
                      animation: `typing-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
