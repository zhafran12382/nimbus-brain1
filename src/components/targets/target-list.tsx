"use client";

import { Target } from "@/types";
import { TargetCard } from "./target-card";

interface TargetListProps {
  targets: Target[];
  onEdit: (target: Target) => void;
  onDelete: (id: string) => void;
}

export function TargetList({ targets, onEdit, onDelete }: TargetListProps) {
  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-zinc-500">Belum ada target.</p>
        <p className="text-sm text-zinc-600 mt-1">
          Buat lewat tombol di atas atau chat dengan AI! 💬
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {targets.map((target) => (
        <TargetCard
          key={target.id}
          target={target}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
