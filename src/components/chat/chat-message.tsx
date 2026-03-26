"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ChatMessage as ChatMessageType } from "@/types";
import { messageBubble } from "@/lib/animations";
import { QUIZ_DATA_REGEX } from "@/lib/constants";
import { QuizCard } from "./quiz-card";
import Markdown from "react-markdown";
import { parseAssistantContent } from "@/lib/assistant-response";
import { ThinkingBlock } from "./thinking-block";
import { SourcesFooter } from "./sources-footer";
import { chatMarkdownComponents, chatRemarkPlugins, chatRehypePlugins } from "./markdown-components";
import { PipelineTimeline } from "./pipeline-timeline";
import type { PipelineStep } from "./pipeline-timeline";

// Minimal terminal icon for code execution (monochrome SVG, matches pipeline design)
const TerminalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
    <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none" />
    <path d="M4.5 6L7 8.5L4.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="9" y1="11" x2="11.5" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/**
 * Robustly extract code, output, and error from run_python result string.
 * The tool-executor produces: Code:\n```python\n{code}\n```\n\nOutput:\n```\n{stdout}\n```
 */
function parsePythonResult(code: string, resultText: string): { code: string; output?: string; error?: string } {
  // Extract code from args first; fallback: extract from result text
  let finalCode = code;
  if (!finalCode) {
    const codeFromResult = resultText.match(/Code:\n```python\n([\s\S]*?)\n```/);
    finalCode = codeFromResult?.[1] || "";
  }

  // Extract stdout: try multiple patterns
  // Pattern 1: Output:\n```\n{text}\n``` (standard fenced)
  const stdoutFenced = resultText.match(/Output:\n```\n([\s\S]*?)\n```/);
  // Pattern 2: Output:\n```\n``` (empty fenced — no content)
  const emptyFenced = /Output:\n```\n```/.test(resultText);
  // Pattern 3: simple text after Output:
  const stdoutPlain = resultText.match(/Output:\s*\n([^\n`][\s\S]*?)(?:\n\n|$)/);

  // Error patterns
  const stderrFenced = resultText.match(/(?:Python Error|Warnings|Stderr):\n```\n([\s\S]*?)\n```/);
  const isRawError = resultText.startsWith("Error") || resultText.startsWith("❌");

  let output: string | undefined;

  if (stdoutFenced && !emptyFenced) {
    output = stdoutFenced[1]?.trim() || undefined;
  } else if (stdoutPlain) {
    output = stdoutPlain[1]?.trim() || undefined;
  }

  // Fallback: strip known blocks and use whatever remains
  if (!output && !emptyFenced && !stderrFenced && !isRawError) {
    const stripped = resultText
      .replace(/Code:\n```python\n[\s\S]*?\n```\n*/g, '')
      .replace(/Output:\n```\n*```/g, '')
      .replace(/^\s*$/gm, '')
      .trim();
    if (stripped && stripped !== '(empty)') output = stripped;
  }

  if (output === '') output = undefined;

  const error = stderrFenced?.[1]?.trim() || (isRawError ? resultText : undefined);
  return { code: finalCode, output, error };
}

// Collapsible Python output card for history
function PythonCardHistory({ py }: { py: { code: string; output?: string; error?: string } }) {
  const [expanded, setExpanded] = useState(true);
  const hasBody = !!(py.code || py.output || py.error);

  return (
    <div className="rounded-xl border border-[hsl(0_0%_100%_/_0.06)] bg-[hsl(0_0%_5%)] overflow-hidden">
      <button
        onClick={() => hasBody && setExpanded(prev => !prev)}
        className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(0_0%_100%_/_0.06)] bg-[hsl(0_0%_8%)] hover:bg-[hsl(0_0%_10%)] transition-colors"
      >
        <span className="text-[hsl(0_0%_50%)]"><TerminalIcon /></span>
        <span className="text-[11px] font-medium text-[hsl(0_0%_50%)] flex-1 text-left">Python</span>
        {py.output && <span className="text-[10px] text-green-400/60 font-medium">OUTPUT</span>}
        {py.error && <span className="text-[10px] text-red-400/60 font-medium">ERROR</span>}
        {hasBody && (
          <ChevronDown className={`w-3 h-3 text-[hsl(0_0%_40%)] transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && hasBody && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {py.code && (
              <pre className="text-[11px] font-mono text-[hsl(0_0%_65%)] p-3 overflow-x-auto leading-relaxed">
                <code>{py.code}</code>
              </pre>
            )}
            {py.output && (
              <div className="border-t border-[hsl(0_0%_100%_/_0.06)] px-3 py-2 bg-[hsl(140_50%_5%)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-green-400/70 font-medium uppercase tracking-wider">Output</span>
                </div>
                <pre className="text-[12px] font-mono text-green-300/90 whitespace-pre-wrap leading-relaxed">{py.output}</pre>
              </div>
            )}
            {py.error && (
              <div className="border-t border-[hsl(0_0%_100%_/_0.06)] px-3 py-2 bg-[hsl(0_50%_5%)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-red-400/70 font-medium uppercase tracking-wider">Error</span>
                </div>
                <pre className="text-[12px] font-mono text-red-300/90 whitespace-pre-wrap leading-relaxed">{py.error}</pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  run_python: { icon: "terminal", label: "Python executed" },
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

  // Group tool calls for pipeline display
  const toolCalls = message.tool_calls || [];
  const searchToolCalls = toolCalls.filter(tc => tc.name === "web_search");
  const nonSearchToolCalls = toolCalls.filter(tc => tc.name !== "web_search");
  const searchQueries = searchToolCalls
    .map(tc => {
      try { return typeof tc.args === 'string' ? JSON.parse(tc.args)?.query : tc.args?.query; }
      catch { return null; }
    })
    .filter(Boolean) as string[];

  // Extract source domains from search results for favicon display
  const searchSourceDomains: { domain: string; url: string }[] = [];
  const seenDomains = new Set<string>();
  for (const tc of searchToolCalls) {
    const result = tc.result || "";
    const urls = result.match(/https?:\/\/[^\s)>\]]+/g) || [];
    for (const url of urls) {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        if (!seenDomains.has(domain)) {
          seenDomains.add(domain);
          searchSourceDomains.push({ domain, url });
        }
      } catch { /* skip invalid urls */ }
    }
  }

  // Python execution results for prominent display
  const pythonToolCalls = toolCalls.filter(tc => tc.name === "run_python");
  const pythonResults = pythonToolCalls.map(tc => {
    const code = typeof tc.args === "string" ? "" : (tc.args?.code as string) || "";
    const resultText = tc.result || "";
    return parsePythonResult(code, resultText);
  });

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
        {/* Grouped pipeline for tool calls (history messages) */}
        {!isUser && toolCalls.length > 0 && (
          <div className="mb-1 ml-3.5 w-full">
            <PipelineTimeline
              steps={(() => {
                const pSteps: PipelineStep[] = [];

                if (searchToolCalls.length > 0) {
                  pSteps.push({
                    id: "search-group",
                    type: "search",
                    icon: <span>{"🔍"}</span>,
                    label: `Searched ${searchToolCalls.length} source${searchToolCalls.length > 1 ? "s" : ""}`,
                    status: "done",
                  });
                }

                for (const tc of nonSearchToolCalls) {
                  const config = toolDisplayMap[tc.name] || { icon: "\u26A1", label: tc.name.replace(/_/g, " ") };
                  pSteps.push({
                    id: `tool-${tc.name}-${pSteps.length}`,
                    type: "tool",
                    icon: config.icon === "terminal" ? <TerminalIcon /> : <span>{config.icon}</span>,
                    label: config.label,
                    status: "done",
                  });
                }

                return pSteps;
              })()}
              sources={searchSourceDomains}
              searchQueries={searchQueries}
              isCurrentlySearching={false}
              totalSearchSteps={searchToolCalls.length}
              isCollapsible={true}
              defaultExpanded={false}
            />
          </div>
        )}

        {/* Python Runtime Output (history — collapsible) */}
        {!isUser && pythonResults.length > 0 && (
          <div className="mb-2 ml-3.5 w-full space-y-2">
            {pythonResults.map((py, i) => (
              <PythonCardHistory key={`python-hist-${i}`} py={py} />
            ))}
          </div>
        )}

        {/* Quiz Card or Message bubble */}
        {quizParsed ? (
          <div className="w-full max-w-md">
            <QuizCard quizData={quizParsed.quizData as { id: string; topic: string; difficulty: "easy" | "medium" | "hard"; total_questions: number; questions: { id: number; question: string; options: string[] }[] }} />
            {quizParsed.remainingContent && (
              <div className="mt-2 px-3.5 py-3 text-base leading-[1.65] tracking-[0.01em] text-[#ECECEC]">
                <div className="chat-markdown prose prose-invert prose-base max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown remarkPlugins={chatRemarkPlugins} rehypePlugins={chatRehypePlugins} components={chatMarkdownComponents}>{quizParsed.remainingContent}</Markdown>
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
                  <Markdown remarkPlugins={chatRemarkPlugins} rehypePlugins={chatRehypePlugins} components={chatMarkdownComponents}>{assistantText}</Markdown>
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
