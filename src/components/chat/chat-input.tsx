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
  onGenerateImage: (prompt: string) => void;
  isGeneratingImage: boolean;
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
  onGenerateImage,
  isGeneratingImage,
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
    if (!trimmed || isLoading || isGeneratingImage) return;
    onSend(trimmed);
    setInput("");
  };

  const handleImageGenerate = () => {
    const trimmed = input.trim();
    if (!trimmed || isGeneratingImage || isLoading) return;
    onGenerateImage(trimmed);
    setInput("");
  };

  const hasText = input.trim().length > 0;
  const isBusy = isLoading || isGeneratingImage;

  return (
    <div
      className="sticky bottom-0 z-30 border-t border-[hsl(0_0%_100%_/_0.04)] bg-[var(--bg-base)]"
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
              placeholder="Tanya Nimbus Brain..."
              disabled={isBusy}
              className="w-full bg-transparent px-4 py-3.5 text-[16px] leading-[1.65] tracking-[0.01em] text-[#ECECEC] placeholder:text-[15px] placeholder:text-[#8F9198] focus:outline-none disabled:opacity-50"
            />

            {/* Bottom Row inside input box: Mode + Image btn (Left) + Model (Right) */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 pb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ModeToggle value={mode} onChange={onModeChange} />
                {/* Generate Image Button */}
                <button
                  type="button"
                  onClick={handleImageGenerate}
                  disabled={!hasText || isBusy}
                  title="Generate Image"
                  className="relative z-10 flex min-h-[40px] min-w-[40px] items-center gap-1.5 rounded-2xl border border-[hsl(222_18%_34%_/_0.5)] bg-[linear-gradient(180deg,hsl(224_14%_16%),hsl(224_12%_12%))] px-3 py-1.5 text-[hsl(0_0%_88%)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04),0_6px_20px_-14px_hsl(160_84%_39%_/_0.6)] hover:border-[hsl(160_84%_39%_/_0.45)] hover:bg-[linear-gradient(180deg,hsl(224_16%_18%),hsl(224_13%_13%))] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  style={{ pointerEvents: (!hasText || isBusy) ? "none" : "auto" }}
                >
                  {isGeneratingImage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-emerald-300" />
                  )}
                  <span className="text-xs font-semibold hidden sm:inline">Image</span>
                </button>
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
            disabled={!hasText || isBusy}
            whileTap={hasText && !isBusy ? { scale: 0.9 } : undefined}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 self-end min-h-[44px] min-w-[44px] ${hasText
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
