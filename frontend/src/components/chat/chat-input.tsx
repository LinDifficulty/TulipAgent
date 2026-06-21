"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <div className="relative z-10 shrink-0">
      <div className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="flex gap-3 p-3 md:p-4">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled}
            className="flex-1 h-11 md:h-11 text-sm bg-muted/50 border-border focus-visible:bg-background rounded-xl"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
          />
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            style={{ touchAction: "manipulation" }}
            className={`h-11 w-11 md:h-11 md:w-11 shrink-0 rounded-xl transition-all duration-200 ${
              canSend
                ? "shadow-md hover:shadow-lg hover:shadow-primary/20"
                : ""
            }`}
          >
            <Send
              className={`h-4 w-4 transition-transform duration-200 ${
                canSend ? "scale-100" : "scale-90 opacity-50"
              }`}
            />
          </Button>
        </div>
        {/* Safe area padding for iPhone */}
        <div className="h-[env(safe-area-inset-bottom,0px)] md:hidden" />
      </div>
    </div>
  );
}
