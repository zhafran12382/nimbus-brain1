"use client";

import { motion } from "framer-motion";
import { ChatMessage as ChatMessageType } from "@/types";
import { messageBubble } from "@/lib/animations";
import { QUIZ_DATA_REGEX } from "@/lib/constants";
import { QuizCard } from "./quiz-card";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseAssistantContent } from "@/lib/assistant-response";
import { ThinkingBlock } from "./thinking-block";
import { SourcesFooter } from "./sources-footer";
import { chatMarkdownComponents } from "./markdown-components";

interface ChatMessageProps {
  message: ChatMessageType;
}

// Compact tool display map for history pipeline
const toolDisplayMap: Record<string, { icon: string; label: string }> = {
  web_search: { icon: "🔍", label: "Search complete" },
  get_information: { icon: "📚", label: "Sources retrieved" },
  create_target: { icon: "🎯", label: "Target created" },
  update_target_progress: { icon: "📈", label: "Target updated" },
  delete_target: { icon: "🗑️", label: "Target deleted" },
  get_targets: { icon: "📋", label: "Targets loaded" },
  get_target_summary: { icon: "📊", label: "Summary loaded" },
  create_expense: { icon: "💰", label: "Expense recorded" },
  get_expenses: { icon: "📋", label: "Expenses loaded" },
  get_expense_summary: { icon: "📊", label: "Expense summary" },
  delete_expense: { icon: "🗑️", label: "Expense deleted" },
  create_income: { icon: "💰", label: "Income recorded" },
  get_incomes: { icon: "📋", label: "Income loaded" },
  get_income_summary: { icon: "📊", label: "Income summary" },
  delete_income: { icon: "🗑️", label: "Income deleted" },
  get_financial_summary: { icon: "📊", label: "Financial summary" },
  save_memory: { icon: "🧠", label: "Remembered" },
  get_memories: { icon: "🧠", label: "Memories loaded" },
  delete_memory: { icon: "🧠", label: "Memory deleted" },
  create_quiz: { icon: "📝", label: "Quiz generated" },
  get_quiz_history: { icon: "📚", label: "Quiz history loaded" },
  get_quiz_stats: { icon: "📊", label: "Stats loaded" },
};

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

      <div className={`w-full max-w-[82%] min-w-0 space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Vertical pipeline for tool calls (history messages) */}
        {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="flex flex-col border-l border-[rgba(255,255,255,0.08)] pl-3 gap-[10px] mb-1 ml-3.5">
            {message.tool_calls.map((tc, i) => {
              const config = toolDisplayMap[tc.name] || { icon: "\u26A1", label: tc.name.replace(/_/g, " ") };
              return (
                <div key={i} className="flex items-center gap-2 text-[13px] text-[hsl(0_0%_55%)]" style={{ opacity: 0.65 }}>
                  <span className="text-xs leading-none w-3.5 text-center">{config.icon}</span>
                  <span>{config.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Quiz Card or Message bubble */}
        {quizParsed ? (
          <div className="w-full max-w-md">
            <QuizCard quizData={quizParsed.quizData as { id: string; topic: string; difficulty: "easy" | "medium" | "hard"; total_questions: number; questions: { id: number; question: string; options: string[] }[] }} />
            {quizParsed.remainingContent && (
              <div className="mt-2 px-3.5 py-3 text-base leading-[1.65] tracking-[0.01em] text-[#ECECEC]">
                <div className="chat-markdown prose prose-invert prose-base max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{quizParsed.remainingContent}</Markdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={isUser
              ? "rounded-2xl rounded-br-sm bg-[rgba(255,255,255,0.06)] px-3.5 py-3 text-base leading-[1.65] tracking-[0.01em] text-[#ECECEC]"
              : "px-3.5 py-3 text-base leading-[1.65] tracking-[0.01em] text-[#ECECEC]"
            }
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
                <div className="chat-markdown prose prose-invert prose-base max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{assistantText}</Markdown>
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
          <span className="text-[12px] text-[#8A8A8A]">{timestamp}</span>
          {!isUser && message.model_used && (
            <span className="hidden sm:inline text-[12px] text-[#8A8A8A]">
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
