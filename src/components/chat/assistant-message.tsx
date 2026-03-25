"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseAssistantContent } from "@/lib/assistant-response";
import { CheckCircle2, Circle, Copy, Download, Lock, RefreshCw } from "lucide-react";
import { SourcesFooter } from "./sources-footer";
import { ThinkingBlock } from "./thinking-block";
import { chatMarkdownComponents } from "./markdown-components";

// Phase state machine
export type AssistantPhase = "thinking" | "tool_executing" | "streaming" | "complete";

export interface ToolStatus {
  name: string;
  icon: string;
  text: string;
  result?: string;
  args?: Record<string, unknown>;
}

export interface AssistantMessageState {
  phase: AssistantPhase;
  toolStatus: ToolStatus | null;
  toolHistory: ToolStatus[];
  content: string;
  modelUsed: string;
  completedAt?: string;
  thinkingContent?: string;
  thinkingDurationMs?: number;
}

interface AssistantMessageProps {
  state: AssistantMessageState;
}

const PIPELINE_STEPS = [
  { label: "Search" },
  { label: "Tool call" },
  { label: "Generate response" },
  { label: "Final answer" },
];

// Map tool names to icons and status text
function getToolDisplay(name: string, phase: "start" | "result"): { icon: string; text: string } {
  const map: Record<string, { icon: string; startText: string; resultText: string }> = {
    web_search: { icon: "🔍", startText: "Searching the web...", resultText: "Search complete" },
    create_target: { icon: "✅", startText: "Creating target...", resultText: "Target created" },
    create_expense: { icon: "✅", startText: "Recording expense...", resultText: "Expense recorded" },
    get_targets: { icon: "📊", startText: "Fetching targets...", resultText: "Data loaded" },
    get_target_summary: { icon: "📊", startText: "Analyzing targets...", resultText: "Analysis complete" },
    get_expenses: { icon: "📊", startText: "Fetching expenses...", resultText: "Data loaded" },
    get_expense_summary: { icon: "📊", startText: "Analyzing finances...", resultText: "Analysis complete" },
    update_target_progress: { icon: "🔧", startText: "Updating target...", resultText: "Target updated" },
    delete_target: { icon: "🗑️", startText: "Deleting target...", resultText: "Target deleted" },
    delete_expense: { icon: "🗑️", startText: "Deleting expense...", resultText: "Expense deleted" },
    save_memory: { icon: "🧠", startText: "Remembering...", resultText: "Remembered" },
    get_memories: { icon: "🧠", startText: "Recalling memories...", resultText: "Memories loaded" },
    delete_memory: { icon: "🧠", startText: "Forgetting...", resultText: "Memory deleted" },
    create_quiz: { icon: "📝", startText: "Generating quiz...", resultText: "Quiz ready!" },
    get_quiz_history: { icon: "📚", startText: "Fetching quiz history...", resultText: "History loaded" },
    get_quiz_stats: { icon: "📊", startText: "Analyzing study stats...", resultText: "Stats loaded" },
  };
  const config = map[name] || { icon: "⚡", startText: `Executing ${name}...`, resultText: `${name} complete` };
  return {
    icon: config.icon,
    text: phase === "start" ? config.startText : config.resultText,
  };
}

export { getToolDisplay };

// Extract web search source URLs from tool result text
function extractSources(result: string): { title: string; url: string; domain: string }[] {
  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  const urls = result.match(urlRegex) || [];
  const seen = new Set<string>();
  return urls
    .map((url) => {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        if (seen.has(domain)) return null;
        seen.add(domain);
        return { title: domain, url, domain };
      } catch {
        return null;
      }
    })
    .filter((s): s is { title: string; url: string; domain: string } => s !== null)
    .slice(0, 5);
}

// Extract tool preview info for non-search tools
function getToolPreview(tool: ToolStatus): { emoji: string; title: string; detail: string } | null {
  if (!tool.result) return null;
  const name = tool.name;
  if (name === "create_expense") {
    return {
      emoji: "💰",
      title: tool.args?.title as string || "Expense",
      detail: tool.args?.amount ? `Rp ${Number(tool.args.amount).toLocaleString("id-ID")}` : "",
    };
  }
  if (name === "create_target") {
    return {
      emoji: "🎯",
      title: tool.args?.title as string || "Target",
      detail: tool.args?.target_value ? `${tool.args.target_value} ${tool.args.unit || ""}` : "",
    };
  }
  if (name === "update_target_progress") {
    return {
      emoji: "📈",
      title: tool.args?.title as string || "Target",
      detail: tool.args?.new_value ? `Progress: ${tool.args.new_value}` : "",
    };
  }
  if (name === "delete_target" || name === "delete_expense") {
    return {
      emoji: "🗑️",
      title: "Deleted",
      detail: tool.result.includes("✅") ? "Success" : tool.result.slice(0, 40),
    };
  }
  // Memory tools are handled separately (MemoryCard)
  return null;
}

// Memory save animation card
function MemoryCard({ tool, isStreaming }: { tool: ToolStatus; isStreaming: boolean }) {
  const [compact, setCompact] = useState(false);
  const memoryContent = tool.result?.replace("🧠 Diingat: ", "") || tool.args?.content as string || "";

  useEffect(() => {
    if (!isStreaming && tool.result) {
      const timer = setTimeout(() => setCompact(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, tool.result]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      className="my-2 rounded-xl border border-[hsl(270_60%_50%_/_0.2)] bg-gradient-to-r from-[hsl(270_60%_50%_/_0.1)] to-[hsl(217_91%_60%_/_0.1)] px-3 py-2"
    >
      <AnimatePresence mode="wait">
        {compact ? (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_70%)]"
          >
            <span>🧠</span>
            <span className="truncate">{memoryContent}</span>
          </motion.div>
        ) : (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <motion.span
              animate={{
                scale: [1, 1.15, 1],
                opacity: [1, 0.8, 1],
              }}
              transition={{ duration: 1.5, repeat: isStreaming ? Infinity : 1 }}
              className="text-sm"
            >
              🧠
            </motion.span>
            <span className="text-[13px] text-[hsl(0_0%_70%)]">
              {isStreaming ? "Remembering..." : `Remembered: ${memoryContent}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AssistantMessage({ state }: AssistantMessageProps) {
  const { phase, toolStatus, toolHistory, content, modelUsed, completedAt, thinkingDurationMs, thinkingContent: apiThinkingContent } = state;
  const [showMetadata, setShowMetadata] = useState(false);

  // Show metadata with delay after completion
  useEffect(() => {
    if (phase === "complete") {
      const timer = setTimeout(() => setShowMetadata(true), 300);
      return () => clearTimeout(timer);
    }
    // Reset when phase changes away from complete
    const resetTimer = setTimeout(() => setShowMetadata(false), 0);
    return () => clearTimeout(resetTimer);
  }, [phase]);

  // Gather web search sources from tool history
  const webSearchTool = toolHistory.find((t) => t.name === "web_search" && t.result);
  const sources = webSearchTool?.result ? extractSources(webSearchTool.result) : [];

  // Non-search tool preview (exclude memory tools)
  const previewTool = toolHistory.find(
    (t) => t.result && t.name !== "web_search" && !t.name.startsWith("get_") && !t.name.includes("memory")
  );
  const toolPreview = previewTool ? getToolPreview(previewTool) : null;

  // Memory tool cards
  const memoryTools = toolHistory.filter(t => t.name === "save_memory");
  const isMemoryStreaming = phase === "tool_executing" && toolStatus?.name === "save_memory" && !toolStatus.result;

  // Parse custom mode blocks (thinking and sources) from text content
  const parsedContent = parseAssistantContent(content);
  const displayContent = parsedContent.text;
  const combinedThinking = apiThinkingContent || parsedContent.thinking;
  const combinedThinkingDurationMs = thinkingDurationMs ?? parsedContent.thinkingDurationMs ?? undefined;
  const displaySources = [...sources, ...parsedContent.sources];
  
  // Deduplicate sources by domain
  const uniqueSources = displaySources.filter((source, index, self) => 
    index === self.findIndex((s) => s.domain === source.domain)
  ).slice(0, 5);

  const isStatusVisible =
    phase === "thinking" ||
    phase === "tool_executing" ||
    phase === "streaming" ||
    phase === "complete";
  const isContentVisible = phase === "streaming" || phase === "complete";
  const activeStepIndex = (() => {
    switch (phase) {
      case "thinking":
        return 0;
      case "tool_executing":
        return 1;
      case "streaming":
        return 2;
      case "complete":
        return 3;
      default:
        return -1;
    }
  })();

  const timestamp = completedAt
    ? new Date(completedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex items-start gap-2.5"
    >
      {/* Avatar */}
      <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-[11px] font-bold text-white mt-1">
        N
      </div>

      {/* Response container */}
      <div className="w-full max-w-[82%] space-y-1 flex flex-col items-start min-w-0">
        <div className="w-full min-w-[120px] px-3.5 py-3">
          {/* Status Area (vertical pipeline) */}
          <AnimatePresence mode="wait">
            {isStatusVisible && (
              <motion.div
                key="status-area"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="border-l border-white/[0.08] pl-3">
                  <div className="flex flex-col items-start space-y-3 text-[13px] leading-5">
                    {PIPELINE_STEPS.map((step, index) => {
                      const isCompleted = index < activeStepIndex;
                      const isActive = index === activeStepIndex;
                      const circleClass = isActive ? "h-3.5 w-3.5 shrink-0 text-[hsl(217_91%_60%)]" : "h-3.5 w-3.5 shrink-0 text-white/35";
                      const labelClass = isActive
                        ? "opacity-80 text-[hsl(0_0%_80%)]"
                        : "opacity-70 text-[hsl(0_0%_65%)]";
                      return (
                        <div key={step.label} className="flex items-center gap-2.5 text-left">
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(217_91%_60%)]" />
                          ) : (
                            <Circle className={circleClass} />
                          )}
                          <span className={labelClass}>
                            {step.label}
                          </span>
                          {isActive && phase === "tool_executing" && toolStatus && (
                            <span className="text-[12px] opacity-70 text-[hsl(0_0%_60%)]">
                              {toolStatus.icon} {toolStatus.text}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Source Pills (web search) */}
                {uniqueSources.length > 0 && (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: 0.08 } },
                    }}
                    className="flex flex-wrap gap-1.5 mt-2"
                  >
                    {uniqueSources.map((source) => (
                      <motion.a
                        key={source.domain}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variants={{
                          hidden: { opacity: 0, x: -8 },
                          show: { opacity: 1, x: 0 },
                        }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-1 rounded-full bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_100%_/_0.06)] px-2.5 py-1 text-[11px] text-[hsl(0_0%_45%)] hover:text-[hsl(217_91%_60%)] hover:border-[hsl(217_91%_60%_/_0.2)] transition-colors"
                      >
                        <span className="w-3 h-3 rounded-full bg-[hsl(0_0%_20%)] flex items-center justify-center text-[7px]">
                          ○
                        </span>
                        {source.domain}
                      </motion.a>
                    ))}
                  </motion.div>
                )}

                {/* Tool Preview Card (create/update/delete results) */}
                {toolPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 rounded-lg bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_100%_/_0.06)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{toolPreview.emoji}</span>
                      <div>
                        <p className="text-[12px] font-medium text-[hsl(0_0%_93%)]">
                          {toolPreview.title}
                        </p>
                        {toolPreview.detail && (
                          <p className="text-[11px] text-[hsl(0_0%_45%)]">{toolPreview.detail}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Memory Save Cards */}
          {memoryTools.map((tool, i) => (
            <MemoryCard key={`memory-${i}`} tool={tool} isStreaming={false} />
          ))}
          {isMemoryStreaming && toolStatus && (
            <MemoryCard tool={toolStatus} isStreaming={true} />
          )}

          {/* Thinking Block (shown above answer) */}
          {combinedThinking && (
            <div className="mt-3">
              <ThinkingBlock content={combinedThinking} durationMs={combinedThinkingDurationMs} />
            </div>
          )}

          {/* Response Content (phases 4-5) */}
          {isContentVisible && displayContent && (
            <div className="chat-markdown prose prose-invert prose-base max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{displayContent}</Markdown>
              {phase === "streaming" && (
                <span className="streaming-cursor" />
              )}
            </div>
          )}

          {/* Source references placed directly under answer content */}
          {phase === "complete" && uniqueSources.length > 0 && (
            <div className="mt-3">
              <SourcesFooter sources={uniqueSources} />
            </div>
          )}

          {/* Metadata/footer */}
          {phase === "complete" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-4 pt-4 border-t border-[hsl(0_0%_100%_/_0.06)] flex flex-col gap-3"
            >
              <div className="text-[12px] font-medium text-[hsl(0_0%_60%)]">
                Prepared using {modelUsed}
              </div>
              <div className="flex items-center gap-3 text-[hsl(0_0%_50%)]">
                <button className="hover:text-[hsl(0_0%_80%)] transition-colors">
                  <Lock className="w-4 h-4" />
                </button>
                <button className="hover:text-[hsl(0_0%_80%)] transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button className="hover:text-[hsl(0_0%_80%)] transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
                <button className="hover:text-[hsl(0_0%_80%)] transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Metadata (timestamp + model) */}
        <AnimatePresence>
          {showMetadata && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 px-1"
            >
              {timestamp && (
                <span className="text-[12px] text-[#8A8A8A]">{timestamp}</span>
              )}
              {modelUsed && (
                <span className="hidden sm:inline text-[12px] text-[#8A8A8A]">
                  {modelUsed}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
