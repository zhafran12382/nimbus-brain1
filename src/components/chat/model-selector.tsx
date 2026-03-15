"use client";

import { AVAILABLE_MODELS } from "@/lib/models";

export function ModelSelector() {
  const model = AVAILABLE_MODELS[0];

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_100%_/_0.06)] text-[11px] text-[hsl(0_0%_45%)]">
      <span>⭐</span>
      <span className="text-[hsl(0_0%_60%)]">{model.name}</span>
    </div>
  );
}
