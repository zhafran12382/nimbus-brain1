"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseAssistantContent } from "@/lib/assistant-response";
import { Copy, Download, Lock, RefreshCw, ChevronDown, Globe, Search } from "lucide-react";
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
  const [pipelineExpanded, setPipelineExpanded] = useState(true);

  // Show metadata with delay after completion
  useEffect(() => {
    if (phase === "complete") {
      const timer = setTimeout(() => setShowMetadata(true), 300);
      return () => clearTimeout(timer);
    }
    const resetTimer = setTimeout(() => setShowMetadata(false), 0);
    return () => clearTimeout(resetTimer);
  }, [phase]);

  // Auto-collapse pipeline when streaming starts
  useEffect(() => {
    if (phase === "streaming" || phase === "complete") {
      setPipelineExpanded(false);
    }
  }, [phase]);

  // Gather web search sources from ALL search tool history entries
  const allSearchSources = toolHistory
    .filter((t) => t.name === "web_search" && t.result)
    .flatMap((t) => extractSources(t.result!));

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
  const displaySources = [...allSearchSources, ...parsedContent.sources];
  
  // Deduplicate sources by domain
  const uniqueSources = displaySources.filter((source, index, self) => 
    index === self.findIndex((s) => s.domain === source.domain)
  ).slice(0, 6);

  const isContentVisible = phase === "streaming" || phase === "complete";

  const timestamp = completedAt
    ? new Date(completedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Group search tools vs non-search tools
  const searchTools = toolHistory.filter(t => t.name === "web_search");
  const nonSearchTools = toolHistory.filter(t => t.name !== "web_search" && t.name !== "save_memory");
  const searchQueries = searchTools.map(t => t.args?.query as string).filter(Boolean);
  const isCurrentlySearching = phase === "tool_executing" && toolStatus?.name === "web_search";
  const currentSearchQuery = isCurrentlySearching ? (toolStatus?.args?.query as string) : null;
  const totalSearchSteps = searchTools.length + (isCurrentlySearching ? 1 : 0);

  // Non-search pipeline steps
  const nonSearchSteps: { icon: string; text: string; done: boolean }[] = [];
  for (const tool of nonSearchTools) {
    const display = getToolDisplay(tool.name, "result");
    nonSearchSteps.push({ icon: display.icon, text: display.text, done: true });
  }
  if (phase === "tool_executing" && toolStatus && toolStatus.name !== "web_search" && toolStatus.name !== "save_memory") {
    nonSearchSteps.push({ icon: toolStatus.icon, text: toolStatus.text, done: false });
  }

  // Active thinking step (if no tools yet dispatched)
  const showThinkingStep = phase === "thinking" && searchTools.length === 0 && nonSearchSteps.length === 0;
  const hasSearchGroup = totalSearchSteps > 0;
  const showPipeline = hasSearchGroup || nonSearchSteps.length > 0 || showThinkingStep;

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

          {/* === Perplexity-style Grouped Pipeline === */}
          <AnimatePresence>
            {showPipeline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-3 flex flex-col gap-2"
              >
                {/* Thinking step (only if no tools) */}
                {showThinkingStep && (
                  <motion.div
                    key="pipeline-thinking"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2 text-[13px] text-[hsl(0_0%_55%)]"
                  >
                    <div className="spinner-perplexity !w-3.5 !h-3.5" />
                    <span>Thinking...</span>
                  </motion.div>
                )}

                {/* Search group block */}
                {hasSearchGroup && (
                  <motion.div
                    key="search-group"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)]"
                  >
                    {/* Collapsible header */}
                    <button
                      onClick={() => setPipelineExpanded(prev => !prev)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[hsl(0_0%_65%)] hover:text-[hsl(0_0%_80%)] transition-colors"
                    >
                      {isCurrentlySearching ? (
                        <div className="spinner-perplexity !w-3.5 !h-3.5 shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                      )}
                      <span className="flex-1 text-left">
                        {isCurrentlySearching
                          ? `Searching...`
                          : `Searched ${totalSearchSteps} source${totalSearchSteps > 1 ? 's' : ''}`
                        }
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${pipelineExpanded ? 'rotate-0' : '-rotate-90'}`}
                      />
                    </button>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {pipelineExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-2.5 flex flex-col gap-1.5">
                            {/* Search queries */}
                            {searchQueries.map((query, i) => (
                              <div key={`q-${i}`} className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_50%)]">
                                <Search className="w-3 h-3 shrink-0 opacity-50" />
                                <span className="truncate">&quot;{query}&quot;</span>
                              </div>
                            ))}
                            {currentSearchQuery && (
                              <div className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_50%)]">
                                <div className="spinner-perplexity !w-3 !h-3 shrink-0" />
                                <span className="truncate">&quot;{currentSearchQuery}&quot;</span>
                              </div>
                            )}

                            {/* Source favicons */}
                            {uniqueSources.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {uniqueSources.slice(0, 4).map((src, i) => (
                                  <a
                                    key={i}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 rounded-md bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[11px] text-[hsl(0_0%_55%)] hover:text-[hsl(0_0%_80%)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                                  >
                                    <img
                                      src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=16`}
                                      alt=""
                                      className="w-3 h-3 rounded-sm"
                                    />
                                    <span className="truncate max-w-[100px]">{src.domain}</span>
                                  </a>
                                ))}
                                {uniqueSources.length > 4 && (
                                  <span className="text-[11px] text-[hsl(0_0%_45%)] px-1">
                                    +{uniqueSources.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Non-search tool steps (rendered individually) */}
                {nonSearchSteps.map((step, i) => (
                  <motion.div
                    key={`ns-${i}-${step.text}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: i * 0.05 }}
                    className="flex items-center gap-2 text-[13px] text-[hsl(0_0%_55%)] pl-1"
                    style={{ opacity: step.done ? 0.65 : 0.85 }}
                  >
                    {step.done ? (
                      <span className="text-xs leading-none w-3.5 text-center">{step.icon}</span>
                    ) : (
                      <div className="spinner-perplexity !w-3.5 !h-3.5" />
                    )}
                    <span>{step.text}</span>
                  </motion.div>
                ))}

                {/* "Generating response" step while streaming */}
                {(phase === "streaming") && (
                  <motion.div
                    key="pipeline-generating"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2 text-[13px] text-[hsl(0_0%_55%)] opacity-75 pl-1"
                  >
                    <div className="spinner-perplexity !w-3.5 !h-3.5" />
                    <span>Generating response...</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tool Preview Card (create/update/delete results) */}
          {toolPreview && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-3 rounded-lg bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_100%_/_0.06)] px-3 py-2"
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

          {/* Memory Save Cards */}
          {memoryTools.map((tool, i) => (
            <MemoryCard key={`memory-${i}`} tool={tool} isStreaming={false} />
          ))}
          {isMemoryStreaming && toolStatus && (
            <MemoryCard tool={toolStatus} isStreaming={true} />
          )}

          {/* Thinking Block (shown above answer) */}
          {combinedThinking && (
            <div className="mb-3">
              <ThinkingBlock content={combinedThinking} durationMs={combinedThinkingDurationMs} />
            </div>
          )}

          {/* Response Content */}
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
