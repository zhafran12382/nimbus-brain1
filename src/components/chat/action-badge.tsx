"use client";

import { ToolCallResult } from "@/types";

const actionConfig: Record<string, { icon: string; label: string; bgClass: string; textClass: string; borderClass: string }> = {
  create_target: { icon: "🎯", label: "create target", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400", borderClass: "border-emerald-500/20" },
  update_target_progress: { icon: "📈", label: "update target", bgClass: "bg-blue-500/10", textClass: "text-blue-400", borderClass: "border-blue-500/20" },
  delete_target: { icon: "🗑️", label: "delete target", bgClass: "bg-red-500/10", textClass: "text-red-400", borderClass: "border-red-500/20" },
  get_targets: { icon: "📋", label: "get targets", bgClass: "bg-zinc-500/10", textClass: "text-zinc-400", borderClass: "border-zinc-500/20" },
  get_target_summary: { icon: "📊", label: "get summary", bgClass: "bg-zinc-500/10", textClass: "text-zinc-400", borderClass: "border-zinc-500/20" },
  web_search: { icon: "🔍", label: "web search", bgClass: "bg-violet-500/10", textClass: "text-violet-400", borderClass: "border-violet-500/20" },
};

interface ActionBadgeProps {
  toolCall: ToolCallResult;
}

export function ActionBadge({ toolCall }: ActionBadgeProps) {
  const config = actionConfig[toolCall.name] || {
    icon: "⚡",
    label: toolCall.name.replace(/_/g, " "),
    bgClass: "bg-zinc-500/10",
    textClass: "text-zinc-400",
    borderClass: "border-zinc-500/20",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass}`}>
      {config.icon} {config.label}
    </span>
  );
}
