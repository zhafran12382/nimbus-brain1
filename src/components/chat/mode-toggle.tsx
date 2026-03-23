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
    color: "text-indigo-300", 
    bg: "bg-indigo-500/15", 
    desc: "Browse the web for up-to-date answers" 
  },
  { 
    id: "think" as const, 
    label: "Think", 
    icon: Brain, 
    color: "text-sky-300", 
    bg: "bg-sky-500/15", 
    desc: "Deep reasoning and logic" 
  },
  { 
    id: "flash" as const, 
    label: "Flash", 
    icon: Zap, 
    color: "text-amber-300", 
    bg: "bg-amber-500/15", 
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
        className="flex min-h-11 items-center gap-2 rounded-2xl border border-[hsl(222_18%_34%_/_0.5)] bg-[linear-gradient(180deg,hsl(224_14%_16%),hsl(224_12%_12%))] px-3 py-1.5 text-[hsl(0_0%_88%)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04),0_6px_20px_-14px_hsl(221_80%_50%_/_0.8)] hover:border-[hsl(217_91%_60%_/_0.45)] hover:bg-[linear-gradient(180deg,hsl(224_16%_18%),hsl(224_13%_13%))] transition-all group"
      >
        <currentMode.icon className={`h-3.5 w-3.5 ${currentMode.color}`} />
        <span className="text-xs font-semibold text-[hsl(0_0%_88%)] group-hover:text-white transition-colors">
          {currentMode.label}
        </span>
        <ChevronUp
          className={`h-3 w-3 text-[hsl(0_0%_62%)] transition-transform duration-200 ${
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
            className="absolute left-0 bottom-full z-50 mb-2 w-64 overflow-hidden rounded-2xl border border-[hsl(222_18%_30%_/_0.8)] bg-[hsl(224_16%_12%)] shadow-[0_20px_55px_-24px_hsl(220_90%_55%_/_0.45)]"
          >
            <div className="flex flex-col gap-1 p-1.5">
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
                    className={`w-full flex items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-[hsl(217_91%_60%_/_0.16)] ring-1 ring-[hsl(217_91%_60%_/_0.3)]"
                        : "hover:bg-[hsl(0_0%_100%_/_0.04)]"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${m.bg}`}>
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            isActive ? "text-[hsl(217_91%_68%)]" : "text-[hsl(0_0%_92%)]"
                          }`}
                        >
                          {m.label}
                        </span>
                        {isActive && (
                          <Check className="h-4 w-4 text-[hsl(217_91%_68%)] shrink-0" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-[hsl(0_0%_64%)]">
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
