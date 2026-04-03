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

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "text-gray-400 bg-gray-400/10",
  INFO: "text-blue-400 bg-blue-400/10",
  WARN: "text-amber-400 bg-amber-400/10",
  ERROR: "text-red-400 bg-red-400/10",
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

// ── Time presets ──
function getTimePreset(preset: string): { startTime: string; endTime: string } {
  const now = new Date();
  const endTime = now.toISOString();

  switch (preset) {
    case "1h": return { startTime: new Date(now.getTime() - 3600000).toISOString(), endTime };
    case "6h": return { startTime: new Date(now.getTime() - 21600000).toISOString(), endTime };
    case "24h": return { startTime: new Date(now.getTime() - 86400000).toISOString(), endTime };
    case "7d": return { startTime: new Date(now.getTime() - 604800000).toISOString(), endTime };
    case "30d": return { startTime: new Date(now.getTime() - 2592000000).toISOString(), endTime };
    default: return { startTime: "", endTime: "" };
  }
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [componentFilter, setComponentFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [timePreset, setTimePreset] = useState("24h");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [correlationId, setCorrelationId] = useState("");

  // Data
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
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

    if (timePreset === "custom") {
      if (customStart) p.set("startTime", new Date(customStart).toISOString());
      if (customEnd) p.set("endTime", new Date(customEnd).toISOString());
    } else if (timePreset) {
      const { startTime, endTime } = getTimePreset(timePreset);
      if (startTime) p.set("startTime", startTime);
      if (endTime) p.set("endTime", endTime);
    }

    p.set("limit", "200");
    return p;
  }, [levelFilter, componentFilter, searchQuery, correlationId, timePreset, customStart, customEnd]);

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
    if (!confirm("Clear all logs?")) return;
    await fetch("/api/logs", { method: "DELETE" });
    fetchLogs();
  };

  // ── Redirect if not authenticated ──
  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/50 text-sm">Checking authentication...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white/50 text-sm">🔒 Admin access required</div>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  const errorCount = stats?.totalErrors || 0;
  const warnCount = logs.filter((l) => l.level === "WARN").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/chat")} className="text-white/40 hover:text-white text-sm">
            ← Back
          </button>
          <h1 className="text-lg font-semibold">🔍 Nimbus Debug Dashboard</h1>
          <span className="text-xs text-white/30">v1.0</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
          <button onClick={fetchLogs} className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded text-xs" disabled={loading}>
            {loading ? "⏳" : "🔄"} Refresh
          </button>
          <button onClick={handleClear} className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 rounded text-xs text-red-400">
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Logs" value={total} />
          <StatCard label="Errors" value={errorCount} color="text-red-400" />
          <StatCard label="Warnings" value={warnCount} color="text-amber-400" />
          <StatCard label="Avg Latency" value={`${stats?.avgLatency || 0}ms`} />
          <StatCard label="Slow Requests" value={stats?.slowRequests || 0} color="text-pink-400" />
          <StatCard
            label="AI Errors"
            value={stats?.errorsByComponent?.AI || 0}
            color="text-purple-400"
          />
        </div>

        {/* Error by Component Chart */}
        {stats && Object.keys(stats.errorsByComponent).length > 0 && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-sm font-medium text-white/60 mb-3">Errors by Component</h3>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.errorsByComponent)
                .sort(([, a], [, b]) => b - a)
                .map(([comp, count]) => (
                  <div key={comp} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <span className={`text-xs font-mono ${COMPONENT_COLORS[comp] || "text-white/50"}`}>{comp}</span>
                    <span className="text-sm font-bold text-red-400">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Error Timeline */}
        {stats && Object.keys(stats.errorsByHour).length > 0 && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-sm font-medium text-white/60 mb-3">Error Timeline (by hour)</h3>
            <div className="flex items-end gap-1 h-20 overflow-x-auto">
              {Object.entries(stats.errorsByHour)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-24)
                .map(([hour, count]) => {
                  const maxCount = Math.max(...Object.values(stats.errorsByHour));
                  const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={hour} className="flex flex-col items-center gap-1 min-w-[24px]" title={`${hour}: ${count} errors`}>
                      <span className="text-[10px] text-white/40">{count}</span>
                      <div
                        className="w-4 bg-red-500/60 rounded-t"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                      <span className="text-[8px] text-white/30">{hour.slice(-2)}h</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
          <h3 className="text-sm font-medium text-white/60">Filters</h3>
          <div className="flex flex-wrap gap-3">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="">All Levels</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="">All Components</option>
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={timePreset}
              onChange={(e) => setTimePreset(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="">All Time</option>
              <option value="1h">Last 1 Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 flex-1 min-w-[180px]"
            />

            <input
              type="text"
              placeholder="Correlation ID..."
              value={correlationId}
              onChange={(e) => setCorrelationId(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 w-[200px]"
            />
          </div>

          {timePreset === "custom" && (
            <div className="flex gap-3">
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
              <span className="text-white/30 text-xs self-center">to</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
          )}
        </div>

        {/* Log Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/10 backdrop-blur">
                <tr className="text-white/50 text-left">
                  <th className="px-3 py-2 w-[180px]">Timestamp</th>
                  <th className="px-3 py-2 w-[70px]">Level</th>
                  <th className="px-3 py-2 w-[100px]">Component</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2 w-[80px]">Duration</th>
                  <th className="px-3 py-2 w-[140px]">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-3 py-1.5 text-white/40 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      <span className="text-white/20">.{log.timestamp.slice(20, 23)}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LEVEL_COLORS[log.level]}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className={`px-3 py-1.5 font-mono ${COMPONENT_COLORS[log.component] || "text-white/50"}`}>
                      {log.component}
                    </td>
                    <td className="px-3 py-1.5 text-white/80 max-w-[400px] truncate">
                      {log.error && <span className="text-red-400 mr-1">[{log.error.code}]</span>}
                      {log.message}
                    </td>
                    <td className="px-3 py-1.5 text-white/40 font-mono">
                      {log.durationMs !== undefined ? `${log.durationMs}ms` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-white/30 font-mono text-[10px] truncate max-w-[140px]">
                      {log.correlationId || "—"}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-white/30">
                      No logs found matching filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-[#141414] rounded-xl border border-white/10 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${LEVEL_COLORS[selectedLog.level]}`}>
                  {selectedLog.level}
                </span>
                <span className={`text-sm font-mono ${COMPONENT_COLORS[selectedLog.component]}`}>
                  {selectedLog.component}
                </span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-white/40 hover:text-white text-lg">✕</button>
            </div>

            <div className="text-xs text-white/40 font-mono">{selectedLog.timestamp}</div>
            <div className="text-sm text-white/90">{selectedLog.message}</div>

            {selectedLog.correlationId && (
              <div className="text-xs">
                <span className="text-white/40">Correlation ID: </span>
                <button
                  className="text-blue-400 hover:underline font-mono"
                  onClick={() => { setCorrelationId(selectedLog.correlationId!); setSelectedLog(null); }}
                >
                  {selectedLog.correlationId}
                </button>
              </div>
            )}

            {selectedLog.durationMs !== undefined && (
              <div className="text-xs text-white/40">
                Duration: <span className="text-white/70">{selectedLog.durationMs}ms</span>
              </div>
            )}

            {selectedLog.error && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 space-y-1">
                <div className="text-xs text-red-400 font-bold">Error: {selectedLog.error.code}</div>
                <div className="text-xs text-red-300">{selectedLog.error.message}</div>
                {selectedLog.error.stack && (
                  <pre className="text-[10px] text-red-200/50 overflow-x-auto mt-2 whitespace-pre-wrap">{selectedLog.error.stack}</pre>
                )}
              </div>
            )}

            {selectedLog.data && Object.keys(selectedLog.data).length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-white/40 mb-2">Data:</div>
                <pre className="text-[11px] text-white/70 overflow-x-auto whitespace-pre-wrap font-mono">
                  {JSON.stringify(selectedLog.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat Card Component ──
function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="text-xs text-white/40">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color || "text-white"}`}>{value}</div>
    </div>
  );
}
