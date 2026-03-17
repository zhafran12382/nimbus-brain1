"use client";

import { GroqRateLimit } from "@/types";
import { Progress } from "@/components/ui/progress";

interface RateLimitIndicatorProps {
  rateLimit: GroqRateLimit | null;
}

function getProgressColor(ratio: number): string {
  if (ratio > 0.5) return "bg-emerald-500";
  if (ratio > 0.2) return "bg-yellow-500";
  return "bg-red-500";
}

function toPercent(remaining?: number, limit?: number): number {
  if (!limit || remaining === undefined) return 0;
  return Math.max(0, Math.min(100, (remaining / limit) * 100));
}

function formatReset(raw?: string): string {
  if (!raw) return "—";

  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    const minutes = Math.floor(numeric / 60);
    const seconds = Math.round(numeric % 60);
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  const match = raw.match(/(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?/i);
  if (match && (match[1] || match[2])) {
    const minutes = Number(match[1] || 0);
    const seconds = Math.round(Number(match[2] || 0));
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  return raw;
}

export function RateLimitIndicator({ rateLimit }: RateLimitIndicatorProps) {
  if (!rateLimit) {
    return (
      <p className="text-[10px] text-white/35 px-1">
        Send a message to see rate limits
      </p>
    );
  }

  const rpdPercent = toPercent(rateLimit.remainingRequests, rateLimit.limitRequests);
  const tpmPercent = toPercent(rateLimit.remainingTokens, rateLimit.limitTokens);
  const resetLabel = formatReset(rateLimit.resetRequests || rateLimit.resetTokens);

  return (
    <div className="min-w-[220px] rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 space-y-1.5">
      <p className="text-[10px] text-white/75">
        📊 RPD: {rateLimit.remainingRequests ?? "—"}/{rateLimit.limitRequests ?? "—"} remaining
      </p>
      <Progress value={rpdPercent} className="h-1.5 bg-white/10" indicatorClassName={getProgressColor(rpdPercent / 100)} />

      <p className="text-[10px] text-white/75">
        🔤 TPM: {rateLimit.remainingTokens ?? "—"}/{rateLimit.limitTokens ?? "—"} remaining
      </p>
      <Progress value={tpmPercent} className="h-1.5 bg-white/10" indicatorClassName={getProgressColor(tpmPercent / 100)} />

      <p className="text-[10px] text-white/55">⏱️ Reset: {resetLabel}</p>
    </div>
  );
}
