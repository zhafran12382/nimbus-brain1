"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Brain, Zap, ChevronUp, Check } from "lucide-react";
import { ChatMode } from "@/types";

const modes = [
  { 
    id: "search" as const, 
    label: "Search", 
    icon: Search, 
    color: "text-violet-400", 
    bg: "bg-violet-500/10", 
    desc: "Browse the web for up-to-date answers" 
  },
  { 
    id: "think" as const, 
    label: "Think", 
    icon: Brain, 
    color: "text-cyan-400", 
    bg: "bg-cyan-500/10", 
    desc: "Deep reasoning and logic" 
  },
  { 
    id: "flash" as const, 
    label: "Flash", 
    icon: Zap, 
    color: "text-amber-400", 
    bg: "bg-amber-500/10", 
    desc: "Fast and efficient responses" 
  },
] as const;

export function ModeToggle({ value, onChange }: { value: ChatMode; onChange: (mode: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentMode = modes.find((m) => m.id === value) || modes[2];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger: Perplexity-style focus button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_100%_/_0.03)] hover:bg-[hsl(0_0%_100%_/_0.06)] transition-colors group"
      >
        <currentMode.icon className={`h-3.5 w-3.5 ${currentMode.color}`} />
        <span className="text-xs font-medium text-[hsl(0_0%_80%)] group-hover:text-white transition-colors">
          {currentMode.label}
        </span>
        <ChevronUp
          className={`h-3 w-3 text-text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {open && (
           <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 bottom-full mb-2 w-64 rounded-xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(240_10%_10%)] shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {modes.map((m) => {
                const isActive = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-[hsl(217_91%_60%_/_0.1)]"
                        : "hover:bg-[hsl(0_0%_100%_/_0.05)]"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${m.bg}`}>
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            isActive ? "text-[hsl(217_91%_60%)]" : "text-[hsl(0_0%_90%)]"
                          }`}
                        >
                          {m.label}
                        </span>
                        {isActive && (
                          <Check className="h-4 w-4 text-[hsl(217_91%_60%)] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[hsl(0_0%_50%)] mt-0.5 leading-snug">
                        {m.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
