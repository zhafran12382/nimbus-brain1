"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { messageBubble } from "@/lib/animations";

interface ChatContainerProps {
  messages: ChatMessageType[];
  onSend: (message: string) => void;
  isLoading: boolean;
  streamStatus?: string | null;
  pendingToolCalls?: { name?: string; result?: string }[];
}

export function ChatContainer({ messages, onSend, isLoading, streamStatus, pendingToolCalls }: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamStatus, pendingToolCalls]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-5 pb-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center pt-[25vh] text-center">
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
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[hsl(0_0%_100%_/_0.08)] text-xs text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.3)] hover:bg-[hsl(217_91%_60%_/_0.05)] transition-colors"
                >
                  📰 Berita terbaru hari ini
                </button>
                <button
                  onClick={() => onSend("Buat target baru: baca 10 buku tahun ini")}
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[hsl(0_0%_100%_/_0.08)] text-xs text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.3)] hover:bg-[hsl(217_91%_60%_/_0.05)] transition-colors"
                >
                  🎯 Buat target baru
                </button>
                <button
                  onClick={() => onSend("Tampilkan semua target aktif dan progress-nya")}
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[hsl(0_0%_100%_/_0.08)] text-xs text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.3)] hover:bg-[hsl(217_91%_60%_/_0.05)] transition-colors"
                >
                  📊 Lihat progress target
                </button>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Loading / streaming state */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={messageBubble.initial}
                animate={messageBubble.animate}
                exit={{ opacity: 0 }}
                transition={messageBubble.transition}
                className="flex items-start gap-2.5"
              >
                {/* Avatar */}
                <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-[11px] font-bold text-white mt-1">
                  N
                </div>
                <div className="glass-card rounded-2xl rounded-bl-sm px-4 py-3 max-w-[75%] sm:max-w-[70%]">
                  {/* Status text with pulse dots */}
                  <div className="flex items-center gap-2.5 text-sm text-[hsl(0_0%_45%)]">
                    <div className="flex gap-1 items-center">
                      <span className="dot-1 h-1.5 w-1.5 rounded-full bg-[hsl(217_91%_60%)]" />
                      <span className="dot-2 h-1.5 w-1.5 rounded-full bg-[hsl(217_91%_60%)]" />
                      <span className="dot-3 h-1.5 w-1.5 rounded-full bg-[hsl(217_91%_60%)]" />
                    </div>
                    <span className="text-xs">{streamStatus || "Thinking..."}</span>
                  </div>

                  {/* Tool call results */}
                  {pendingToolCalls && pendingToolCalls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pendingToolCalls.map((tc, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="text-xs rounded-md px-2 py-1 bg-[hsl(0_0%_5%)] text-[hsl(160_84%_39%)]"
                        >
                          ✅ {tc.name}: {tc.result}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
}
