"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, Check } from "lucide-react";
import { ProviderId } from "@/types";
import { CLIENT_PROVIDERS } from "@/lib/models";

interface RouterSelectorProps {
  providerId: ProviderId;
  onProviderChange: (id: ProviderId) => void;
}

export function RouterSelector({ providerId, onProviderChange }: RouterSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProvider = CLIENT_PROVIDERS.find((provider) => provider.id === providerId) || CLIENT_PROVIDERS[0];

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
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex min-h-11 max-w-[55vw] items-center gap-2 overflow-hidden rounded-full border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_100%_/_0.03)] px-2.5 py-2 transition-colors hover:bg-[hsl(0_0%_100%_/_0.06)] sm:max-w-none sm:px-3"
        style={{ minHeight: "44px", minWidth: "44px" }}
      >
        <span className="shrink-0 text-sm">{currentProvider.icon}</span>
        <span className="truncate text-xs font-medium text-[hsl(0_0%_80%)] transition-colors group-hover:text-white">
          {currentProvider.name}
        </span>
        <ChevronUp
          className={`h-3 w-3 text-text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(240_10%_10%)] shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {CLIENT_PROVIDERS.map((provider) => {
                const isActive = provider.id === providerId;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      onProviderChange(provider.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-[hsl(217_91%_60%_/_0.1)]"
                        : "hover:bg-[hsl(0_0%_100%_/_0.05)]"
                    }`}
                    style={{ minHeight: "44px" }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(0_0%_100%_/_0.06)]">
                      <span className="text-sm">{provider.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            isActive ? "text-[hsl(217_91%_60%)]" : "text-[hsl(0_0%_90%)]"
                          }`}
                        >
                          {provider.name}
                        </span>
                        {isActive && (
                          <Check className="h-4 w-4 text-[hsl(217_91%_60%)] shrink-0" />
                        )}
                      </div>
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
