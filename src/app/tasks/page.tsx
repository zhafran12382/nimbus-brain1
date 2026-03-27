"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Trash2,
  Pause,
  Play,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { ScheduledTask } from "@/types";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

function formatCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  // Every N minutes
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Setiap ${min.slice(2)} menit`;
  }
  // Every hour at :MM
  if (!min.includes("*") && !min.includes("/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Setiap jam, menit ke-${min}`;
  }
  // Daily at HH:MM
  if (!min.includes("*") && !hour.includes("*") && dom === "*" && mon === "*" && dow === "*") {
    return `Setiap hari jam ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  // Weekdays
  if (!min.includes("*") && !hour.includes("*") && dom === "*" && mon === "*" && dow === "1-5") {
    return `Senin-Jumat jam ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  return cron;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  completed: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "completed">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("scheduled_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    if (data) setTasks(data as ScheduledTask[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleStatus = async (task: ScheduledTask) => {
    const newStatus = task.status === "active" ? "paused" : "active";
    setActionLoading(task.id);

    // If has easycron_id, toggle on EasyCron too
    if (task.easycron_id) {
      try {
        const endpoint = newStatus === "active" ? "enable" : "disable";
        const body = new URLSearchParams();
        body.append("token", ""); // Token is server-side only, use API route
        await fetch(`/api/tasks/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, action: endpoint }),
        }).catch(() => {});
      } catch {
        // Best effort — update DB regardless
      }
    }

    await supabase
      .from("scheduled_tasks")
      .update({ status: newStatus })
      .eq("id", task.id);

    setActionLoading(null);
    fetchTasks();
  };

  const handleDelete = async (task: ScheduledTask) => {
    if (!confirm(`Hapus task "${task.name}"?`)) return;
    setActionLoading(task.id);

    // Delete from EasyCron if exists
    if (task.easycron_id) {
      try {
        const body = new URLSearchParams();
        body.append("token", "");
        await fetch(`/api/tasks/delete-cron`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id }),
        }).catch(() => {});
      } catch {
        // Best effort
      }
    }

    await supabase
      .from("scheduled_tasks")
      .delete()
      .eq("id", task.id);

    setActionLoading(null);
    fetchTasks();
  };

  const filtered = tasks;
  const activeCount = tasks.filter((t) => t.status === "active").length;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Header title="Task Manager">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTasks}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </Header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Stats Bar */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-medium">{activeCount} aktif</span>
            </div>
            <div className="text-text-muted">{tasks.length} total task</div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-[hsl(0_0%_7%)] border border-border-subtle w-fit">
            {(["all", "active", "paused", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  filter === f
                    ? "bg-accent-muted text-accent shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {f === "all" ? "Semua" : f === "active" ? "Aktif" : f === "paused" ? "Dijeda" : "Selesai"}
              </button>
            ))}
          </div>

          {/* Task List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                  <div className="h-4 w-48 rounded bg-[hsl(0_0%_15%)] mb-2" />
                  <div className="h-3 w-72 rounded bg-[hsl(0_0%_12%)]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="h-12 w-12 text-text-muted mb-3 opacity-30" />
              <p className="text-sm text-text-muted mb-1">Belum ada scheduled task</p>
              <p className="text-xs text-text-muted/60">Minta AI untuk membuat jadwal otomatis melalui chat</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((task) => {
                const sc = statusColors[task.status] || statusColors.active;
                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card rounded-xl p-4 space-y-3"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
                          <Clock className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium text-text-primary truncate">{task.name}</h3>
                          <p className="text-xs text-text-muted truncate">{task.prompt}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {task.status}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatCron(task.cron_expression)}
                      </span>
                      <span>Dibuat {timeAgo(task.created_at)}</span>
                      {task.easycron_id && (
                        <span className="text-blue-400/60">EasyCron #{task.easycron_id.slice(0, 8)}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {task.status !== "completed" && (
                        <button
                          onClick={() => handleToggleStatus(task)}
                          disabled={actionLoading === task.id}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-hover transition-colors disabled:opacity-50"
                        >
                          {task.status === "active" ? (
                            <>
                              <Pause className="h-3 w-3" /> Jeda
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" /> Aktifkan
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(task)}
                        disabled={actionLoading === task.id}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" /> Hapus
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
