"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2, ImageIcon } from "lucide-react";
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
  onImageGenerate?: (prompt: string) => void;
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
  onImageGenerate,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (imageMode && onImageGenerate) {
      onImageGenerate(trimmed);
    } else {
      onSend(trimmed);
    }
    setInput("");
  };

  const hasText = input.trim().length > 0;

  return (
    <div
      className="sticky bottom-0 z-10 border-t border-[hsl(0_0%_100%_/_0.04)] bg-[hsl(0_0%_4%)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-[var(--chat-content-max-width)] px-3 sm:px-4">
        {/* Input Row */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 pt-3 pb-3"
        >
          <div
            className={`flex flex-1 flex-col rounded-[1.35rem] border transition-all duration-200 bg-[hsl(220_14%_11%_/_0.88)] min-w-0 ${focused
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
              placeholder={imageMode ? "Describe the image you want..." : "Tanya Nimbus Brain..."}
              disabled={isLoading}
              className="w-full bg-transparent px-4 py-3.5 text-[16px] leading-[1.65] tracking-[0.01em] text-[#ECECEC] placeholder:text-[15px] placeholder:text-[#8F9198] focus:outline-none disabled:opacity-50 min-w-0"
            />

            {/* Bottom Row inside input box: Mode (Left) + Image + Model (Right) */}
            <div className="flex items-center justify-between px-2 pb-2 gap-1.5 flex-nowrap">
              <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                <ModeToggle value={mode} onChange={onModeChange} />
              </div>
              <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                {/* Generate Image toggle button */}
                <button
                  type="button"
                  onClick={() => setImageMode(!imageMode)}
                  disabled={isLoading}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all z-10 ${
                    imageMode
                      ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                      : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/8 hover:text-white/80"
                  }`}
                  style={{ minHeight: "40px", minWidth: "40px", touchAction: "manipulation" }}
                  title="Generate Image"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{imageMode ? "Image On" : "Image"}</span>
                </button>
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
                ? imageMode
                  ? "bg-violet-500 text-white shadow-[0_8px_24px_-8px_hsl(263_70%_58%_/_0.7)]"
                  : "bg-[hsl(217_91%_60%)] text-white shadow-[0_8px_24px_-8px_hsl(217_91%_60%_/_0.7)]"
                : "bg-[hsl(220_12%_14%)] text-[hsl(0_0%_40%)]"
              } disabled:opacity-50`}
            style={{ minHeight: "48px", minWidth: "48px" }}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : imageMode ? (
              <ImageIcon className="h-5 w-5" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
