"use client";

import { motion } from "framer-motion";
import { ChatMessage as ChatMessageType } from "@/types";
import { ActionBadge } from "./action-badge";
import { messageBubble } from "@/lib/animations";
import { QUIZ_DATA_REGEX } from "@/lib/constants";
import { QuizCard } from "./quiz-card";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseAssistantContent } from "@/lib/assistant-response";
import { ThinkingBlock } from "./thinking-block";
import { SourcesFooter } from "./sources-footer";

interface ChatMessageProps {
  message: ChatMessageType;
}

// Parse QUIZ_DATA:: prefix from message content
function parseQuizData(content: string): { quizData: unknown; remainingContent: string } | null {
  const quizMatch = content.match(QUIZ_DATA_REGEX);
  if (quizMatch) {
    try {
      const quizData = JSON.parse(quizMatch[2]);
      const remainingContent = content.replace(QUIZ_DATA_REGEX, "").trim();
      return { quizData, remainingContent };
    } catch {
      return null;
    }
  }
  return null;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const parsedAssistant = !isUser ? parseAssistantContent(message.content) : null;
  const assistantText = !isUser ? (parsedAssistant?.text ?? "") : message.content;

  const timestamp = new Date(message.created_at).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Check if this is a quiz message
  const quizParsed = !isUser ? parseQuizData(assistantText) : null;

  return (
    <motion.div
      initial={messageBubble.initial}
      animate={messageBubble.animate}
      transition={messageBubble.transition}
      className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Assistant avatar — hidden on mobile */}
      {!isUser && (
        <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-[11px] font-bold text-white mt-1">
          N
        </div>
      )}

      <div className={`max-w-[75%] sm:max-w-[70%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Action badges for assistant messages */}
        {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-0.5">
            {message.tool_calls.map((tc, i) => (
              <ActionBadge key={i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Quiz Card or Message bubble */}
        {quizParsed ? (
          <div className="w-full max-w-md">
            <QuizCard quizData={quizParsed.quizData as { id: string; topic: string; difficulty: "easy" | "medium" | "hard"; total_questions: number; questions: { id: number; question: string; options: string[] }[] }} />
            {quizParsed.remainingContent && (
              <div className="text-[hsl(0_0%_93%)] px-4 py-2.5 text-sm leading-relaxed mt-2">
                <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown remarkPlugins={[remarkGfm]}>{quizParsed.remainingContent}</Markdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`text-sm leading-relaxed ${
              isUser
                ? "rounded-2xl px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-sm"
                : "text-[hsl(0_0%_93%)]"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : assistantText.startsWith('⚠️') ? (
              <p className="text-amber-400">{assistantText}</p>
            ) : (
              <>
                {parsedAssistant?.thinking && (
                  <div className="mb-3">
                    <ThinkingBlock
                      content={parsedAssistant.thinking}
                      durationMs={parsedAssistant.thinkingDurationMs ?? undefined}
                    />
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:bg-[hsl(0_0%_5%)] [&_pre]:rounded-lg [&_pre]:text-[13px] [&_pre]:p-3 [&_code]:text-[13px]">
                  <Markdown remarkPlugins={[remarkGfm]}>{assistantText}</Markdown>
                </div>
                {parsedAssistant?.sources && parsedAssistant.sources.length > 0 && (
                  <div className="mt-3">
                    <SourcesFooter sources={parsedAssistant.sources} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Timestamp & model info */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-[hsl(0_0%_93%_/_0.4)]">{timestamp}</span>
          {!isUser && message.model_used && (
            <span className="hidden sm:inline text-[10px] text-[hsl(0_0%_93%_/_0.3)]">
              {message.provider_used === 'openrouter' ? '🔵' : '🟢'} {message.model_used}
            </span>
          )}
        </div>
      </div>

      {/* User avatar — hidden on mobile */}
      {isUser && (
        <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(0_0%_12%)] text-[11px] font-medium text-[hsl(0_0%_50%)] mt-1">
          U
        </div>
      )}
    </motion.div>
  );
}
