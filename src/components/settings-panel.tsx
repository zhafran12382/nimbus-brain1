"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Wrench, Sparkles } from "lucide-react";
import { AVAILABLE_MODELS } from "@/lib/models";
import { panelSlideRight, hoverScale, tapShrink } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const selectedModelId = AVAILABLE_MODELS[0]?.id;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={panelSlideRight.initial}
            animate={panelSlideRight.animate}
            exit={panelSlideRight.exit}
            transition={panelSlideRight.transition}
            className="fixed inset-y-0 right-0 z-[70] w-80 glass border-l border-border-subtle p-6 overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary">
                Pengaturan Model
              </h2>
              <motion.button
                whileHover={hoverScale}
                whileTap={tapShrink}
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            {/* Model List */}
            <div className="space-y-2">
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = model.id === selectedModelId;
                return (
                  <motion.div
                    key={model.id}
                    whileHover={{ backgroundColor: "var(--bg-hover)" }}
                    className={cn(
                      "rounded-xl p-4 cursor-pointer transition-colors border",
                      isSelected
                        ? "border-l-[3px] border-l-accent bg-accent-muted border-border-subtle"
                        : "border-border-subtle hover:border-border-default"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">
                            {model.name}
                          </span>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-success" />
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {model.provider}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-success/20 text-success border-0 text-[10px]">
                          Free
                        </Badge>
                        {model.id === "zai/glm-4.5-flash" && (
                          <Badge className="bg-accent-muted text-accent border-0 text-[10px]">
                            <Sparkles className="h-3 w-3 mr-0.5" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {model.supports_tools && (
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <Wrench className="h-3 w-3" /> Tools
                        </span>
                      )}
                      {model.context_length && (
                        <span className="text-[10px] text-text-muted">
                          {(model.context_length / 1000).toFixed(0)}K ctx
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
