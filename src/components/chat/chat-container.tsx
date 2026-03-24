"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMode, ProviderId } from "@/types";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { AssistantMessage, AssistantMessageState } from "./assistant-message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { messageBubble } from "@/lib/animations";

interface ChatContainerProps {
  messages: ChatMessageType[];
  onSend: (message: string) => void;
  isLoading: boolean;
  streamingState?: AssistantMessageState | null;
  streamStatus?: string | null;
  pendingToolCalls?: { name?: string; result?: string }[];
  /* Image generation */
  onGenerateImage: (prompt: string) => void;
  isGeneratingImage: boolean;
  /* Area Z pass-through */
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  providerId: ProviderId;
  modelId: string;
  onProviderChange: (id: ProviderId) => void;
  onModelChange: (id: string) => void;
}

export function ChatContainer({
  messages,
  onSend,
  isLoading,
  streamingState,
  onGenerateImage,
  isGeneratingImage,
  mode,
  onModeChange,
  providerId,
  modelId,
  onProviderChange,
  onModelChange,
}: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingState?.phase, streamingState?.content]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
      <ScrollArea className="flex-1 px-2 py-3 sm:p-4">
        <div className="mx-auto w-full max-w-[var(--chat-content-max-width)] min-w-0 space-y-[14px] pb-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center pt-[25vh] text-center px-4">
              {/* Logo with glow */}
              <div
                className="logo-pulse flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-2xl font-bold text-white mb-4"
                style={{ boxShadow: "0 0 60px hsl(217 91% 60% / 0.15)" }}
              >
                N
              </div>
              <p className="text-lg font-semibold text-[hsl(0_0%_93%)]">Nimbus Brain</p>
              <p className="text-sm text-[hsl(0_0%_45%)] mt-1 max-w-xs">
                Asisten personal cerdas. Tanya apa saja atau kelola target-mu.
              </p>
              <div className="flex flex-wrap gap-2 mt-5 justify-center">
                <button
                  onClick={() => onSend("Apa berita terbaru hari ini?")}
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[hsl(0_0%_100%_/_0.08)] text-xs text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.3)] hover:bg-[hsl(217_91%_60%_/_0.05)] transition-colors min-h-[40px]"
                >
                  📰 Berita terbaru hari ini
                </button>
                <button
                  onClick={() => onSend("Buat target baru: baca 10 buku tahun ini")}
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[hsl(0_0%_100%_/_0.08)] text-xs text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.3)] hover:bg-[hsl(217_91%_60%_/_0.05)] transition-colors min-h-[40px]"
                >
                  🎯 Buat target baru
                </button>
                <button
                  onClick={() => onSend("Tampilkan semua target aktif dan progress-nya")}
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[hsl(0_0%_100%_/_0.08)] text-xs text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.3)] hover:bg-[hsl(217_91%_60%_/_0.05)] transition-colors min-h-[40px]"
                >
                  📊 Lihat progress target
                </button>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Streaming assistant response */}
          <AnimatePresence>
            {isLoading && streamingState && (
              <motion.div
                key="streaming-assistant"
                initial={messageBubble.initial}
                animate={messageBubble.animate}
                exit={{ opacity: 0 }}
                transition={messageBubble.transition}
              >
                <AssistantMessage state={streamingState} />
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area with integrated model/mode selectors (Area Z) */}
      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        onGenerateImage={onGenerateImage}
        isGeneratingImage={isGeneratingImage}
        mode={mode}
        onModeChange={onModeChange}
        providerId={providerId}
        modelId={modelId}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />
    </div>
  );
}
