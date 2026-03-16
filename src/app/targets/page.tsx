"use client";

import { useState, useEffect, useCallback } from "react";
import { Target } from "@/types";
import { supabase } from "@/lib/supabase";

import { TargetList } from "@/components/targets/target-list";
import { TargetForm } from "@/components/targets/target-form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Target | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const fetchTargets = useCallback(async () => {
    let query = supabase
      .from("targets")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);

    const { data } = await query;
    if (data) setTargets(data as Target[]);
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchTargets();

    const channel = supabase
      .channel("targets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "targets" },
        () => fetchTargets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTargets]);

  const handleEdit = (target: Target) => {
    setEditTarget(target);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("targets").delete().eq("id", id);
    fetchTargets();
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditTarget(null);
      fetchTargets();
    }
  };

  return (
    <>
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6 border-b border-[hsl(0_0%_100%_/_0.04)]">
        <h1 className="text-base font-semibold text-[hsl(0_0%_93%)]">🎯 Target Manager</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Tambah Target
          </Button>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              <SelectItem value="study">📚 Study</SelectItem>
              <SelectItem value="fitness">💪 Fitness</SelectItem>
              <SelectItem value="finance">💰 Finance</SelectItem>
              <SelectItem value="project">🚀 Project</SelectItem>
              <SelectItem value="custom">📌 Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target list */}
        <TargetList
          targets={targets}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <TargetForm
        open={formOpen}
        onOpenChange={handleFormClose}
        editTarget={editTarget}
      />
    </>
  );
}
