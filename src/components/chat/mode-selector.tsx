"use client";

import { motion } from "framer-motion";
import { ChatMode } from "@/types";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

const modes: { id: ChatMode; icon: string; label: string; activeClass: string }[] = [
  { id: "search", icon: "🔍", label: "Search", activeClass: "bg-violet-500 text-white" },
  { id: "think", icon: "🧠", label: "Think", activeClass: "bg-cyan-500 text-white" },
  { id: "flash", icon: "⚡", label: "Flash", activeClass: "bg-amber-500 text-white" },
];

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[hsl(0_0%_8%)] p-0.5 border border-[hsl(0_0%_100%_/_0.06)]">
      {modes.map((m) => {
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`relative rounded-md px-3 py-1 text-[12px] font-medium transition-colors duration-150 sm:text-[12px] sm:px-3 ${
              isActive
                ? m.activeClass
                : "text-[hsl(0_0%_45%)] hover:bg-[hsl(0_0%_12%)]"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 rounded-md"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {m.icon} {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
