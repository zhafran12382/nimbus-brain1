"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
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
    <div className="glass border-t border-[hsl(0_0%_100%_/_0.04)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2 p-3 sm:p-4">
        <div className={`flex flex-1 items-center rounded-xl border transition-all duration-200 ${
          focused
            ? "border-[hsl(217_91%_60%_/_0.2)] shadow-[0_0_0_1px_hsl(217_91%_60%_/_0.08),0_0_20px_-4px_hsl(217_91%_60%_/_0.15)] bg-[hsl(0_0%_9%_/_0.8)]"
            : "border-[hsl(0_0%_100%_/_0.06)] bg-transparent"
        }`}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Tanya Nimbus Brain..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-4 py-2.5 text-sm text-[hsl(0_0%_93%)] placeholder:text-[hsl(0_0%_30%)] focus:outline-none disabled:opacity-50"
          />
        </div>
        <motion.button
          type="submit"
          disabled={!hasText || isLoading}
          whileTap={hasText && !isLoading ? { scale: 0.9 } : undefined}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
            hasText
              ? "bg-[hsl(217_91%_60%)] text-white shadow-[0_0_16px_hsl(217_91%_60%_/_0.25)]"
              : "bg-[hsl(0_0%_10%)] text-[hsl(0_0%_30%)]"
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </motion.button>
      </form>
    </div>
  );
}
