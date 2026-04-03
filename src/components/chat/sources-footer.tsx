"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";

export interface SourceInfo {
  title: string;
  url: string;
  domain: string;
}

interface SourcesFooterProps {
  sources: SourceInfo[];
}

export function SourcesFooter({ sources }: SourcesFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  if (!sources || sources.length === 0) return null;

  // Render stacked favicons (max 3 for the collapsed view)
  const displaySources = sources.slice(0, 3);
  const hasMore = sources.length > 3;

  return (
    <div className="relative" ref={containerRef}>
      {/* Collapsed Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 rounded-full px-1 py-1 transition-all hover:bg-hover focus:outline-none"
      >
        <div className="flex -space-x-1.5">
          {displaySources.map((source, idx) => (
            <img
              key={`${source.domain}-${idx}`}
              src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`}
              alt={source.domain}
              className="h-4 w-4 rounded-full border border-background bg-elevated object-cover"
              onError={(e) => {
                // Fallback to a generic globe icon if favicon fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ))}
          {/* Fallback elements for images that fail to load */}
          {displaySources.map((_, idx) => (
            <div
              key={`fallback-${idx}`}
              className="hidden h-4 w-4 rounded-full border border-background bg-elevated items-center justify-center text-[8px]"
            >
              🌐
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[12px] font-medium text-text-muted">
          <span>{sources.length} sources</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="h-3 w-3 opacity-60" />
          </motion.div>
        </div>
      </button>

      {/* Expanded Popover */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-subtle bg-elevated p-2 shadow-xl sm:w-80"
          >
            <div className="mb-2 px-2 pt-1 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              Sources
            </div>
            <div className="flex max-h-60 flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
              {sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-hover"
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`}
                    alt=""
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
                    loading="lazy"
                  />
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-[13px] font-medium text-text-primary group-hover:text-blue-500 transition-colors">
                      {source.title || source.domain}
                    </span>
                    <span className="truncate text-[11px] text-text-muted">
                      {source.domain}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
