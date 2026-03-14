"use client";

import { Target } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Pencil, Trash2 } from "lucide-react";

const categoryColors: Record<string, string> = {
  study: "bg-blue-600",
  fitness: "bg-green-600",
  finance: "bg-amber-600",
  project: "bg-purple-600",
  custom: "bg-zinc-600",
};

const statusColors: Record<string, string> = {
  active: "bg-blue-600",
  completed: "bg-green-600",
  failed: "bg-red-600",
  paused: "bg-amber-600",
};

interface TargetCardProps {
  target: Target;
  onEdit: (target: Target) => void;
  onDelete: (id: string) => void;
}

export function TargetCard({ target, onEdit, onDelete }: TargetCardProps) {
  const percentage = target.target_value > 0
    ? (target.current_value / target.target_value) * 100
    : 0;
  const pctText = percentage.toFixed(1);

  const progressColor =
    percentage >= 70 ? "bg-green-500" :
    percentage >= 30 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-semibold text-zinc-100 leading-tight">{target.title}</h3>
            {target.description && (
              <p className="text-xs text-zinc-500 line-clamp-2">{target.description}</p>
            )}
          </div>
          <Badge className={categoryColors[target.category] || categoryColors.custom}>
            {target.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">
              {target.current_value}/{target.target_value} {target.unit}
            </span>
            <span className="font-medium text-zinc-300">{pctText}%</span>
          </div>
          <Progress value={percentage} indicatorClassName={progressColor} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {target.deadline && (
              <span className="text-xs text-zinc-500">📅 {target.deadline}</span>
            )}
            <Badge variant="outline" className={`text-xs border-0 ${statusColors[target.status]}`}>
              {target.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(target)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
      </CardContent>
    </Card>
  );
}
