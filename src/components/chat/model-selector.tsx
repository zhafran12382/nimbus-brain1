"use client";

import { AVAILABLE_MODELS } from "@/lib/models";

export function ModelSelector() {
  const model = AVAILABLE_MODELS[0];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
      <span>🔧</span>
      <span>{model.name}</span>
      <span className="text-zinc-500">({model.provider})</span>
    </div>
  );
}
