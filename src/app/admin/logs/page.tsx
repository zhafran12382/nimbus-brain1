"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ──
interface LogEntry {
  id: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  component: string;
  message: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  durationMs?: number;
  error?: { code: string; message: string; stack?: string };
}

interface LogStats {
  totalLogs: number;
  totalErrors: number;
  errorsByComponent: Record<string, number>;
  errorsByHour: Record<string, number>;
  avgLatency: number;
  slowRequests: number;
}

// ── Constants ──
const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;
const COMPONENTS = ["AI", "SCHEDULER", "TOOL", "NOTIFICATION", "REQUEST", "AUTH", "DB", "PERF", "SYSTEM"] as const;

const LEVEL_STYLES: Record<string, { text: string; bg: string; dot: string }> = {
  DEBUG: { text: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20", dot: "bg-gray-400" },
  INFO: { text: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", dot: "bg-blue-400" },
  WARN: { text: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", dot: "bg-amber-400" },
  ERROR: { text: "text-red-400", bg: "bg-red-400/10 border-red-400/20", dot: "bg-red-400" },
};

const COMPONENT_COLORS: Record<string, string> = {
  AI: "text-purple-400",
  SCHEDULER: "text-cyan-400",
  TOOL: "text-green-400",
  NOTIFICATION: "text-yellow-400",
  REQUEST: "text-blue-400",
  AUTH: "text-red-400",
  DB: "text-orange-400",
  PERF: "text-pink-400",
  SYSTEM: "text-gray-400",
};

const COMPONENT_ICONS: Record<string, string> = {
  AI: "🤖",
  SCHEDULER: "⏰",
  TOOL: "🔧",
  NOTIFICATION: "🔔",
  REQUEST: "🌐",
  AUTH: "🔒",
  DB: "💾",
  PERF: "⚡",
  SYSTEM: "⚙️",
};

// ── Time presets ──
function getTimePreset(preset: string): { startTime: string; endTime: string } {
  const now = new Date();
  const endTime = now.toISOString();

  switch (preset) {
    case "15m": return { startTime: new Date(now.getTime() - 900000).toISOString(), endTime };
    case "1h": return { startTime: new Date(now.getTime() - 3600000).toISOString(), endTime };
    case "6h": return { startTime: new Date(now.getTime() - 21600000).toISOString(), endTime };
    case "24h": return { startTime: new Date(now.getTime() - 86400000).toISOString(), endTime };
    case "7d": return { startTime: new Date(now.getTime() - 604800000).toISOString(), endTime };
    default: return { startTime: "", endTime: "" };
  }
}

// ── Custom Select Component (dark-mode safe) ──
function DarkSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; icon?: string; color?: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 transition-colors min-w-[130px]"
      >
        <span className="flex-1 text-left truncate">
          {selected ? (
            <span className={selected.color}>
              {selected.icon && <span className="mr-1">{selected.icon}</span>}
              {selected.label}
            </span>
          ) : (
            <span className="text-white/40">{placeholder}</span>
          )}
        </span>
        <svg className={`w-3 h-3 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden max-h-[240px] overflow-y-auto">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${!value ? "bg-white/5 text-white" : "text-white/50"}`}
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${value === opt.value ? "bg-white/5" : ""}`}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span className={opt.color || "text-white/80"}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function AdminLogsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [componentFilter, setComponentFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [timePreset, setTimePreset] = useState("24h");
  const [correlationId, setCorrelationId] = useState("");

  // Data
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [dataSource, setDataSource] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"logs" | "stats">("logs");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // ── Auth check ──
  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => {
        setAuthenticated(d.authenticated === true);
        setChecking(false);
      })
      .catch(() => {
        setAuthenticated(false);
        setChecking(false);
      });
  }, []);

  // ── Build query params ──
  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (levelFilter) p.set("level", levelFilter);
    if (componentFilter) p.set("component", componentFilter);
    if (searchQuery) p.set("search", searchQuery);
    if (correlationId) p.set("correlationId", correlationId);

    if (timePreset && timePreset !== "all") {
      const { startTime, endTime } = getTimePreset(timePreset);
      if (startTime) p.set("startTime", startTime);
      if (endTime) p.set("endTime", endTime);
    }

    p.set("limit", "300");
    return p;
  }, [levelFilter, componentFilter, searchQuery, correlationId, timePreset]);

  // ── Fetch logs ──
  const fetchLogs = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const p = buildParams();
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/logs?${p.toString()}`),
        fetch(`/api/logs?stats=true&${p.toString()}`),
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();
      setLogs(logsData.logs || []);
      setTotal(logsData.total || 0);
      setDataSource(logsData.source || "memory");
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [authenticated, buildParams]);

  // ── Auto-refresh ──
  useEffect(() => {
    if (authenticated) fetchLogs();
  }, [authenticated, fetchLogs]);

  useEffect(() => {
    if (autoRefresh && authenticated) {
      intervalRef.current = setInterval(fetchLogs, 5000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [autoRefresh, authenticated, fetchLogs]);

  // ── Clear logs ──
  const handleClear = async () => {
    if (!confirm("Clear all logs? This will clear both in-memory and persisted logs.")) return;
    await fetch("/api/logs", { method: "DELETE" });
    fetchLogs();
  };

  // ── Redirect if not authenticated ──
  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <span className="text-white/50 text-sm">Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-4 bg-white/5 rounded-2xl border border-white/10 p-8">
          <div className="text-4xl">🔒</div>
          <div className="text-white/60 text-sm">Admin access required</div>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-500 transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  const errorCount = stats?.totalErrors || 0;
  const warnCount = logs.filter((l) => l.level === "WARN").length;
  const infoCount = logs.filter((l) => l.level === "INFO").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ─── Header ─── */}
      <header className="border-b border-white/10 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/chat")} className="text-white/40 hover:text-white text-sm transition-colors">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <h1 className="text-base font-semibold hidden sm:block">Nimbus Debug Dashboard</h1>
            <h1 className="text-base font-semibold sm:hidden">Debug</h1>
          </div>
          {/* Data source badge */}
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
            dataSource === 'supabase' 
              ? 'bg-green-400/10 border-green-400/20 text-green-400' 
              : 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400'
          }`}>
            {dataSource === 'supabase' ? '● Persisted' : '● In-Memory'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-white/5 w-3.5 h-3.5"
            />
            <span className="hidden sm:inline">Auto-refresh</span>
            <span className="sm:hidden">Auto</span>
          </label>
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors flex items-center gap-1.5"
            disabled={loading}
          >
            {loading ? (
              <div className="w-3 h-3 border border-white/30 border-t-white/60 rounded-full animate-spin" />
            ) : (
              "🔄"
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 rounded-lg text-xs text-red-400 transition-colors"
          >
            🗑️
          </button>
        </div>
      </header>

      <div className="p-3 lg:p-5 space-y-4 max-w-[1600px] mx-auto">
        {/* ─── Stats Cards ─── */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 lg:gap-3">
          <StatCard label="Total" value={total} icon="📊" />
          <StatCard label="Errors" value={errorCount} icon="❌" color="text-red-400" highlight={errorCount > 0} />
          <StatCard label="Warnings" value={warnCount} icon="⚠️" color="text-amber-400" />
          <StatCard label="Info" value={infoCount} icon="ℹ️" color="text-blue-400" />
          <StatCard label="Avg Latency" value={`${stats?.avgLatency || 0}ms`} icon="⏱️" />
          <StatCard label="Slow Reqs" value={stats?.slowRequests || 0} icon="🐌" color="text-pink-400" highlight={(stats?.slowRequests || 0) > 0} />
        </div>

        {/* ─── Tabs ─── */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === "logs" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
          >
            📋 Logs ({total})
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === "stats" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
          >
            📈 Analytics
          </button>
        </div>

        {/* ─── Filters Bar ─── */}
        <div className="flex flex-wrap items-center gap-2 bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
          <DarkSelect
            value={levelFilter}
            onChange={setLevelFilter}
            placeholder="All Levels"
            options={LEVELS.map((l) => ({
              value: l,
              label: l,
              color: LEVEL_STYLES[l]?.text,
            }))}
          />

          <DarkSelect
            value={componentFilter}
            onChange={setComponentFilter}
            placeholder="All Components"
            options={COMPONENTS.map((c) => ({
              value: c,
              label: c,
              icon: COMPONENT_ICONS[c],
              color: COMPONENT_COLORS[c],
            }))}
          />

          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            {["15m", "1h", "6h", "24h", "7d", "all"].map((t) => (
              <button
                key={t}
                onClick={() => setTimePreset(t)}
                className={`px-2.5 py-1.5 text-[11px] transition-colors ${
                  timePreset === t
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                }`}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[140px] relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {correlationId && (
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 text-xs text-blue-400">
              <span className="font-mono text-[10px] truncate max-w-[120px]">{correlationId}</span>
              <button onClick={() => setCorrelationId("")} className="hover:text-white">✕</button>
            </div>
          )}
        </div>

        {/* ─── Logs Tab ─── */}
        {activeTab === "logs" && (
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#111]/95 backdrop-blur-sm z-10">
                  <tr className="text-white/40 text-left border-b border-white/[0.06]">
                    <th className="px-3 py-2.5 w-[90px] font-medium">Time</th>
                    <th className="px-3 py-2.5 w-[70px] font-medium">Level</th>
                    <th className="px-3 py-2.5 w-[110px] font-medium">Component</th>
                    <th className="px-3 py-2.5 font-medium">Message</th>
                    <th className="px-3 py-2.5 w-[80px] font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.INFO;
                    return (
                      <tr
                        key={log.id}
                        className={`border-b border-white/[0.03] hover:bg-white/[0.04] cursor-pointer transition-colors ${
                          log.level === "ERROR" ? "bg-red-500/[0.03]" : ""
                        } ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-3 py-2 text-white/35 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${style.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            <span className={style.text}>{log.level}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-mono text-[11px] ${COMPONENT_COLORS[log.component] || "text-white/50"}`}>
                            {COMPONENT_ICONS[log.component] || "📦"} {log.component}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-white/70 max-w-[500px]">
                          <div className="truncate">
                            {log.error && <span className="text-red-400 mr-1 text-[10px] font-bold">[{log.error.code}]</span>}
                            {log.message}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-white/30">
                          {log.durationMs !== undefined ? (
                            <span className={log.durationMs > 8000 ? "text-pink-400 font-bold" : log.durationMs > 3000 ? "text-amber-400" : ""}>
                              {log.durationMs}ms
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-16 text-center">
                        <div className="text-white/20 space-y-2">
                          <div className="text-3xl">📭</div>
                          <div className="text-sm">No logs found matching filters</div>
                          <div className="text-[11px] text-white/15">Try adjusting your filters or time range</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/30">
              <span>Showing {logs.length} of {total} logs</span>
              <span>Source: {dataSource}</span>
            </div>
          </div>
        )}

        {/* ─── Stats Tab ─── */}
        {activeTab === "stats" && stats && (
          <div className="space-y-4">
            {/* Error by Component */}
            {Object.keys(stats.errorsByComponent).length > 0 && (
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                  <span>❌</span> Errors by Component
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(stats.errorsByComponent)
                    .sort(([, a], [, b]) => b - a)
                    .map(([comp, count]) => (
                      <button
                        key={comp}
                        onClick={() => { setComponentFilter(comp); setLevelFilter("ERROR"); setActiveTab("logs"); }}
                        className="flex items-center justify-between bg-red-500/[0.05] hover:bg-red-500/10 border border-red-500/10 rounded-lg px-3 py-2.5 transition-colors"
                      >
                        <span className={`text-xs font-mono ${COMPONENT_COLORS[comp] || "text-white/50"}`}>
                          {COMPONENT_ICONS[comp] || "📦"} {comp}
                        </span>
                        <span className="text-sm font-bold text-red-400">{count}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Error Timeline */}
            {Object.keys(stats.errorsByHour).length > 0 && (
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                  <span>📈</span> Error Timeline (by hour)
                </h3>
                <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                  {Object.entries(stats.errorsByHour)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .slice(-24)
                    .map(([hour, count]) => {
                      const maxCount = Math.max(...Object.values(stats.errorsByHour));
                      const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={hour} className="flex flex-col items-center gap-1 min-w-[28px]" title={`${hour}: ${count} errors`}>
                          <span className="text-[9px] text-white/40 font-mono">{count}</span>
                          <div
                            className="w-5 bg-gradient-to-t from-red-600/80 to-red-400/60 rounded-t transition-all"
                            style={{ height: `${Math.max(heightPct, 6)}%` }}
                          />
                          <span className="text-[8px] text-white/25 font-mono">{hour.slice(-2)}h</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Component Activity */}
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
              <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                <span>📊</span> Log Distribution by Component
              </h3>
              <div className="space-y-2">
                {(() => {
                  const byComp: Record<string, number> = {};
                  logs.forEach(l => { byComp[l.component] = (byComp[l.component] || 0) + 1; });
                  const maxVal = Math.max(...Object.values(byComp), 1);
                  return Object.entries(byComp)
                    .sort(([, a], [, b]) => b - a)
                    .map(([comp, count]) => (
                      <div key={comp} className="flex items-center gap-3">
                        <span className={`text-xs font-mono w-28 ${COMPONENT_COLORS[comp] || "text-white/50"}`}>
                          {COMPONENT_ICONS[comp]} {comp}
                        </span>
                        <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              comp === "AI" ? "bg-purple-500/60" :
                              comp === "SCHEDULER" ? "bg-cyan-500/60" :
                              comp === "TOOL" ? "bg-green-500/60" :
                              comp === "AUTH" ? "bg-red-500/60" :
                              "bg-blue-500/60"
                            }`}
                            style={{ width: `${(count / maxVal) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/40 w-10 text-right">{count}</span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Log Detail Modal ─── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-[#111] rounded-2xl border border-white/10 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#111] border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${LEVEL_STYLES[selectedLog.level]?.bg}`}>
                  <span className={LEVEL_STYLES[selectedLog.level]?.text}>{selectedLog.level}</span>
                </span>
                <span className={`text-sm font-mono ${COMPONENT_COLORS[selectedLog.component]}`}>
                  {COMPONENT_ICONS[selectedLog.component]} {selectedLog.component}
                </span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-white/40 hover:text-white text-lg transition-colors">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Timestamp */}
              <div className="text-xs text-white/40 font-mono bg-white/5 rounded-lg px-3 py-2">
                {new Date(selectedLog.timestamp).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" })}
              </div>

              {/* Message */}
              <div className="text-sm text-white/90 leading-relaxed">{selectedLog.message}</div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-3">
                {selectedLog.correlationId && (
                  <button
                    className="flex items-center gap-1.5 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg px-3 py-1.5 hover:bg-blue-500/20 transition-colors"
                    onClick={() => { setCorrelationId(selectedLog.correlationId!); setSelectedLog(null); }}
                  >
                    🔗 <span className="font-mono text-[10px]">{selectedLog.correlationId}</span>
                  </button>
                )}
                {selectedLog.durationMs !== undefined && (
                  <div className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                    ⏱️ <span className={`font-mono ${selectedLog.durationMs > 8000 ? "text-pink-400 font-bold" : "text-white/70"}`}>
                      {selectedLog.durationMs}ms
                    </span>
                  </div>
                )}
              </div>

              {/* Error Details */}
              {selectedLog.error && (
                <div className="bg-red-900/15 border border-red-500/15 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xs font-bold">❌ Error</span>
                    <span className="text-red-400/60 text-xs font-mono bg-red-500/10 px-2 py-0.5 rounded">{selectedLog.error.code}</span>
                  </div>
                  <div className="text-xs text-red-300/80">{selectedLog.error.message}</div>
                  {selectedLog.error.stack && (
                    <pre className="text-[10px] text-red-200/40 overflow-x-auto mt-2 whitespace-pre-wrap font-mono bg-red-900/10 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      {selectedLog.error.stack}
                    </pre>
                  )}
                </div>
              )}

              {/* Data */}
              {selectedLog.data && Object.keys(selectedLog.data).length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-xs text-white/40 mb-2 font-medium">📦 Data</div>
                  <pre className="text-[11px] text-white/60 overflow-x-auto whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                    {JSON.stringify(selectedLog.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat Card Component ──
function StatCard({ label, value, icon, color, highlight }: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border transition-colors ${
      highlight
        ? "bg-red-500/[0.05] border-red-500/20"
        : "bg-white/[0.03] border-white/[0.06]"
    }`}>
      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-lg font-bold mt-1 ${color || "text-white"}`}>{value}</div>
    </div>
  );
}
