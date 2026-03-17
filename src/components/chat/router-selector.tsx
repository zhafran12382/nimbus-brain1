"use client";

import { useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentProvider = CLIENT_PROVIDERS.find((p) => p.id === providerId);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl">
        <span className="text-base opacity-0">⚪</span>
        <span className="text-sm font-semibold text-transparent">Loading</span>
      </div>
    );
  }

  return (
    <div className="relative group flex items-center">
      {/* 
        The beautiful visual layer: Emoji and Label 
        We use pointer-events-none so it doesn't block the select underneath it.
      */}
      <div className="absolute left-0 top-0 bottom-0 pointer-events-none flex items-center justify-between w-full px-3 z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden="true">{currentProvider?.icon}</span>
          <span className="text-sm font-semibold text-[hsl(0_0%_93%)] group-hover:text-[hsl(217_91%_60%)] transition-colors">
            {currentProvider?.name || "Router"}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-[hsl(0_0%_30%)] transition-transform duration-200 group-focus-within:rotate-180" aria-hidden="true" />
      </div>

      {/* 
        The real interactive element.
        Instead of completely invisible, we make its text transparent.
        OS click opens the un-hijackable native dropdown menu.
      */}
      <select
        className="w-[140px] h-[34px] appearance-none bg-transparent hover:bg-[hsl(0_0%_12%)] transition-colors rounded-xl outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[hsl(217_91%_60%_/_.5)] text-transparent relative z-0"
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
