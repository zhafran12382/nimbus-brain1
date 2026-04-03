"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  component: string;
  message: string;
  durationMs?: number;
  error?: { code: string; message: string };
  correlationId?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "text-gray-500",
  INFO: "text-blue-400",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
};

const COMP_COLORS: Record<string, string> = {
  AI: "text-purple-400",
  SCHEDULER: "text-cyan-400",
  TOOL: "text-green-400",
  NOTIFICATION: "text-yellow-400",
  REQUEST: "text-blue-300",
  PERF: "text-pink-400",
};

export function FloatingDebugWindow() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [size, setSize] = useState({ width: 480, height: 360 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [errorCount, setErrorCount] = useState(0);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!isOpen || isMinimized) return;
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filter) params.set("component", filter);
      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setErrorCount((data.logs || []).filter((l: LogEntry) => l.level === "ERROR").length);
    } catch { /* ignore */ }
  }, [isOpen, isMinimized, filter]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isMinimized, fetchLogs]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
      }
      if (isResizing) {
        setSize((prev) => ({
          width: Math.max(320, e.clientX - position.x),
          height: Math.max(200, e.clientY - position.y),
        }));
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position.x, position.y]);

  // Toggle with keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-full w-10 h-10 flex items-center justify-center text-sm shadow-lg"
        title="Open Debug Window (Ctrl+Shift+D)"
      >
        {errorCount > 0 ? (
          <span className="relative">
            🐛
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {errorCount}
            </span>
          </span>
        ) : (
          "🐛"
        )}
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div
        className="fixed z-[9999] bg-[#141414]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl cursor-move"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="text-xs text-white/50">🐛 Debug</span>
          {errorCount > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded">{errorCount} errors</span>
          )}
          <button onClick={() => setIsMinimized(false)} className="text-white/30 hover:text-white text-xs ml-2">□</button>
          <button onClick={() => setIsOpen(false)} className="text-white/30 hover:text-white text-xs">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-[9999] bg-[#0d0d0d]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
    >
      {/* Title bar - draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-white/5 cursor-move select-none border-b border-white/5"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">🐛</span>
          <span className="text-xs font-medium text-white/60">Live Debug</span>
          {errorCount > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">{errorCount} errors</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/10 text-[10px] text-white/60 rounded px-1.5 py-0.5 border-none outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">All</option>
            <option value="AI">AI</option>
            <option value="SCHEDULER">Scheduler</option>
            <option value="TOOL">Tools</option>
            <option value="NOTIFICATION">Notify</option>
            <option value="REQUEST">Request</option>
            <option value="ERROR">Errors</option>
          </select>
          <button onClick={() => setAutoScroll(!autoScroll)} className={`text-[10px] px-1 rounded ${autoScroll ? "text-blue-400" : "text-white/30"}`}>
            {autoScroll ? "↓ Auto" : "↓ Off"}
          </button>
          <button onClick={() => setIsMinimized(true)} className="text-white/30 hover:text-white text-xs">−</button>
          <button onClick={() => setIsOpen(false)} className="text-white/30 hover:text-white text-xs">✕</button>
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5">
        {logs.length === 0 && (
          <div className="text-white/20 text-center py-4">No logs yet...</div>
        )}
        {[...logs].reverse().map((log) => (
          <div key={log.id} className="flex gap-1.5 leading-tight py-0.5 hover:bg-white/5 rounded px-1">
            <span className="text-white/20 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString("id-ID", { hour12: false })}
            </span>
            <span className={`shrink-0 ${LEVEL_COLORS[log.level] || "text-white/40"}`}>
              {log.level.slice(0, 1)}
            </span>
            <span className={`shrink-0 ${COMP_COLORS[log.component] || "text-white/40"}`}>
              [{log.component}]
            </span>
            <span className="text-white/70 break-all">
              {log.message}
              {log.durationMs !== undefined && (
                <span className="text-white/30 ml-1">{log.durationMs}ms</span>
              )}
              {log.error && (
                <span className="text-red-400 ml-1">[{log.error.code}]</span>
              )}
            </span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); }}
      >
        <svg className="w-3 h-3 text-white/20 absolute bottom-0.5 right-0.5" viewBox="0 0 12 12">
          <path d="M11 1v10H1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
