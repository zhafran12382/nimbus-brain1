"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2 } from "lucide-react";
import { ChatMode, ProviderId } from "@/types";
import { ModeToggle } from "./mode-toggle";
import { ModelSelector } from "./model-selector";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  /* Area Z props */
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  providerId: ProviderId;
  modelId: string;
  onProviderChange: (id: ProviderId) => void;
  onModelChange: (id: string) => void;
}

export function ChatInput({
  onSend,
  isLoading,
  mode,
  onModeChange,
  providerId,
  modelId,
  onProviderChange,
  onModelChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  const hasText = input.trim().length > 0;

  return (
    <div
      className="border-t border-[hsl(0_0%_100%_/_0.04)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-[var(--chat-content-max-width)] px-3 sm:px-4">
        {/* Input Row */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 pt-3 pb-3"
        >
          <div
            className={`flex flex-1 flex-col rounded-[1.35rem] border transition-all duration-200 bg-[hsl(220_14%_11%_/_0.88)] ${focused
                ? "border-[hsl(217_91%_60%_/_0.35)] shadow-[0_0_0_1px_hsl(217_91%_60%_/_0.14),0_8px_28px_-10px_hsl(217_91%_60%_/_0.5)]"
                : "border-[hsl(0_0%_100%_/_0.1)]"
              }`}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Tanya Nimbus Brain..."
              disabled={isLoading}
              className="w-full bg-transparent px-4 py-3.5 text-[16px] leading-[1.65] tracking-[0.01em] text-[#ECECEC] placeholder:text-[15px] placeholder:text-[#8F9198] focus:outline-none disabled:opacity-50"
            />

            {/* Bottom Row inside input box: Mode (Left) + Model (Right) */}
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-1.5">
                <ModeToggle value={mode} onChange={onModeChange} />
              </div>
              <div className="flex items-center gap-1.5">
                <ModelSelector
                  providerId={providerId}
                  modelId={modelId}
                  onProviderChange={onProviderChange}
                  onModelChange={onModelChange}
                />
              </div>
            </div>
          </div>

          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!hasText || isLoading}
            whileTap={hasText && !isLoading ? { scale: 0.9 } : undefined}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 self-end ${hasText
                ? "bg-[hsl(217_91%_60%)] text-white shadow-[0_8px_24px_-8px_hsl(217_91%_60%_/_0.7)]"
                : "bg-[hsl(220_12%_14%)] text-[hsl(0_0%_40%)]"
              } disabled:opacity-50`}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
