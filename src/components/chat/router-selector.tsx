"use client";

import { ProviderId } from "@/types";
import { CLIENT_PROVIDERS } from "@/lib/models";

interface RouterSelectorProps {
  providerId: ProviderId;
  onProviderChange: (id: ProviderId) => void;
}

/**
 * RouterSelector — Inline Pill Toggle
 * 
 * Instead of a dropdown (which caused endless click-handling problems),
 * this renders all providers as simple inline pill buttons.
 * Click one = it's selected. No dropdown needed.
 */
export function RouterSelector({ providerId, onProviderChange }: RouterSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[hsl(0_0%_6%)] border border-[hsl(0_0%_100%_/_0.06)]">
      {CLIENT_PROVIDERS.map((p) => {
        const isActive = p.id === providerId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onProviderChange(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              isActive
                ? "bg-[hsl(217_91%_60%_/_0.15)] text-[hsl(217_91%_60%)] shadow-sm"
                : "text-[hsl(0_0%_50%)] hover:text-[hsl(0_0%_80%)] hover:bg-[hsl(0_0%_10%)]"
            }`}
          >
            <span className="text-sm">{p.icon}</span>
            <span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}
