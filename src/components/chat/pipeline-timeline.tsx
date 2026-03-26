"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Globe, Search } from "lucide-react";

export interface PipelineStep {
  id: string;
  type: "thinking" | "search" | "code_execution" | "tool" | "generating";
  icon: React.ReactNode;
  label: string;
  status: "active" | "done";
  detail?: string;
  children?: React.ReactNode;
}

export interface PipelineSource {
  domain: string;
  url: string;
  title?: string;
}

interface PipelineTimelineProps {
  steps: PipelineStep[];
  sources?: PipelineSource[];
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  // Header-only label (shown in collapsible button, not as a timeline step)
  headerLabel?: string;
  headerIcon?: React.ReactNode;
  headerActive?: boolean;
  // Search-specific props for the grouped search card
  searchQueries?: string[];
  currentSearchQuery?: string;
  isCurrentlySearching?: boolean;
  totalSearchSteps?: number;
  // Code execution props
  codeBlocks?: { code: string; output?: string; description?: string }[];
}

function SourceChip({ domain, url }: { domain: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[11px] text-[hsl(0_0%_55%)] hover:text-[hsl(0_0%_80%)] hover:bg-[rgba(255,255,255,0.1)] transition-colors whitespace-nowrap shrink-0"
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        alt=""
        className="w-3.5 h-3.5 rounded-full"
      />
      <span>{domain}</span>
    </a>
  );
}

function PipelineDot({ active }: { active: boolean }) {
  return (
    <div className="relative flex-shrink-0 w-2.5 flex items-center justify-center">
      <div
        className={`w-[7px] h-[7px] rounded-full transition-colors ${
          active
            ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]"
            : "bg-[hsl(0_0%_25%)]"
        }`}
      />
      {active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[7px] h-[7px] rounded-full bg-blue-400 animate-ping opacity-40" />
        </div>
      )}
    </div>
  );
}

export function PipelineTimeline({
  steps,
  sources = [],
  isCollapsible = true,
  defaultExpanded = true,
  headerLabel,
  headerIcon,
  headerActive = false,
  searchQueries = [],
  currentSearchQuery,
  isCurrentlySearching = false,
  totalSearchSteps = 0,
  codeBlocks = [],
}: PipelineTimelineProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasSearch = steps.some((s) => s.type === "search");
  const summaryLabel = hasSearch
    ? isCurrentlySearching
      ? "Searching..."
      : `Searched ${totalSearchSteps} source${totalSearchSteps !== 1 ? "s" : ""}`
    : steps.length > 0
      ? steps[steps.length - 1].label
      : headerLabel || "Processing...";

  // Header icon: spinner when searching or headerActive, Globe for search, else headerIcon or first step icon
  const headerIconNode = isCurrentlySearching
    ? <div className="spinner-perplexity !w-3.5 !h-3.5 shrink-0" />
    : hasSearch
      ? <Globe className="w-3.5 h-3.5 shrink-0 text-blue-400" />
      : headerActive && steps.length === 0
        ? <div className="spinner-perplexity !w-3.5 !h-3.5 shrink-0" />
        : steps.length > 0
          ? <span className="text-xs shrink-0">{steps[0]?.icon}</span>
          : headerIcon
            ? <span className="text-xs shrink-0">{headerIcon}</span>
            : <span className="text-xs shrink-0">{"✦"}</span>;

  return (
    <div className="mb-3">
      {/* Collapsible header */}
      {isCollapsible && (
        <div>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full flex items-center gap-2.5 py-1.5 text-[13px] text-[hsl(0_0%_65%)] hover:text-[hsl(0_0%_80%)] transition-colors"
          >
            {headerIconNode}
            <span className="flex-1 text-left font-medium">{summaryLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                expanded ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
          {/* Separator line under header */}
          <div className="h-px bg-[hsl(0_0%_100%_/_0.06)] mt-0.5" />
        </div>
      )}

      {/* Expanded timeline */}
      <AnimatePresence initial={false}>
        {(expanded || !isCollapsible) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative pl-5 pt-1 pb-1">
              {/* Connecting vertical line */}
              <div className="pipeline-line" />

              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.06 }}
                  className="relative mb-2.5 last:mb-0"
                >
                  {/* Dot on the line */}
                  <div className="absolute -left-5 top-[5px]">
                    <PipelineDot active={step.status === "active"} />
                  </div>

                  {/* Step content */}
                  <div className="flex flex-col gap-1">
                    <div
                      className={`flex items-center gap-2 text-[13px] ${
                        step.status === "done"
                          ? "text-[hsl(0_0%_50%)]"
                          : "text-[hsl(0_0%_70%)]"
                      }`}
                    >
                      {step.status === "active" ? (
                        <div className="spinner-perplexity !w-3.5 !h-3.5 shrink-0" />
                      ) : (
                        <span className="text-xs shrink-0 w-3.5 text-center leading-none">
                          {step.icon}
                        </span>
                      )}
                      <span>{step.label}</span>
                    </div>

                    {/* Search step children: queries + source chips */}
                    {step.type === "search" && (
                      <div className="pl-5.5 flex flex-col gap-1.5 mt-1">
                        {searchQueries.map((query, i) => (
                          <div
                            key={`sq-${i}`}
                            className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_45%)]"
                          >
                            <Search className="w-3 h-3 shrink-0 opacity-50" />
                            <span className="truncate">&quot;{query}&quot;</span>
                          </div>
                        ))}
                        {currentSearchQuery && (
                          <div className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_45%)]">
                            <div className="spinner-perplexity !w-3 !h-3 shrink-0" />
                            <span className="truncate">
                              &quot;{currentSearchQuery}&quot;
                            </span>
                          </div>
                        )}

                        {/* Source chips row */}
                        {sources.length > 0 && (
                          <div className="source-chips-scroll mt-0.5">
                            {sources.map((src, i) => (
                              <SourceChip
                                key={`src-${i}`}
                                domain={src.domain}
                                url={src.url}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Code execution step children */}
                    {step.type === "code_execution" && codeBlocks.length > 0 && (
                      <div className="pl-5.5 mt-1 space-y-1.5">
                        {codeBlocks.map((block, i) => (
                          <div key={`code-${i}`}>
                            <pre className="text-[11px] bg-[hsl(0_0%_5%)] rounded-lg p-2.5 overflow-x-auto border border-[hsl(0_0%_100%_/_0.06)] font-mono text-[hsl(0_0%_70%)]">
                              <code>{block.code}</code>
                            </pre>
                            {block.output && (
                              <div className="mt-1 text-[11px] text-green-400/80 font-mono bg-[hsl(0_0%_5%)] rounded-lg px-2.5 py-1.5 border border-green-500/10">
                                {block.output}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Generic children */}
                    {step.children && (
                      <div className="pl-5.5 mt-1">{step.children}</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
