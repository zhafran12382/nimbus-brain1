/**
 * Centralized Logging System for Nimbus Brain
 * 
 * Features:
 * - Structured log format: [TIMESTAMP] [COMPONENT] [LEVEL] message key=value
 * - Correlation ID tracking for end-to-end request tracing
 * - In-memory log store with size limits
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

// ── In-Memory Log Store ──

const MAX_LOGS = 5000; // Keep last 5000 entries in memory
const logs: LogEntry[] = [];
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

// ── Core log function ──

function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const fullEntry: LogEntry = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    ...entry,
    data: entry.data ? sanitizeData(entry.data) : undefined,
  };

  // Add to in-memory store
  logs.push(fullEntry);
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }

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

export function queryLogs(query: LogQuery = {}): { logs: LogEntry[]; total: number } {
  let filtered = [...logs];

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

  // Sort by newest first
  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = filtered.length;
  const offset = query.offset || 0;
  const limit = query.limit || 100;

  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  };
}

export function getLogStats(startTime?: string, endTime?: string): LogStats {
  let filtered = [...logs];
  if (startTime) filtered = filtered.filter(l => l.timestamp >= startTime);
  if (endTime) filtered = filtered.filter(l => l.timestamp <= endTime);

  const errors = filtered.filter(l => l.level === 'ERROR');
  
  const errorsByComponent: Record<string, number> = {};
  const errorsByHour: Record<string, number> = {};
  
  for (const err of errors) {
    // By component
    errorsByComponent[err.component] = (errorsByComponent[err.component] || 0) + 1;
    // By hour
    const hour = err.timestamp.slice(0, 13); // "2026-04-03T10"
    errorsByHour[hour] = (errorsByHour[hour] || 0) + 1;
  }

  const durations = filtered.filter(l => l.durationMs !== undefined).map(l => l.durationMs!);
  const avgLatency = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const slowRequests = durations.filter(d => d > 8000).length;

  return {
    totalLogs: filtered.length,
    totalErrors: errors.length,
    errorsByComponent,
    errorsByHour,
    avgLatency,
    slowRequests,
  };
}

/** Get all logs (for export/debugging) */
export function getAllLogs(): LogEntry[] {
  return [...logs];
}

/** Clear all logs */
export function clearLogs(): void {
  logs.length = 0;
}
