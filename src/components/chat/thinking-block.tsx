"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Settings2 } from "lucide-react";
import Markdown from "react-markdown";

interface ThinkingBlockProps {
  content: string;
  durationMs?: number;
}

export function ThinkingBlock({ content, durationMs }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const seconds = durationMs ? (durationMs / 1000).toFixed(1) : "0.0";

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-[hsl(0_0%_100%_/_0.05)] bg-[hsl(0_0%_6%)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[hsl(0_0%_10%)] focus:outline-none"
      >
        <div className="flex items-center gap-2 text-[12px] font-medium text-[hsl(0_0%_60%)]">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Thought for {seconds} seconds</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-[hsl(0_0%_50%)]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="border-t border-[hsl(0_0%_100%_/_0.05)] bg-[hsl(0_0%_4%)] px-3 py-2.5">
              <div className="relative pl-3 before:absolute before:bottom-1 before:left-0 before:top-1 before:w-[2px] before:rounded-full before:bg-[hsl(217_91%_60%_/_0.3)]">
                <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed text-[hsl(0_0%_65%)] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:mb-2 [&_li]:mb-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4">
                  <Markdown>{content}</Markdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
