'use client';

import { motion } from 'framer-motion';
import { Search, Brain, Zap } from 'lucide-react';
import { ChatMode } from '@/types';

const modes = [
  { id: 'search' as const, label: 'Search', icon: Search, color: 'text-violet-400', bg: 'shadow-violet-500/10' },
  { id: 'think' as const, label: 'Think', icon: Brain, color: 'text-cyan-400', bg: 'shadow-cyan-500/10' },
  { id: 'flash' as const, label: 'Flash', icon: Zap, color: 'text-amber-400', bg: 'shadow-amber-500/10' },
] as const;

export function ModeToggle({ value, onChange }: { value: ChatMode; onChange: (mode: ChatMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-white/5 border border-white/10 p-[3px] gap-0">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={`
            relative flex items-center gap-1.5 rounded-lg px-3 py-1.5
            text-xs font-medium transition-colors duration-200 cursor-pointer select-none
            ${value === mode.id ? mode.color : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
          `}
        >
          {/* Sliding background indicator */}
          {value === mode.id && (
            <motion.div
              layoutId="mode-indicator"
              className={`absolute inset-0 rounded-lg bg-white/10 ring-1 ring-white/10 shadow-sm ${mode.bg}`}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            <mode.icon size={12} />
            {mode.label}
          </span>
        </button>
      ))}
    </div>
  );
}
