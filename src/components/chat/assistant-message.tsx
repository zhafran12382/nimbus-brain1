"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseAssistantContent } from "@/lib/assistant-response";
import { Copy, Download, Lock, RefreshCw } from "lucide-react";
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
    get_information: { icon: "📚", startText: "Retrieving sources...", resultText: "Sources loaded" },
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
    run_python: { icon: "🐍", startText: "Running calculation...", resultText: "Calculation complete" },
  };
  const config = map[name] || { icon: "⚡", startText: `Executing ${name}...`, resultText: `${name} complete` };
  return {
    icon: config.icon,
    text: phase === "start" ? config.startText : config.resultText,
  };
}

export { getToolDisplay };

// Get pipeline label and icon for a tool
function getPipelineStep(name: string): { label: string; icon: string } {
  const steps: Record<string, { label: string; icon: string }> = {
    __thinking: { label: "Thinking", icon: "💭" },
    web_search: { label: "Search", icon: "🔍" },
    get_information: { label: "Reading sources", icon: "📖" },
    create_target: { label: "Creating target", icon: "🎯" },
    create_expense: { label: "Recording expense", icon: "💸" },
    get_targets: { label: "Fetching data", icon: "📊" },
    get_target_summary: { label: "Analyzing", icon: "📊" },
    get_expenses: { label: "Fetching data", icon: "📊" },
    get_expense_summary: { label: "Analyzing", icon: "📊" },
    update_target_progress: { label: "Updating", icon: "🔄" },
    delete_target: { label: "Deleting", icon: "🗑️" },
    delete_expense: { label: "Deleting", icon: "🗑️" },
    save_memory: { label: "Remembering", icon: "🧠" },
    get_memories: { label: "Recalling", icon: "🧠" },
    delete_memory: { label: "Forgetting", icon: "🧠" },
    create_quiz: { label: "Generating quiz", icon: "📝" },
    get_quiz_history: { label: "Fetching history", icon: "📚" },
    get_quiz_stats: { label: "Analyzing stats", icon: "📊" },
    run_python: { label: "Calculating", icon: "🧮" },
    __generating: { label: "Generating response", icon: "✨" },
  };
  return steps[name] || { label: name, icon: "⚡" };
}

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

// ---------------------------------------------------------------------------
// ReasoningPipeline — modern vertical activity-log style
// ---------------------------------------------------------------------------
interface PipelineNode {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  completed: boolean;
}

function ReasoningPipeline({ nodes }: { nodes: PipelineNode[] }) {
  return (
    <div
      className="flex flex-col pl-3 mb-4"
      style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
    >
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.06 }}
            className="flex items-center gap-2"
            style={{
              paddingTop: i === 0 ? 0 : 10,
              paddingBottom: isLast ? 0 : 2,
            }}
          >
            {/* Small icon */}
            <span className="text-[12px] leading-none shrink-0">{node.icon}</span>

            {/* Label */}
            <span
              className="text-[13px] leading-tight"
              style={{
                opacity: node.active ? 0.9 : node.completed ? 0.5 : 0.35,
                color: node.active ? "hsl(0 0% 88%)" : "hsl(0 0% 62%)",
              }}
            >
              {node.label}
            </span>

            {/* Spinner for active node */}
            {node.active && (
              <div
                className="spinner-perplexity shrink-0"
                style={{ width: 10, height: 10 }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AssistantMessage({ state }: AssistantMessageProps) {
  const { phase, toolStatus, toolHistory, content, modelUsed, completedAt, thinkingDurationMs, thinkingContent: apiThinkingContent } = state;
  const [showMetadata, setShowMetadata] = useState(false);

  // Show metadata with delay after completion
  useEffect(() => {
    if (phase === "complete") {
      const timer = setTimeout(() => setShowMetadata(true), 300);
      return () => clearTimeout(timer);
    }
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

  // Build pipeline nodes
  const pipelineNodes: PipelineNode[] = [];
  
  // Deduplicate tool labels and build flow
  const seenLabels = new Set<string>();
  for (const tool of toolHistory) {
    if (tool.name === "__thinking") continue;
    const step = getPipelineStep(tool.name);
    if (seenLabels.has(step.label)) continue;
    seenLabels.add(step.label);
    
    const allDone = toolHistory
      .filter(t => getPipelineStep(t.name).label === step.label)
      .every(t => !!t.result);
    const isActive = !allDone && phase === "tool_executing";
    
    pipelineNodes.push({ id: tool.name, label: step.label, icon: step.icon, completed: allDone, active: isActive });
  }

  // Add active tool if not yet in history
  if (phase === "tool_executing" && toolStatus && !toolHistory.find(t => t.name === toolStatus.name && !t.result)) {
    const step = getPipelineStep(toolStatus.name);
    if (!seenLabels.has(step.label)) {
      pipelineNodes.push({ id: toolStatus.name, label: step.label, icon: step.icon, completed: false, active: true });
    }
  }

  // Append "Generating response" when streaming starts (after tool calls)
  const hasToolActivity = toolHistory.filter(t => t.name !== "__thinking").length > 0;
  if (hasToolActivity) {
    const genStep = getPipelineStep("__generating");
    pipelineNodes.push({
      id: "generating",
      label: genStep.label,
      icon: genStep.icon,
      completed: phase === "complete",
      active: phase === "streaming",
    });
  }

  // Show pipeline during thinking (with a single "Thinking" node), tool_executing, or streaming
  const showThinkingOnly = phase === "thinking" && pipelineNodes.length === 0;
  if (showThinkingOnly) {
    const thinkStep = getPipelineStep("__thinking");
    pipelineNodes.push({ id: "thinking", label: thinkStep.label, icon: thinkStep.icon, completed: false, active: true });
  }

  const isContentVisible = phase === "streaming" || phase === "complete";
  const showPipeline = pipelineNodes.length > 0 && phase !== "complete";

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
          {/* Reasoning Pipeline — clean vertical activity log */}
          {showPipeline && (
            <ReasoningPipeline nodes={pipelineNodes} />
          )}

          {/* Source Pills (web search) */}
          {uniqueSources.length > 0 && (phase === "tool_executing" || phase === "streaming" || phase === "complete") && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.08 } },
              }}
              className="flex flex-wrap gap-1.5 mb-3"
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
          {toolPreview && (phase === "tool_executing" || phase === "streaming") && (
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
            <div className="mt-3">
              <ThinkingBlock content={combinedThinking} durationMs={combinedThinkingDurationMs} />
            </div>
          )}

          {/* Response Content */}
          {isContentVisible && displayContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="chat-markdown prose prose-invert prose-base max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            >
              <Markdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{displayContent}</Markdown>
              {phase === "streaming" && (
                <span className="streaming-cursor" />
              )}
            </motion.div>
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
