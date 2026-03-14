"use client";

import { ToolCallResult } from "@/types";
import { Badge } from "@/components/ui/badge";

const actionConfig: Record<string, { icon: string; label: string; color: string }> = {
  create_target: { icon: "🎯", label: "Target dibuat", color: "bg-green-600/20 text-green-400 border-green-600/30" },
  update_target_progress: { icon: "📈", label: "Progress diupdate", color: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  delete_target: { icon: "🗑️", label: "Target dihapus", color: "bg-red-600/20 text-red-400 border-red-600/30" },
  get_targets: { icon: "📋", label: "Daftar target", color: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30" },
  get_target_summary: { icon: "📊", label: "Summary", color: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30" },
};

interface ActionBadgeProps {
  toolCall: ToolCallResult;
}

export function ActionBadge({ toolCall }: ActionBadgeProps) {
  const config = actionConfig[toolCall.name] || {
    icon: "⚡",
    label: toolCall.name,
    color: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
  };

  const detail = toolCall.args.title ? `: ${toolCall.args.title}` : "";

  return (
    <Badge variant="outline" className={`${config.color} text-xs font-normal`}>
      {config.icon} {config.label}{detail}
    </Badge>
  );
}
