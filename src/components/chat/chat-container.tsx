"use client";

import { useRef, useEffect } from "react";
import { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface ChatContainerProps {
  messages: ChatMessageType[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatContainer({ messages, onSend, isLoading }: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-lg text-zinc-500">Mulai percakapan!</p>
              <p className="text-sm text-zinc-600 mt-1">
                Coba: &quot;target baru: bench press 60kg&quot;
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
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
