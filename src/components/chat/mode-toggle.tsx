"use client";

import { Atom, Globe } from "lucide-react";
import { ChatMode } from "@/types";

export function ModeToggle({ value, onChange }: { value: ChatMode; onChange: (mode: ChatMode) => void }) {
  const isThink = value === "think" || value === "search+think";
  const isSearch = value === "search" || value === "search+think";

  function toggle(target: "think" | "search") {
    if (target === "think") {
      // Toggle think
      if (isThink && isSearch) onChange("search");
      else if (isThink) onChange("flash");
      else if (isSearch) onChange("search+think");
      else onChange("think");
    } else {
      // Toggle search
      if (isSearch && isThink) onChange("think");
      else if (isSearch) onChange("flash");
      else if (isThink) onChange("search+think");
      else onChange("search");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => toggle("think")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all border ${
          isThink
            ? "bg-[hsl(0_0%_100%_/_0.1)] border-[hsl(0_0%_100%_/_0.2)] text-[hsl(0_0%_93%)]"
            : "bg-transparent border-[hsl(0_0%_100%_/_0.08)] text-[hsl(0_0%_50%)] hover:text-[hsl(0_0%_70%)] hover:border-[hsl(0_0%_100%_/_0.15)]"
        }`}
        style={{ minHeight: "36px", touchAction: "manipulation" }}
      >
        <Atom className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">DeepThink</span>
      </button>
      <button
        type="button"
        onClick={() => toggle("search")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all border ${
          isSearch
            ? "bg-[hsl(0_0%_100%_/_0.1)] border-[hsl(0_0%_100%_/_0.2)] text-[hsl(0_0%_93%)]"
            : "bg-transparent border-[hsl(0_0%_100%_/_0.08)] text-[hsl(0_0%_50%)] hover:text-[hsl(0_0%_70%)] hover:border-[hsl(0_0%_100%_/_0.15)]"
        }`}
        style={{ minHeight: "36px", touchAction: "manipulation" }}
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search</span>
      </button>
    </div>
  );
}
