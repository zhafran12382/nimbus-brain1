"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Atom } from "lucide-react";
import Markdown from "react-markdown";
import { chatMarkdownComponents, chatRemarkPlugins, chatRehypePlugins } from "./markdown-components";

interface ThinkingBlockProps {
  content: string;
  durationMs?: number;
}

export function ThinkingBlock({ content, durationMs }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const seconds = durationMs ? (durationMs / 1000).toFixed(1) : "0.0";

  if (!content) return null;

  return (
    <div className="mb-3 flex flex-col items-start w-full">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex min-h-11 items-center gap-2 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Atom className="h-4 w-4 text-accent" />
        <span className="text-text-muted hover:text-text-primary transition-colors">Thought for {seconds} seconds</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden w-full"
          >
            <div className="mt-3 pl-4 border-l-2 border-border-default text-[13px] leading-relaxed text-text-secondary">
              <div className="chat-markdown prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <Markdown remarkPlugins={chatRemarkPlugins} rehypePlugins={chatRehypePlugins} components={chatMarkdownComponents}>{content}</Markdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
