/**
 * Centralized Logging System for Nimbus Brain
 * 
 * Features:
 * - Structured log format: [TIMESTAMP] [COMPONENT] [LEVEL] message key=value
 * - Correlation ID tracking for end-to-end request tracing
 * - Dual storage: in-memory (fast) + Supabase (persistent)
 * - Security masking for sensitive data
 * - Level-based filtering (DEBUG/INFO/WARN/ERROR)
 * - Component-specific loggers (AI, Scheduler, Tool, Notification, etc.)
 * - Performance metrics tracking
 */

// ── Types ──

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogComponent = 
  | 'AI' 
  | 'SCHEDULER' 
  | 'TOOL' 
  | 'NOTIFICATION' 
  | 'REQUEST' 
  | 'AUTH' 
  | 'DB' 
  | 'PERF'
  | 'SYSTEM';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  message: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  durationMs?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface LogStats {
  totalLogs: number;
  totalErrors: number;
  errorsByComponent: Record<string, number>;
  errorsByHour: Record<string, number>;
  avgLatency: number;
  slowRequests: number;
}

// ── In-Memory Log Store (fast fallback) ──

const MAX_MEMORY_LOGS = 2000;
const memoryLogs: LogEntry[] = [];
let logIdCounter = 0;

function generateLogId(): string {
  logIdCounter++;
  return `log_${Date.now()}_${logIdCounter}`;
}

function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Security: Mask sensitive data ──

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization', 'cookie', 'session'];

function maskValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();
  if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
    if (typeof value === 'string') {
      if (value.length <= 8) return '***MASKED***';
      return `${value.slice(0, 4)}...${value.slice(-4)} (len=${value.length})`;
    }
    return '***MASKED***';
  }
  return value;
}

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = maskValue(key, value);
    }
  }
  return sanitized;
}

// ── Format for console output ──

function formatLogLine(entry: LogEntry): string {
  let line = `[${entry.timestamp}] [${entry.component}] [${entry.level}] ${entry.message}`;
  
  if (entry.correlationId) {
    line += ` correlation_id=${entry.correlationId}`;
  }
  if (entry.durationMs !== undefined) {
    line += ` duration=${entry.durationMs}ms`;
  }
  if (entry.data) {
    const pairs = Object.entries(entry.data)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    if (pairs) line += ` ${pairs}`;
  }
  if (entry.error) {
    line += ` error_code=${entry.error.code} error_msg=${entry.error.message}`;
  }
  
  return line;
}

// ── Supabase persistence (async, non-blocking) ──

let supabaseClient: { from: (table: string) => unknown } | null = null;
let supabaseAvailable = true; // optimistic; flipped to false on first failure

function getSupabase() {
  if (!supabaseAvailable) return null;
  if (supabaseClient) return supabaseClient;
  try {
    // Dynamically import to avoid circular deps and edge-runtime issues
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      supabaseAvailable = false;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch {
    supabaseAvailable = false;
    return null;
  }
}

/** Persist a single log entry to Supabase (fire-and-forget) */
function persistToSupabase(entry: LogEntry): void {
  try {
    const sb = getSupabase();
    if (!sb) return;

    const row = {
      log_id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      component: entry.component,
      message: entry.message.slice(0, 2000), // cap message length
      data: entry.data ? JSON.stringify(entry.data) : null,
      correlation_id: entry.correlationId || null,
      duration_ms: entry.durationMs ?? null,
      error_code: entry.error?.code || null,
      error_message: entry.error?.message || null,
      error_stack: entry.error?.stack?.slice(0, 4000) || null,
    };

    // Fire-and-forget: don't await, don't block
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).from('debug_logs').insert(row).then(({ error }: { error: unknown }) => {
      if (error) {
        // If table doesn't exist or permission denied, disable Supabase logging silently
        supabaseAvailable = false;
      }
    }).catch(() => {
      supabaseAvailable = false;
    });
  } catch {
    // Silently ignore - Supabase persistence is best-effort
  }
}

// ── Core log function ──

function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const fullEntry: LogEntry = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    ...entry,
    data: entry.data ? sanitizeData(entry.data) : undefined,
  };

  // Add to in-memory store
  memoryLogs.push(fullEntry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.splice(0, memoryLogs.length - MAX_MEMORY_LOGS);
  }

  // Persist to Supabase (non-blocking)
  persistToSupabase(fullEntry);

  // Console output
  const line = formatLogLine(fullEntry);
  const isProd = process.env.NODE_ENV === 'production';

  switch (fullEntry.level) {
    case 'ERROR':
      console.error(line);
      if (fullEntry.error?.stack && !isProd) {
        console.error(fullEntry.error.stack);
      }
      break;
    case 'WARN':
      console.warn(line);
      break;
    case 'DEBUG':
      if (!isProd) console.log(line);
      break;
    default:
      console.log(line);
  }

  return fullEntry;
}

// ── Public API ──

export const logger = {
  /** Create a new correlation ID for request tracking */
  createCorrelationId: generateCorrelationId,

  /** Debug level - development only in console, always stored */
  debug(component: LogComponent, message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'DEBUG', component, message, data, correlationId });
  },

  /** Info level - always shown */
  info(component: LogComponent, message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component, message, data, correlationId });
  },

  /** Warning level */
  warn(component: LogComponent, message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'WARN', component, message, data, correlationId });
  },

  /** Error level with structured error info */
  error(component: LogComponent, message: string, opts: {
    code: string;
    error?: Error | string;
    data?: Record<string, unknown>;
    correlationId?: string;
    durationMs?: number;
  }) {
    const errMsg = opts.error instanceof Error ? opts.error.message : (opts.error || message);
    const stack = opts.error instanceof Error ? opts.error.stack : undefined;
    return addLog({
      level: 'ERROR',
      component,
      message,
      data: opts.data,
      correlationId: opts.correlationId,
      durationMs: opts.durationMs,
      error: { code: opts.code, message: errMsg, stack },
    });
  },

  /** Performance logging */
  perf(message: string, durationMs: number, data?: Record<string, unknown>, correlationId?: string) {
    const level: LogLevel = durationMs > 8000 ? 'WARN' : 'INFO';
    return addLog({
      level,
      component: 'PERF',
      message: durationMs > 8000 ? `SLOW_REQUEST: ${message}` : message,
      durationMs,
      data,
      correlationId,
    });
  },

  /** AI-specific logging */
  ai(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'AI', message, data, correlationId });
  },

  /** Scheduler-specific logging */
  scheduler(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'SCHEDULER', message, data, correlationId });
  },

  /** Tool execution logging */
  tool(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'TOOL', message, data, correlationId });
  },

  /** Notification pipeline logging */
  notification(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'NOTIFICATION', message, data, correlationId });
  },

  /** Request lifecycle logging */
  request(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'REQUEST', message, data, correlationId });
  },

  /** Auth-specific logging */
  auth(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'AUTH', message, data, correlationId });
  },

  /** Database operation logging */
  db(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'DB', message, data, correlationId });
  },

  /** System-level logging */
  system(message: string, data?: Record<string, unknown>, correlationId?: string) {
    return addLog({ level: 'INFO', component: 'SYSTEM', message, data, correlationId });
  },
};

// ── Query API for Dashboard ──

export interface LogQuery {
  level?: LogLevel;
  component?: LogComponent;
  correlationId?: string;
  search?: string;
  startTime?: string; // ISO timestamp
  endTime?: string;   // ISO timestamp
  limit?: number;
  offset?: number;
}

/**
 * Query logs from Supabase (persistent) with fallback to in-memory.
 * Supabase is tried first; if unavailable, falls back to memory store.
 */
export async function queryLogsAsync(query: LogQuery = {}): Promise<{ logs: LogEntry[]; total: number; source: 'supabase' | 'memory' }> {
  // Try Supabase first
  try {
    const sb = getSupabase();
    if (sb) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (sb as any).from('debug_logs').select('*', { count: 'exact' });

      if (query.level) q = q.eq('level', query.level);
      if (query.component) q = q.eq('component', query.component);
      if (query.correlationId) q = q.eq('correlation_id', query.correlationId);
      if (query.startTime) q = q.gte('timestamp', query.startTime);
      if (query.endTime) q = q.lte('timestamp', query.endTime);
      if (query.search) q = q.ilike('message', `%${query.search}%`);

      q = q.order('timestamp', { ascending: false });

      const limit = query.limit || 200;
      const offset = query.offset || 0;
      q = q.range(offset, offset + limit - 1);

      const { data, count, error } = await q;
      if (!error && data) {
        const logs: LogEntry[] = data.map((row: Record<string, unknown>) => ({
          id: row.log_id as string || row.id as string,
          timestamp: row.timestamp as string,
          level: row.level as LogLevel,
          component: row.component as LogComponent,
          message: row.message as string,
          data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data as string) : row.data) : undefined,
          correlationId: (row.correlation_id as string) || undefined,
          durationMs: (row.duration_ms as number) ?? undefined,
          error: (row.error_code as string) ? {
            code: row.error_code as string,
            message: (row.error_message as string) || '',
            stack: (row.error_stack as string) || undefined,
          } : undefined,
        }));
        return { logs, total: count || logs.length, source: 'supabase' };
      }
    }
  } catch {
    // Fall through to memory
  }

  // Fallback: in-memory
  return { ...queryLogsSync(query), source: 'memory' };
}

/** Synchronous query from in-memory store only */
export function queryLogsSync(query: LogQuery = {}): { logs: LogEntry[]; total: number } {
  let filtered = [...memoryLogs];

  if (query.level) {
    filtered = filtered.filter(l => l.level === query.level);
  }
  if (query.component) {
    filtered = filtered.filter(l => l.component === query.component);
  }
  if (query.correlationId) {
    filtered = filtered.filter(l => l.correlationId === query.correlationId);
  }
  if (query.search) {
    const s = query.search.toLowerCase();
    filtered = filtered.filter(l => 
      l.message.toLowerCase().includes(s) ||
      JSON.stringify(l.data || {}).toLowerCase().includes(s) ||
      (l.error?.message || '').toLowerCase().includes(s)
    );
  }
  if (query.startTime) {
    filtered = filtered.filter(l => l.timestamp >= query.startTime!);
  }
  if (query.endTime) {
    filtered = filtered.filter(l => l.timestamp <= query.endTime!);
  }

  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = filtered.length;
  const offset = query.offset || 0;
  const limit = query.limit || 200;

  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  };
}

/** Legacy synchronous query - kept for backward compatibility */
export function queryLogs(query: LogQuery = {}): { logs: LogEntry[]; total: number } {
  return queryLogsSync(query);
}

/**
 * Get log statistics. Tries Supabase first, falls back to in-memory.
 */
export async function getLogStatsAsync(startTime?: string, endTime?: string): Promise<LogStats & { source: string }> {
  // Try Supabase first
  try {
    const sb = getSupabase();
    if (sb) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (sb as any).from('debug_logs').select('level, component, timestamp, duration_ms');
      if (startTime) q = q.gte('timestamp', startTime);
      if (endTime) q = q.lte('timestamp', endTime);
      q = q.order('timestamp', { ascending: false }).limit(5000);

      const { data, error } = await q;
      if (!error && data) {
        return { ...computeStats(data.map((row: Record<string, unknown>) => ({
          level: row.level as string,
          component: row.component as string,
          timestamp: row.timestamp as string,
          durationMs: (row.duration_ms as number) ?? undefined,
        }))), source: 'supabase' };
      }
    }
  } catch {
    // Fall through
  }

  return { ...getLogStatsSync(startTime, endTime), source: 'memory' };
}

function computeStats(entries: { level: string; component: string; timestamp: string; durationMs?: number }[]): LogStats {
  const errors = entries.filter(l => l.level === 'ERROR');
  
  const errorsByComponent: Record<string, number> = {};
  const errorsByHour: Record<string, number> = {};
  
  for (const err of errors) {
    errorsByComponent[err.component] = (errorsByComponent[err.component] || 0) + 1;
    const hour = err.timestamp.slice(0, 13);
    errorsByHour[hour] = (errorsByHour[hour] || 0) + 1;
  }

  const durations = entries.filter(l => l.durationMs !== undefined).map(l => l.durationMs!);
  const avgLatency = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const slowRequests = durations.filter(d => d > 8000).length;

  return {
    totalLogs: entries.length,
    totalErrors: errors.length,
    errorsByComponent,
    errorsByHour,
    avgLatency,
    slowRequests,
  };
}

/** Synchronous stats from in-memory only */
export function getLogStatsSync(startTime?: string, endTime?: string): LogStats {
  let filtered = [...memoryLogs];
  if (startTime) filtered = filtered.filter(l => l.timestamp >= startTime);
  if (endTime) filtered = filtered.filter(l => l.timestamp <= endTime);

  return computeStats(filtered.map(l => ({
    level: l.level,
    component: l.component,
    timestamp: l.timestamp,
    durationMs: l.durationMs,
  })));
}

/** Legacy sync stats - kept for backward compatibility */
export function getLogStats(startTime?: string, endTime?: string): LogStats {
  return getLogStatsSync(startTime, endTime);
}

/** Get all logs (for export/debugging) */
export function getAllLogs(): LogEntry[] {
  return [...memoryLogs];
}

/** Clear all logs (both memory and Supabase) */
export async function clearLogsAsync(): Promise<void> {
  memoryLogs.length = 0;
  try {
    const sb = getSupabase();
    if (sb) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).from('debug_logs').delete().neq('id', 0);
    }
  } catch {
    // Ignore Supabase errors
  }
}

/** Legacy sync clear - only clears memory */
export function clearLogs(): void {
  memoryLogs.length = 0;
}

/** Check if Supabase persistence is available */
export function isSupabaseAvailable(): boolean {
  return supabaseAvailable;
}

/**
 * SQL to create the debug_logs table in Supabase:
 * 
 * CREATE TABLE IF NOT EXISTS debug_logs (
 *   id BIGSERIAL PRIMARY KEY,
 *   log_id TEXT NOT NULL,
 *   timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
 *   component TEXT NOT NULL,
 *   message TEXT NOT NULL,
 *   data JSONB,
 *   correlation_id TEXT,
 *   duration_ms INTEGER,
 *   error_code TEXT,
 *   error_message TEXT,
 *   error_stack TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_debug_logs_timestamp ON debug_logs (timestamp DESC);
 * CREATE INDEX idx_debug_logs_level ON debug_logs (level);
 * CREATE INDEX idx_debug_logs_component ON debug_logs (component);
 * CREATE INDEX idx_debug_logs_correlation ON debug_logs (correlation_id);
 * 
 * -- Auto-cleanup: keep only last 7 days
 * -- Run periodically or use pg_cron
 * -- DELETE FROM debug_logs WHERE timestamp < NOW() - INTERVAL '7 days';
 */
