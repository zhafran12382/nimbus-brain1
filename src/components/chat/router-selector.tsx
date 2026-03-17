"use client";

import { ChevronDown } from "lucide-react";
import { ProviderId } from "@/types";
import { CLIENT_PROVIDERS } from "@/lib/models";

interface RouterSelectorProps {
  providerId: ProviderId;
  onProviderChange: (id: ProviderId) => void;
}

/**
 * RouterSelector — Pure Native Select with CSS Disguise
 * 
 * We use an actual visible <select> tag because the hydration issue (data-jetski)
 * completely breaks React event delegation for custom dropdown buttons.
 * 
 * We style the <select> to look like the normal button, and use the OS native
 * dropdown list. This guarantees 100% reliability because the OS handles the click.
 */
export function RouterSelector({ providerId, onProviderChange }: RouterSelectorProps) {
  const currentProvider = CLIENT_PROVIDERS.find((p) => p.id === providerId);

  return (
    <div className="group relative flex h-9 w-[156px] items-center">
      {/* 
        The beautiful visual layer: Emoji and Label 
        We use pointer-events-none so it doesn't block the select underneath it.
      */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between rounded-xl border border-white/10 bg-[hsl(0_0%_10%_/_0.75)] px-3.5 shadow-[0_1px_0_hsl(0_0%_100%_/_0.04)_inset] transition-all group-hover:border-[hsl(217_91%_60%_/_0.45)] group-hover:bg-[hsl(0_0%_12%_/_0.9)] group-focus-within:border-[hsl(217_91%_60%_/_0.6)] group-focus-within:shadow-[0_0_0_2px_hsl(217_91%_60%_/_0.18)]">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden="true">{currentProvider?.icon}</span>
          <span className="text-sm font-semibold text-[hsl(0_0%_93%)] transition-colors group-hover:text-[hsl(0_0%_98%)]">
            {currentProvider?.name || "Router"}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-[hsl(0_0%_55%)] transition-transform duration-200 group-focus-within:rotate-180" aria-hidden="true" />
      </div>

      {/* 
        The real interactive element.
        Instead of completely invisible, we make its text transparent.
        OS click opens the un-hijackable native dropdown menu.
      */}
      <select
        className="relative z-20 h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent text-transparent outline-none"
        value={providerId}
        onChange={(e) => onProviderChange(e.target.value as ProviderId)}
        title="Select AI Router"
        style={{ WebkitAppearance: 'none' }}
      >
        {CLIENT_PROVIDERS.map((p) => (
          <option key={p.id} value={p.id} className="text-black dark:text-white bg-white dark:bg-[hsl(0_0%_8%)]">
             {/* Text shown inside the OS dropdown list */}
             {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
