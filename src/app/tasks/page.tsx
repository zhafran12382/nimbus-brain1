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

const DOW_NAMES: Record<string, string> = {
  "0": "Minggu", "1": "Senin", "2": "Selasa", "3": "Rabu",
  "4": "Kamis", "5": "Jumat", "6": "Sabtu", "7": "Minggu",
};

const MONTH_NAMES: Record<string, string> = {
  "1": "Januari", "2": "Februari", "3": "Maret", "4": "April",
  "5": "Mei", "6": "Juni", "7": "Juli", "8": "Agustus",
  "9": "September", "10": "Oktober", "11": "November", "12": "Desember",
};

function formatTime(h: string, m: string): string {
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function formatDow(dow: string): string {
  // "1-5" → "Senin-Jumat", "0,6" → "Minggu, Sabtu", "1" → "Senin"
  if (dow.includes("-")) {
    const [start, end] = dow.split("-");
    return `${DOW_NAMES[start] || start}–${DOW_NAMES[end] || end}`;
  }
  if (dow.includes(",")) {
    return dow.split(",").map(d => DOW_NAMES[d.trim()] || d).join(", ");
  }
  return DOW_NAMES[dow] || dow;
}

function formatCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  const isWild = (v: string) => v === "*";
  const isNum = (v: string) => /^\d+$/.test(v);
  const isInterval = (v: string) => v.startsWith("*/");

  // Every N minutes: */5 * * * *
  if (isInterval(min) && isWild(hour) && isWild(dom) && isWild(mon) && isWild(dow)) {
    return `Setiap ${min.slice(2)} menit`;
  }

  // Every N hours: 0 */2 * * *
  if (isNum(min) && isInterval(hour) && isWild(dom) && isWild(mon) && isWild(dow)) {
    return `Setiap ${hour.slice(2)} jam (menit ke-${min})`;
  }

  // Every hour at :MM: 30 * * * *
  if (isNum(min) && isWild(hour) && isWild(dom) && isWild(mon) && isWild(dow)) {
    return `Setiap jam, menit ke-${min}`;
  }

  // Specific time with day-of-week: 0 7 * * 1-5
  if (isNum(min) && isNum(hour) && isWild(dom) && isWild(mon) && !isWild(dow)) {
    return `${formatDow(dow)}, jam ${formatTime(hour, min)}`;
  }

  // Daily at HH:MM: 0 7 * * *
  if (isNum(min) && isNum(hour) && isWild(dom) && isWild(mon) && isWild(dow)) {
    return `Setiap hari jam ${formatTime(hour, min)}`;
  }

  // Specific day of month: 0 9 1 * *
  if (isNum(min) && isNum(hour) && isNum(dom) && isWild(mon) && isWild(dow)) {
    return `Tanggal ${dom} setiap bulan, jam ${formatTime(hour, min)}`;
  }

  // Specific date: 0 9 25 12 *
  if (isNum(min) && isNum(hour) && isNum(dom) && isNum(mon) && isWild(dow)) {
    return `${dom} ${MONTH_NAMES[mon] || `bulan ${mon}`}, jam ${formatTime(hour, min)}`;
  }

  // Specific month+dom+dow patterns
  if (isNum(min) && isNum(hour) && isWild(dom) && isNum(mon) && isWild(dow)) {
    return `Setiap hari di ${MONTH_NAMES[mon] || `bulan ${mon}`}, jam ${formatTime(hour, min)}`;
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
  pending: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  running: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  done: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  cancelled: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paused" | "done">("all");
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

  // Supabase Realtime: listen for task changes (INSERT, UPDATE, DELETE)
  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes" as "system",
        { event: "INSERT", schema: "public", table: "scheduled_tasks" },
        (payload: { new: Record<string, unknown> }) => {
          const newTask = payload.new as unknown as ScheduledTask;
          setTasks((prev) => {
            if (prev.some((t) => t.id === newTask.id)) return prev;
            return [newTask, ...prev];
          });
        }
      )
      .on(
        "postgres_changes" as "system",
        { event: "UPDATE", schema: "public", table: "scheduled_tasks" },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as ScheduledTask;
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
        }
      )
      .on(
        "postgres_changes" as "system",
        { event: "DELETE", schema: "public", table: "scheduled_tasks" },
        (payload: { old: Record<string, unknown> }) => {
          const deleted = payload.old as unknown as { id: string };
          if (deleted.id) {
            setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggleStatus = async (task: ScheduledTask) => {
    const newStatus = task.status === "pending" ? "paused" : "pending";
    setActionLoading(task.id);

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

    await supabase
      .from("scheduled_tasks")
      .delete()
      .eq("id", task.id);

    setActionLoading(null);
    fetchTasks();
  };

  const filtered = tasks;
  const activeCount = tasks.filter((t) => t.status === "pending").length;

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
            {(["all", "pending", "paused", "done"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  filter === f
                    ? "bg-accent-muted text-accent shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {f === "all" ? "Semua" : f === "pending" ? "Aktif" : f === "paused" ? "Dijeda" : "Selesai"}
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
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-medium text-text-primary truncate">{task.name}</h3>
                            {task.run_once && (
                              <span className="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400 uppercase tracking-wider">
                                Sekali
                              </span>
                            )}
                          </div>
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
                        {task.run_once && task.status === "done"
                          ? `Selesai — ${formatCron(task.cron_expression)}`
                          : formatCron(task.cron_expression)}
                      </span>
                      <span>Dibuat {timeAgo(task.created_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {task.status !== "done" && task.status !== "failed" && task.status !== "cancelled" && (
                        <button
                          onClick={() => handleToggleStatus(task)}
                          disabled={actionLoading === task.id}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-hover transition-colors disabled:opacity-50"
                        >
                          {task.status === "pending" || task.status === "running" ? (
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
