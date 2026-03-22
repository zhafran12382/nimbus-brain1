"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { AIModel, ProviderId } from "@/types";
import { CLIENT_PROVIDERS, getModelsByProvider } from "@/lib/models";

interface ModelSelectorProps {
  providerId: ProviderId;
  modelId: string;
  onProviderChange: (id: ProviderId) => void;
  onModelChange: (id: string) => void;
}

function formatContext(ctx: number | null): string {
  if (!ctx) return "";
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(0)}M`;
  if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`;
  return `${ctx}`;
}

export function ModelSelector({ providerId, modelId, onProviderChange, onModelChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const models = getModelsByProvider(providerId);
  const currentModel = models.find(m => m.id === modelId) || models[0];
  const currentProvider = CLIENT_PROVIDERS.find(p => p.id === providerId);

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
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/60 hover:bg-white/8 hover:text-white/80 transition-colors"
      >
        <span>{currentProvider?.icon}</span>
        <span className="max-w-[120px] truncate text-white/80 font-medium">{currentModel?.name || "Select model"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-[320px] rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-2xl z-50 overflow-hidden">
          {/* Model List */}
          <div className="max-h-[320px] overflow-y-auto p-1.5">
            {models.map((m) => (
              <ModelItem
                key={m.id}
                model={m}
                selected={m.id === modelId}
                onClick={() => {
                  onModelChange(m.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-3 py-2">
            <p className="text-[10px] text-white/30">
              Models with <span className="text-purple-400">Tools</span> badge support quiz, expense, memory, search
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelItem({ model, selected, onClick }: { model: AIModel; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${
        selected
          ? "bg-blue-500/15 border border-blue-500/30"
          : "border border-transparent hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-white/90">{model.name}</span>
        {model.badge && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400">
            {model.badge}
          </span>
        )}
        {model.supports_tools && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400">
            Tools
          </span>
        )}
      </div>
      <p className="text-[11px] text-white/40 mt-0.5">
        {model.description}{model.context_length ? ` · ${formatContext(model.context_length)} ctx` : ""}
      </p>
    </button>
  );
}
