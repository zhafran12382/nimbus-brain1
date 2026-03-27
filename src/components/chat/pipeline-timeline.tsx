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
  headerLabel?: string;
  headerIcon?: React.ReactNode;
  headerActive?: boolean;
  searchQueries?: string[];
  currentSearchQuery?: string;
  isCurrentlySearching?: boolean;
  totalSearchSteps?: number;
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

/** Solid colored dot — no animation */
function NodeDot({ active }: { active: boolean }) {
  return (
    <div
      className="w-[9px] h-[9px] rounded-full shrink-0 transition-colors duration-200"
      style={{
        background: active ? "hsl(217 91% 60%)" : "hsl(0 0% 25%)",
        boxShadow: active ? "0 0 7px hsl(217 91% 60% / 0.55)" : "none",
      }}
    />
  );
}

export function PipelineTimeline({
  steps,
  sources = [],
  isCollapsible = true,
  defaultExpanded = true,
  headerLabel,
  headerActive = false,
  searchQueries = [],
  currentSearchQuery,
  isCurrentlySearching = false,
  totalSearchSteps = 0,
}: PipelineTimelineProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasSearch = steps.some((s) => s.type === "search");
  const hasSteps = steps.length > 0;
  const summaryLabel = hasSearch
    ? isCurrentlySearching
      ? "Searching..."
      : `Searched ${totalSearchSteps} source${totalSearchSteps !== 1 ? "s" : ""}`
    : hasSteps
      ? steps[steps.length - 1].label
      : headerLabel || "Processing...";

  const headerIsActive = isCurrentlySearching || (headerActive && !hasSteps);

  // Only show collapse controls when there are actual steps to collapse
  const canCollapse = isCollapsible && hasSteps;

  // Header left: Globe for completed search, dot for everything else
  const showGlobe = hasSearch && !isCurrentlySearching;

  return (
    <div className="mb-3">
      <div className="relative pl-[18px]">

        {/* ── Vertical connecting rail ──
            ALWAYS visible when there's a header dot — extends downward.
            Acts as a visual "loading track" even before steps appear. */}
        <div
          className="absolute left-[3.5px] w-[1.5px] rounded-full transition-all duration-300"
          style={{
            // Start just below center of header dot
            top: "16px",
            // If steps visible & expanded: stretch to bottom. Otherwise: short stub.
            bottom: hasSteps && (expanded || !isCollapsible) ? "4px" : "auto",
            height: hasSteps && (expanded || !isCollapsible) ? "auto" : "16px",
            background: headerIsActive
              ? "hsl(217 91% 60% / 0.22)"
              : "hsl(0 0% 100% / 0.07)",
          }}
        />

        {/* ── Header row ── */}
        {isCollapsible && (
          <div
            className="relative flex items-center gap-2.5 py-1.5 text-[13px] text-[hsl(0_0%_65%)] hover:text-[hsl(0_0%_80%)] transition-colors cursor-pointer"
            onClick={() => canCollapse && setExpanded((prev) => !prev)}
          >
            {/* Header node dot */}
            <div className="absolute -left-[18px] top-1/2 -translate-y-1/2">
              {showGlobe
                ? <Globe className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                : <NodeDot active={headerIsActive} />
              }
            </div>

            <span className="flex-1 text-left font-medium">{summaryLabel}</span>

            {/* Chevron: only when there are steps to toggle */}
            {canCollapse && (
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                  expanded ? "rotate-0" : "-rotate-90"
                }`}
              />
            )}
          </div>
        )}

        {/* ── Expanded steps ── */}
        <AnimatePresence initial={false}>
          {(expanded || !isCollapsible) && hasSteps && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-1.5 pb-1 space-y-2.5">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.05 }}
                    className="relative"
                  >
                    {/* Step node dot on the rail */}
                    <div className="absolute -left-[18px] top-[4px]">
                      <NodeDot active={step.status === "active"} />
                    </div>

                    {/* Step content */}
                    <div className="flex flex-col gap-1">
                      <div
                        className={`flex items-center gap-2 text-[13px] ${
                          step.status === "done"
                            ? "text-[hsl(0_0%_50%)]"
                            : "text-[hsl(0_0%_72%)]"
                        }`}
                      >
                        <span className="text-xs shrink-0 w-3.5 text-center leading-none">
                          {step.icon}
                        </span>
                        <span>{step.label}</span>
                      </div>

                      {/* Search step: queries + source chips */}
                      {step.type === "search" && (
                        <div className="pl-5 flex flex-col gap-1.5 mt-0.5 min-w-0 overflow-hidden">
                          {searchQueries.map((query, i) => (
                            <div
                              key={`sq-${i}`}
                              className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_40%)]"
                            >
                              <Search className="w-3 h-3 shrink-0 opacity-50" />
                              <span className="truncate">&quot;{query}&quot;</span>
                            </div>
                          ))}
                          {currentSearchQuery && (
                            <div className="flex items-center gap-2 text-[12px] text-[hsl(0_0%_40%)]">
                              <Search className="w-3 h-3 shrink-0 opacity-50" />
                              <span className="truncate">&quot;{currentSearchQuery}&quot;</span>
                            </div>
                          )}
                          {sources.length > 0 && (
                            <div className="source-chips-scroll mt-0.5">
                              {sources.map((src, i) => (
                                <SourceChip key={`src-${i}`} domain={src.domain} url={src.url} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Generic children */}
                      {step.children && (
                        <div className="pl-5 mt-1">{step.children}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
