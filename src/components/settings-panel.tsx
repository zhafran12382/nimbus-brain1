"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wrench, Sparkles, User, Globe, MessageSquare } from "lucide-react";
import { AVAILABLE_MODELS } from "@/lib/models";
import { panelSlideRight, hoverScale, tapShrink } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PersonalitySettings } from "@/types";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const PERSONALITY_KEY = "nimbus-brain-personality";

const DEFAULT_SETTINGS: PersonalitySettings = {
  preset: "friendly",
  language: "id",
  responseStyle: "balanced",
  userName: "",
  customInstructions: "",
};

const presets = [
  { value: "friendly", emoji: "😊", label: "Friendly" },
  { value: "professional", emoji: "🎓", label: "Professional" },
  { value: "minimal", emoji: "🤖", label: "Minimal" },
  { value: "custom", emoji: "🎭", label: "Custom" },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const selectedModelId = AVAILABLE_MODELS[0]?.id;
  const [personality, setPersonality] = useState<PersonalitySettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<"model" | "personality">("model");

  useEffect(() => {
    if (open) {
      try {
        const raw = localStorage.getItem(PERSONALITY_KEY);
        if (raw) setPersonality({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {}
    }
  }, [open]);

  const savePersonality = (updated: PersonalitySettings) => {
    setPersonality(updated);
    localStorage.setItem(PERSONALITY_KEY, JSON.stringify(updated));
  };

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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Pengaturan
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

            {/* Tabs */}
            <div className="flex gap-1 mb-4 rounded-lg bg-[hsl(0_0%_7%)] p-1">
              <button
                onClick={() => setTab("model")}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === "model" ? "bg-accent-muted text-accent" : "text-text-muted hover:text-text-secondary"
                )}
              >
                Model
              </button>
              <button
                onClick={() => setTab("personality")}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === "personality" ? "bg-accent-muted text-accent" : "text-text-muted hover:text-text-secondary"
                )}
              >
                Personality
              </button>
            </div>

            {tab === "model" ? (
              /* Model List */
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
            ) : (
              /* Personality Settings */
              <div className="space-y-4">
                {/* Preset */}
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1">
                    <User className="h-3 w-3" /> Preset
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => savePersonality({ ...personality, preset: p.value as PersonalitySettings["preset"] })}
                        className={cn(
                          "rounded-lg px-3 py-2 text-xs text-left border transition-colors",
                          personality.preset === p.value
                            ? "border-accent bg-accent-muted text-accent"
                            : "border-border-subtle text-text-secondary hover:border-border-default"
                        )}
                      >
                        {p.emoji} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Language
                  </p>
                  <div className="flex gap-1.5">
                    {[
                      { value: "id", label: "🇮🇩 ID" },
                      { value: "en", label: "🇬🇧 EN" },
                      { value: "mixed", label: "🔀 Mix" },
                    ].map((l) => (
                      <button
                        key={l.value}
                        onClick={() => savePersonality({ ...personality, language: l.value as PersonalitySettings["language"] })}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs border transition-colors",
                          personality.language === l.value
                            ? "border-accent bg-accent-muted text-accent"
                            : "border-border-subtle text-text-secondary hover:border-border-default"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Response Style */}
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Response Style
                  </p>
                  <div className="flex gap-1.5">
                    {[
                      { value: "detailed", label: "Detailed" },
                      { value: "balanced", label: "Balanced" },
                      { value: "concise", label: "Concise" },
                    ].map((s) => (
                      <button
                        key={s.value}
                        onClick={() => savePersonality({ ...personality, responseStyle: s.value as PersonalitySettings["responseStyle"] })}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs border transition-colors",
                          personality.responseStyle === s.value
                            ? "border-accent bg-accent-muted text-accent"
                            : "border-border-subtle text-text-secondary hover:border-border-default"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">Nama Panggilan</p>
                  <input
                    value={personality.userName}
                    onChange={(e) => savePersonality({ ...personality, userName: e.target.value })}
                    placeholder="Contoh: Zhafran"
                    className="w-full rounded-lg bg-elevated border border-border-subtle px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                </div>

                {/* Custom Instructions */}
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">Custom Instructions</p>
                  <textarea
                    value={personality.customInstructions}
                    onChange={(e) => savePersonality({ ...personality, customInstructions: e.target.value.slice(0, 500) })}
                    placeholder="Instruksi tambahan untuk AI..."
                    rows={3}
                    className="w-full rounded-lg bg-elevated border border-border-subtle px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
                  />
                  <p className="text-[10px] text-text-muted text-right mt-0.5">
                    {personality.customInstructions.length}/500
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
