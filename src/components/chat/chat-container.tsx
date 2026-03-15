"use client";

import { useRef, useEffect } from "react";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-4xl mb-4">⚡</p>
              <p className="text-lg font-semibold text-zinc-300">Welcome to Nimbus Brain 👋</p>
              <p className="text-sm text-zinc-500 mt-1">
                Mulai percakapan atau coba salah satu contoh di bawah
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <button
                  onClick={() => onSend("Buat target baru: baca 10 buku tahun ini")}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                >
                  🎯 Buat target baru
                </button>
                <button
                  onClick={() => onSend("Apa berita terbaru hari ini?")}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                >
                  🔍 Web search
                </button>
                <button
                  onClick={() => onSend("Tampilkan semua target aktif")}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                >
                  📋 Lihat target
                </button>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 px-4">
              <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]">
                {/* Status text */}
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span>{streamStatus || 'Thinking...'}</span>
                </div>

                {/* Tool calls yang sedang dijalankan */}
                {pendingToolCalls && pendingToolCalls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pendingToolCalls.map((tc, i) => (
                      <div key={i} className="text-xs bg-zinc-700/50 rounded px-2 py-1 text-green-400">
                        ✅ {tc.name}: {tc.result}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
}
