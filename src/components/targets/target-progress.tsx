"use client";

import { Target } from "@/types";
import { Progress } from "@/components/ui/progress";

interface TargetProgressProps {
  target: Target;
}

export function TargetProgress({ target }: TargetProgressProps) {
  const percentage = target.target_value > 0
    ? (target.current_value / target.target_value) * 100
    : 0;

  const progressColor =
    percentage >= 70 ? "bg-green-500" :
    percentage >= 30 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">
          {target.current_value}/{target.target_value} {target.unit}
        </span>
        <span className="font-medium text-zinc-300">{percentage.toFixed(1)}%</span>
      </div>
      <Progress value={percentage} indicatorClassName={progressColor} />
    </div>
  );
}
