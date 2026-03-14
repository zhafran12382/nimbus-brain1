"use client";

import { ChatMessage as ChatMessageType } from "@/types";
import { ActionBadge } from "./action-badge";
import Markdown from "react-markdown";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const timestamp = new Date(message.created_at).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Action badges for assistant messages */}
        {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.tool_calls.map((tc, i) => (
              <ActionBadge key={i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown>{message.content}</Markdown>
            </div>
          )}
        </div>

        {/* Timestamp & model info */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-zinc-600">{timestamp}</span>
          {!isUser && message.model_used && (
            <span className="text-[10px] text-zinc-700">{message.model_used}</span>
          )}
        </div>
      </div>
    </div>
  );
}
