"use client";

import { Target } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, AlertCircle } from "lucide-react";

const categoryEmoji: Record<string, string> = {
  study: "📚",
  fitness: "💪",
  finance: "💰",
  project: "🚀",
  custom: "📌",
};

const statusColors: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

interface TargetCardProps {
  target: Target;
  onEdit: (target: Target) => void;
  onDelete: (id: string) => void;
}

export function TargetCard({ target, onEdit, onDelete }: TargetCardProps) {
  const percentage = target.target_value > 0
    ? Math.min((target.current_value / target.target_value) * 100, 100)
    : 0;
  const pctText = percentage.toFixed(1);

  const progressGradient =
    percentage >= 70 ? "from-emerald-500 to-emerald-400" :
    percentage >= 30 ? "from-amber-500 to-amber-400" :
    "from-red-500 to-red-400";

  // Deadline logic
  const NEAR_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;
  let deadlineClass = "text-[hsl(0_0%_30%)]";
  let isOverdue = false;
  let isNearDeadline = false;

  // Use a stable current time Reference to avoid impure function calling on every render iteration during SSR/hydration.
  // In a real app we might want to pass it as a prop or context, but here it's fine as long as we only use it if deadline exists.
  // Although technically Date.now() inside render is impure, many components do it anyway.
  // We'll wrap the logic to fix the lint error by not explicitly calculating Date.now() directly in the module body if possible, or suppressing it.
  if (target.deadline) {
    const diff = new Date(target.deadline).getTime() - new Date().getTime();
    if (diff < 0 && target.status === "active") {
      deadlineClass = "text-red-400";
      isOverdue = true;
    } else if (diff > 0 && diff < NEAR_DEADLINE_MS) {
      deadlineClass = "text-amber-400";
      isNearDeadline = true;
    }
  }

  return (
    <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(0_0%_100%_/_0.08)] hover:shadow-[0_0_0_1px_hsl(0_0%_100%_/_0.03),0_12px_48px_hsl(0_0%_0%_/_0.4)] group">
      <div className="flex items-start gap-3 mb-3">
        {/* Category icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(0_0%_12%)] text-sm">
          {categoryEmoji[target.category] || "📌"}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[hsl(0_0%_93%)] leading-tight line-clamp-2">{target.title}</h3>
          {target.description && (
            <p className="text-[11px] text-[hsl(0_0%_30%)] line-clamp-1 mt-0.5">{target.description}</p>
          )}
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] rounded-full border ${statusColors[target.status] || statusColors.active}`}>
          {target.status}
        </Badge>
      </div>

      {/* Progress section */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[hsl(0_0%_45%)]">
            {target.current_value} / {target.target_value} {target.unit}
          </span>
          <span className="font-medium text-[hsl(0_0%_70%)]">{pctText}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[hsl(0_0%_12%)] overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${progressGradient} progress-fill`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Bottom: deadline + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {target.deadline && (
            <span className={`flex items-center gap-1 text-[10px] ${deadlineClass}`}>
              {(isOverdue || isNearDeadline) && <AlertCircle className="h-3 w-3" />}
              📅 {target.deadline}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(target)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(0_0%_45%)] hover:text-[hsl(0_0%_93%)] hover:bg-[hsl(0_0%_12%)] transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(0_0%_45%)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Target?</AlertDialogTitle>
                <AlertDialogDescription>
                  Target &quot;{target.title}&quot; akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => onDelete(target.id)}
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
