"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonalitySettings } from "@/types";
import { modalEntrance } from "@/lib/animations";

const PERSONALITY_KEY = "nimbus-brain-personality";
const AGENT_SETTINGS_KEY = "nimbus-brain-agent-settings";

interface AgentSettings {
  maxThinkTokens: number;
  searchSourceLimit: number;
}

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  maxThinkTokens: 10000,
  searchSourceLimit: 5,
};

const DEFAULT_SETTINGS: PersonalitySettings = {
  preset: "friendly",
  language: "id",
  responseStyle: "balanced",
  userName: "",
  customInstructions: "",
};

const presets = [
  { value: "friendly", emoji: "😊", label: "Friendly", desc: "Casual, pakai emoji, supportive" },
  { value: "professional", emoji: "🎓", label: "Professional", desc: "Formal, to the point" },
  { value: "minimal", emoji: "🤖", label: "Minimal", desc: "Sesingkat mungkin" },
  { value: "custom", emoji: "🎭", label: "Custom", desc: "Tulis instruksi sendiri" },
];

const languages = [
  { value: "id", label: "🇮🇩 Bahasa Indonesia" },
  { value: "en", label: "🇬🇧 English" },
  { value: "mixed", label: "🔀 Mixed" },
];

const styles = [
  { value: "detailed", label: "Detailed", desc: "Panjang dan lengkap" },
  { value: "balanced", label: "Balanced", desc: "Sedang" },
  { value: "concise", label: "Concise", desc: "Singkat dan padat" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<PersonalitySettings>(DEFAULT_SETTINGS);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSONALITY_KEY);
      if (raw) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      }
      const agentRaw = localStorage.getItem(AGENT_SETTINGS_KEY);
      if (agentRaw) {
        setAgentSettings({ ...DEFAULT_AGENT_SETTINGS, ...JSON.parse(agentRaw) });
      }
    } catch {
      // localStorage may be unavailable or contain invalid JSON
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(PERSONALITY_KEY, JSON.stringify(settings));
    localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(agentSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setAgentSettings(DEFAULT_AGENT_SETTINGS);
    localStorage.removeItem(PERSONALITY_KEY);
    localStorage.removeItem(AGENT_SETTINGS_KEY);
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Header title="⚙️ Settings" />

      <div className="flex-1 overflow-y-auto p-4">
        <motion.div
          initial={modalEntrance.initial}
          animate={modalEntrance.animate}
          transition={modalEntrance.transition}
          className="mx-auto max-w-2xl space-y-6"
        >
          {/* Personality Preset */}
          <section className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Personality Preset</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setSettings((s) => ({ ...s, preset: p.value as PersonalitySettings["preset"] }))}
                  className={`rounded-xl p-3 text-left border transition-colors ${
                    settings.preset === p.value
                      ? "border-accent bg-accent-muted"
                      : "border-border-subtle hover:border-border-default hover:bg-hover"
                  }`}
                >
                  <span className="text-xl">{p.emoji}</span>
                  <p className="text-xs font-medium text-text-primary mt-1">{p.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Language */}
          <section className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Language</h3>
            <div className="flex gap-2 flex-wrap">
              {languages.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setSettings((s) => ({ ...s, language: l.value as PersonalitySettings["language"] }))}
                  className={`rounded-lg px-4 py-2 text-xs border transition-colors ${
                    settings.language === l.value
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border-subtle text-text-secondary hover:border-border-default"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          {/* Response Style */}
          <section className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Response Style</h3>
            <div className="flex gap-2 flex-wrap">
              {styles.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSettings((prev) => ({ ...prev, responseStyle: s.value as PersonalitySettings["responseStyle"] }))}
                  className={`rounded-lg px-4 py-2 text-xs border transition-colors ${
                    settings.responseStyle === s.value
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border-subtle text-text-secondary hover:border-border-default"
                  }`}
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="text-text-muted ml-1">— {s.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Your Name */}
          <section className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Nama Panggilan</h3>
            <Label htmlFor="userName" className="text-xs text-text-muted">AI akan memanggil kamu dengan nama ini</Label>
            <Input
              id="userName"
              value={settings.userName}
              onChange={(e) => setSettings((s) => ({ ...s, userName: e.target.value }))}
              placeholder="Contoh: Zhafran"
              className="mt-1.5"
            />
          </section>

          {/* Custom Instructions */}
          <section className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Custom Instructions</h3>
            <Label htmlFor="customInstructions" className="text-xs text-text-muted">
              Instruksi tambahan untuk AI (maks 500 karakter)
            </Label>
            <Textarea
              id="customInstructions"
              value={settings.customInstructions}
              onChange={(e) => setSettings((s) => ({ ...s, customInstructions: e.target.value.slice(0, 500) }))}
              placeholder='Contoh: "Selalu jawab dengan analogi"'
              rows={3}
              className="mt-1.5"
            />
            <p className="text-[10px] text-text-muted mt-1 text-right">
              {settings.customInstructions.length}/500
            </p>
          </section>

          {/* Agent Settings */}
          <section className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Agent Settings</h3>
            <p className="text-[10px] text-text-muted mb-4">Kontrol perilaku AI saat memproses permintaan</p>

            {/* Max Think Tokens */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-text-secondary">Max Think Tokens</Label>
                <span className="text-xs font-mono text-accent">{agentSettings.maxThinkTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={32000}
                step={1000}
                value={agentSettings.maxThinkTokens}
                onChange={(e) => setAgentSettings((s) => ({ ...s, maxThinkTokens: Number(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>1K</span>
                <span>16K</span>
                <span>32K</span>
              </div>
              <p className="text-[10px] text-text-muted">Jumlah token maksimum untuk proses berpikir (mode Think). Lebih tinggi = analisis lebih mendalam.</p>
            </div>

            {/* Search Source Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-text-secondary">Search Source Limit</Label>
                <span className="text-xs font-mono text-accent">{agentSettings.searchSourceLimit}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={agentSettings.searchSourceLimit}
                onChange={(e) => setAgentSettings((s) => ({ ...s, searchSourceLimit: Number(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>1</span>
                <span>10</span>
                <span>20</span>
              </div>
              <p className="text-[10px] text-text-muted">Jumlah sumber pencarian per query (mode Search). Lebih banyak = hasil lebih lengkap, tapi lebih lambat.</p>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pb-8">
            <button
              onClick={handleReset}
              className="text-xs text-text-muted hover:text-danger transition-colors"
            >
              Reset to Default
            </button>
            <Button onClick={handleSave}>
              {saved ? "✅ Saved!" : "Save Settings"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
