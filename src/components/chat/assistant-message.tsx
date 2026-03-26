"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Markdown from "react-markdown";
import { parseAssistantContent } from "@/lib/assistant-response";
import { Copy, Download, Lock, RefreshCw } from "lucide-react";
import { SourcesFooter } from "./sources-footer";
import { ThinkingBlock } from "./thinking-block";
import { PipelineTimeline } from "./pipeline-timeline";
import type { PipelineStep } from "./pipeline-timeline";
import { chatMarkdownComponents, chatRemarkPlugins, chatRehypePlugins } from "./markdown-components";


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

// Random warm-up messages shown while the model is thinking
const WARMUP_MESSAGES = [
  "Spinning up the model",
  "Warming up the model",
  "Booting the model",
  "Firing up the model",
  "Bringing the model online",
];
function getRandomWarmup(): string {
  return WARMUP_MESSAGES[Math.floor(Math.random() * WARMUP_MESSAGES.length)];
}

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
  let finalCode = code;
  if (!finalCode) {
    const codeFromResult = resultText.match(/Code:\n```python\n([\s\S]*?)\n```/);
    finalCode = codeFromResult?.[1] || "";
  }

  const stdoutFenced = resultText.match(/Output:\n```\n([\s\S]*?)\n```/);
  const emptyFenced = /Output:\n```\n```/.test(resultText);
  const stdoutPlain = resultText.match(/Output:\s*\n([^\n`][\s\S]*?)(?:\n\n|$)/);
  const stderrFenced = resultText.match(/(?:Python Error|Warnings|Stderr):\n```\n([\s\S]*?)\n```/);
  const isRawError = resultText.startsWith("Error") || resultText.startsWith("❌");

  let output: string | undefined;
  if (stdoutFenced && !emptyFenced) {
    output = stdoutFenced[1]?.trim() || undefined;
  } else if (stdoutPlain) {
    output = stdoutPlain[1]?.trim() || undefined;
  }

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
    run_python: { icon: "terminal", startText: "Running Python code...", resultText: "Code executed" },
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

// Collapsible Python output card
function PythonCard({ py }: { py: { code: string; output?: string; error?: string } }) {
  const [expanded, setExpanded] = useState(true);
  const hasBody = !!(py.code || py.output || py.error);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-[hsl(0_0%_100%_/_0.06)] bg-[hsl(0_0%_5%)] overflow-hidden"
    >
      {/* Header — clickable to toggle */}
      <button
        onClick={() => hasBody && setExpanded(prev => !prev)}
        className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(0_0%_100%_/_0.06)] bg-[hsl(0_0%_8%)] hover:bg-[hsl(0_0%_10%)] transition-colors"
      >
        <span className="text-[hsl(0_0%_50%)]"><TerminalIcon /></span>
        <span className="text-[11px] font-medium text-[hsl(0_0%_50%)] flex-1 text-left">Python</span>
        {py.output && (
          <span className="text-[10px] text-green-400/60 font-medium">OUTPUT</span>
        )}
        {py.error && (
          <span className="text-[10px] text-red-400/60 font-medium">ERROR</span>
        )}
        {hasBody && (
          <ChevronDown className={`w-3 h-3 text-[hsl(0_0%_40%)] transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} />
        )}
      </button>

      {/* Collapsible body */}
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
                <pre className="text-[12px] font-mono text-green-300/90 whitespace-pre-wrap leading-relaxed">
                  {py.output}
                </pre>
              </div>
            )}
            {py.error && (
              <div className="border-t border-[hsl(0_0%_100%_/_0.06)] px-3 py-2 bg-[hsl(0_50%_5%)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-red-400/70 font-medium uppercase tracking-wider">Error</span>
                </div>
                <pre className="text-[12px] font-mono text-red-300/90 whitespace-pre-wrap leading-relaxed">
                  {py.error}
                </pre>
              </div>
            )}
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
  const [warmupLabel] = useState(() => getRandomWarmup());

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

  const hasSearchGroup = totalSearchSteps > 0;
  const showWarmupStep = phase === "thinking" || phase === "tool_executing" || phase === "streaming";
  const showPipeline = showWarmupStep || hasSearchGroup || nonSearchSteps.length > 0;

  // Collect Python execution results for prominent display
  const pythonResults = toolHistory
    .filter(t => t.name === "run_python" && t.result)
    .map(t => {
      const code = (t.args?.code as string) || "";
      const resultText = t.result || "";
      return parsePythonResult(code, resultText);
    });
  const activePython = phase === "tool_executing" && toolStatus?.name === "run_python";
  const activePythonCode = activePython ? (toolStatus?.args?.code as string) : null;

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

          {/* === Perplexity-style Pipeline Timeline === */}
          <AnimatePresence>
            {showPipeline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PipelineTimeline
                  headerLabel={warmupLabel}
                  headerIcon={<span className="text-blue-400">{"✦"}</span>}
                  headerActive={phase === "thinking" && nonSearchSteps.length === 0 && !hasSearchGroup}
                  steps={(() => {
                    const pSteps: PipelineStep[] = [];

                    if (hasSearchGroup) {
                      pSteps.push({
                        id: "search-group",
                        type: "search",
                        icon: <span>{"🔍"}</span>,
                        label: isCurrentlySearching
                          ? "Searching..."
                          : `Searched ${totalSearchSteps} source${totalSearchSteps > 1 ? "s" : ""}`,
                        status: isCurrentlySearching ? "active" : "done",
                      });
                    }

                    for (const step of nonSearchSteps) {
                      const isCodeExec = step.text.includes("Python") || step.text.includes("Code");
                      pSteps.push({
                        id: `tool-${step.text}`,
                        type: isCodeExec ? "code_execution" : "tool",
                        icon: step.icon === "terminal" ? <TerminalIcon /> : <span>{step.icon}</span>,
                        label: step.text,
                        status: step.done ? "done" : "active",
                      });
                    }

                    if (phase === "streaming") {
                      pSteps.push({
                        id: "generating",
                        type: "generating",
                        icon: <span>{"✨"}</span>,
                        label: "Generate response",
                        status: "active",
                      });
                    }

                    return pSteps;
                  })()}
                  sources={uniqueSources}
                  searchQueries={searchQueries}
                  currentSearchQuery={currentSearchQuery || undefined}
                  isCurrentlySearching={isCurrentlySearching}
                  totalSearchSteps={totalSearchSteps}
                  isCollapsible={true}
                  defaultExpanded={pipelineExpanded}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* === Python Runtime Output (collapsible) === */}
          {(pythonResults.length > 0 || activePythonCode) && (
            <div className="mb-3 space-y-2">
              {pythonResults.map((py, i) => (
                <PythonCard key={`python-${i}`} py={py} />
              ))}
              {activePythonCode && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-[hsl(0_0%_100%_/_0.06)] bg-[hsl(0_0%_5%)] overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(0_0%_100%_/_0.06)] bg-[hsl(0_0%_8%)]">
                    <div className="spinner-perplexity !w-3 !h-3 shrink-0" />
                    <span className="text-[11px] font-medium text-[hsl(0_0%_50%)]">Running Python...</span>
                  </div>
                  <pre className="text-[11px] font-mono text-[hsl(0_0%_65%)] p-3 overflow-x-auto leading-relaxed">
                    <code>{activePythonCode}</code>
                  </pre>
                </motion.div>
              )}
            </div>
          )}

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
              <Markdown remarkPlugins={chatRemarkPlugins} rehypePlugins={chatRehypePlugins} components={chatMarkdownComponents}>{displayContent}</Markdown>
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
