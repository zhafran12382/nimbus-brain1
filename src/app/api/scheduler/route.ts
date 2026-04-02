import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getProviderConfig } from '@/lib/models';
import type { ProviderId } from '@/types';

// Hardcoded AI model for notification upgrade — via OpenRouter routed to Groq
const AI_UPGRADE_MODEL = 'openai/gpt-oss-120b';
const AI_UPGRADE_PROVIDER: ProviderId = 'openrouter-paid';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Debug logging ──
// Collects structured debug entries for both console AND HTTP response
interface DebugEntry { ts: string; tag: string; msg: string; data?: unknown }
function createDebugLog() {
  const entries: DebugEntry[] = [];
  return {
    entries,
    log(tag: string, msg: string, data?: unknown) {
      const ts = new Date().toISOString();
      entries.push({ ts, tag, msg, data });
      if (data !== undefined) {
        console.log(`[${ts}] [SCHEDULER] [${tag}] ${msg}`, typeof data === 'string' ? data : JSON.stringify(data));
      } else {
        console.log(`[${ts}] [SCHEDULER] [${tag}] ${msg}`);
      }
    },
  };
}

// Legacy log helper (still used in some places)
function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SCHEDULER] [${tag}]`, ...args);
}

// ── Flat token budget: 300 max_tokens for all tasks ──
const AI_MAX_TOKENS = 300;

const SYSTEM_PROMPT = `Buat notifikasi pengingat dalam bahasa Indonesia yang natural dan menarik.
Output HANYA JSON valid: {"title":"judul (emoji + max 60 char)","short_label":"max 40 char","message":"isi notifikasi singkat dan jelas","extra_line":"opsional, reinforcement singkat"}
Aturan: title harus pakai emoji relevan, message singkat dan to-the-point. JANGAN sebut AI/sistem/token. Output HANYA JSON.`;

// ── Helpers ──

async function insertNotification(
  title: string,
  message: string,
  taskId?: string,
  label?: string,
  extraLine?: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
): Promise<boolean> {
  // Attempt 1: all columns
  const { error: e1 } = await supabase.from('notifications').insert({
    title, message, type,
    task_id: taskId || null,
    label: label || null,
    extra_line: extraLine || null,
  });
  if (!e1) return true;
  log('INSERT', `Full insert failed: ${e1.message}`);

  // Attempt 2: without label/extra_line (columns may not exist)
  const { error: e2 } = await supabase.from('notifications').insert({
    title, message, type,
    task_id: taskId || null,
  });
  if (!e2) return true;
  log('INSERT', `Without label failed: ${e2.message}`);

  // Attempt 3: absolute minimal (title + message + type + task_id)
  const { error: e3 } = await supabase.from('notifications').insert({
    title, message, type, task_id: taskId || null,
  });
  if (!e3) return true;
  log('INSERT', `Minimal insert failed: ${e3.message}`);

  return false;
}

// ── AI upgrade result type ──
interface AiUpgradeResult {
  success: boolean;
  errorCode?: string;
  errorDetail?: string;
  durationMs: number;
  model?: string;
  providerUsed?: string;
  rawResponse?: string;
  parsedJson?: Record<string, unknown>;
  notificationUpdated?: boolean;
}

async function tryAiUpgrade(
  taskId: string,
  taskName: string,
  prompt: string,
  dbg: ReturnType<typeof createDebugLog>,
): Promise<AiUpgradeResult> {
  const startMs = Date.now();
  const result: AiUpgradeResult = { success: false, durationMs: 0 };

  // ── Step 1: Validate provider config ──
  const provider = getProviderConfig(AI_UPGRADE_PROVIDER);
  dbg.log('AI:CONFIG', `Provider="${AI_UPGRADE_PROVIDER}" Model="${AI_UPGRADE_MODEL}" MaxTokens=${AI_MAX_TOKENS}`);
  dbg.log('AI:CONFIG', `Provider found: ${!!provider}`);

  if (!provider) {
    result.errorCode = 'PROVIDER_NOT_FOUND';
    result.errorDetail = `No provider config for "${AI_UPGRADE_PROVIDER}"`;
    result.durationMs = Date.now() - startMs;
    dbg.log('AI:ERROR', result.errorDetail);
    await insertNotification(
      `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
      `Provider "${AI_UPGRADE_PROVIDER}" tidak ditemukan. Kode: PROVIDER_NOT_FOUND`,
      taskId, undefined, undefined, 'warning',
    );
    return result;
  }

  // ── Step 2: Log provider details ──
  dbg.log('AI:CONFIG', `BaseURL: ${provider.baseUrl}`);
  const headers = provider.getHeaders();
  const authHeader = headers['Authorization'] || headers['authorization'] || '';
  const authMask = authHeader
    ? `${authHeader.slice(0, 12)}...${authHeader.slice(-4)} (len=${authHeader.length})`
    : '(MISSING)';
  dbg.log('AI:CONFIG', `Auth header: ${authMask}`);
  dbg.log('AI:CONFIG', `Headers keys: ${Object.keys(headers).join(', ')}`);

  // ── Step 3: Check env vars ──
  const envCheck = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `set (len=${process.env.OPENROUTER_API_KEY.length})` : 'NOT SET',
    GROQ_API_KEY: process.env.GROQ_API_KEY ? `set (len=${process.env.GROQ_API_KEY.length})` : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || '(unset)',
    VERCEL: process.env.VERCEL || '(unset)',
    VERCEL_ENV: process.env.VERCEL_ENV || '(unset)',
  };
  dbg.log('AI:ENV', 'Environment check', envCheck);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    dbg.log('AI:TIMEOUT', 'AbortController fired after 15s');
    controller.abort();
  }, 15000);

  try {
    // ── Step 4: Build request ──
    const requestBody = {
      model: AI_UPGRADE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Task: "${taskName}"\nUser request: "${prompt}"\n\nGenerate JSON.` },
      ],
      temperature: 0.7,
      max_tokens: AI_MAX_TOKENS,
      provider: { order: ['Groq'], require_parameters: true },
    };
    const requestUrl = `${provider.baseUrl}/chat/completions`;

    dbg.log('AI:REQUEST', `URL: ${requestUrl}`);
    dbg.log('AI:REQUEST', `Body (model/provider)`, {
      model: requestBody.model,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      provider: requestBody.provider,
      messages_count: requestBody.messages.length,
      system_prompt_len: SYSTEM_PROMPT.length,
      user_prompt_len: requestBody.messages[1].content.length,
    });

    // ── Step 5: Make the API call ──
    const fetchStart = Date.now();
    dbg.log('AI:FETCH', 'Sending request...');

    const res = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const fetchMs = Date.now() - fetchStart;
    dbg.log('AI:FETCH', `Response received in ${fetchMs}ms — status=${res.status} statusText="${res.statusText}"`);

    // ── Step 6: Log response headers (OpenRouter metadata) ──
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      // Capture all headers for debugging
      responseHeaders[key] = value;
    });
    dbg.log('AI:RESPONSE_HEADERS', 'All response headers', responseHeaders);

    // OpenRouter-specific headers
    const orModel = res.headers.get('x-model') || res.headers.get('openrouter-model') || '(none)';
    const orProvider = res.headers.get('x-provider') || res.headers.get('openrouter-provider') || '(none)';
    const orProcessing = res.headers.get('x-processing-ms') || res.headers.get('openrouter-processing-ms') || '(none)';
    const orRateLimit = res.headers.get('x-ratelimit-remaining') || '(none)';
    dbg.log('AI:OR_META', `OpenRouter model="${orModel}" provider="${orProvider}" processing=${orProcessing}ms rateLimit=${orRateLimit}`);
    result.model = orModel;
    result.providerUsed = orProvider;

    // ── Step 7: Handle non-OK response ──
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      result.errorCode = `HTTP_${res.status}`;
      result.errorDetail = body.slice(0, 500);
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', `API returned ${res.status} — body: ${body.slice(0, 500)}`);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `HTTP ${res.status}: ${body.slice(0, 100)}. Kode: HTTP_${res.status}`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    // ── Step 8: Parse response JSON ──
    const rawText = await res.text();
    dbg.log('AI:RAW_BODY', `Response body length=${rawText.length} chars`, rawText.slice(0, 1000));

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      result.errorCode = 'RESPONSE_NOT_JSON';
      result.errorDetail = `Failed to parse response as JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
      result.rawResponse = rawText.slice(0, 500);
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', result.errorDetail);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `Response bukan JSON valid. Kode: RESPONSE_NOT_JSON`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    dbg.log('AI:PARSED', 'Response structure', {
      id: data.id,
      object: data.object,
      model: data.model,
      choices_count: Array.isArray(data.choices) ? data.choices.length : 0,
      usage: data.usage,
      error: data.error,
    });

    // Check for API-level error in response body
    if (data.error) {
      result.errorCode = 'API_ERROR_IN_BODY';
      result.errorDetail = JSON.stringify(data.error).slice(0, 500);
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', 'API returned error in body', data.error);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `API error: ${JSON.stringify(data.error).slice(0, 100)}. Kode: API_ERROR`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    // ── Step 9: Extract AI content ──
    const choices = data.choices as Array<{ message?: { content?: string; role?: string }; finish_reason?: string }> | undefined;
    const firstChoice = choices?.[0];
    dbg.log('AI:CHOICE', 'First choice details', {
      finish_reason: firstChoice?.finish_reason,
      role: firstChoice?.message?.role,
      content_length: firstChoice?.message?.content?.length ?? 0,
      content_preview: firstChoice?.message?.content?.slice(0, 200),
    });

    const raw = firstChoice?.message?.content?.trim();
    if (!raw) {
      result.errorCode = 'EMPTY_RESPONSE';
      result.errorDetail = `No content in choices[0].message.content. choices=${JSON.stringify(choices).slice(0, 300)}`;
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', result.errorDetail);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `Respons AI kosong. Kode: EMPTY_RESPONSE`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    result.rawResponse = raw.slice(0, 500);
    dbg.log('AI:CONTENT', `Raw AI content (${raw.length} chars): ${raw}`);

    // ── Step 10: Parse JSON from AI content ──
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    dbg.log('AI:PARSE', `Cleaned content (${cleaned.length} chars): ${cleaned}`);

    const fb = cleaned.indexOf('{');
    const lb = cleaned.lastIndexOf('}');
    dbg.log('AI:PARSE', `JSON braces: first={${fb}} last={${lb}}`);

    if (fb === -1 || lb === -1) {
      result.errorCode = 'INVALID_JSON';
      result.errorDetail = `No JSON braces found. Content: ${cleaned.slice(0, 200)}`;
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', result.errorDetail);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `Respons AI tidak mengandung JSON. Kode: INVALID_JSON`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    const jsonStr = cleaned.substring(fb, lb + 1);
    dbg.log('AI:PARSE', `Extracted JSON string (${jsonStr.length} chars): ${jsonStr}`);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (jsonErr) {
      result.errorCode = 'JSON_PARSE_FAILED';
      result.errorDetail = `JSON.parse failed: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}. String: ${jsonStr.slice(0, 200)}`;
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', result.errorDetail);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `JSON parse gagal. Kode: JSON_PARSE_FAILED`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    result.parsedJson = parsed;
    dbg.log('AI:PARSED_JSON', 'Parsed notification JSON', parsed);

    if (!parsed.title || !parsed.message) {
      result.errorCode = 'MISSING_FIELDS';
      result.errorDetail = `JSON missing title or message. Keys: ${Object.keys(parsed).join(', ')}`;
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:ERROR', result.errorDetail);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `JSON tidak punya field title/message. Kode: MISSING_FIELDS`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return result;
    }

    // ── Step 11: Find existing notification to upgrade ──
    dbg.log('AI:DB', `Looking up notification for task_id="${taskId}"`);
    const { data: existing, error: lookupErr } = await supabase
      .from('notifications')
      .select('id, title, message, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    dbg.log('AI:DB', `Lookup result: found=${!!existing} error=${lookupErr?.message || 'none'}`, existing ? { id: existing.id, title: existing.title } : null);

    if (existing) {
      // ── Step 12: Update notification ──
      const updatePayload = {
        title: String(parsed.title).slice(0, 60),
        message: String(parsed.message).slice(0, 500),
        label: String(parsed.short_label || '').slice(0, 40) || null,
        extra_line: String(parsed.extra_line || '').slice(0, 120) || null,
      };
      dbg.log('AI:DB', 'Updating notification with payload', updatePayload);

      const { error: ue } = await supabase.from('notifications').update(updatePayload).eq('id', existing.id);

      if (ue) {
        dbg.log('AI:DB', `Full update failed: ${ue.message} — trying minimal update`);
        // Fallback: update without label/extra_line
        const minPayload = {
          title: String(parsed.title).slice(0, 60),
          message: String(parsed.message).slice(0, 500),
        };
        const { error: ue2 } = await supabase.from('notifications').update(minPayload).eq('id', existing.id);
        if (ue2) {
          dbg.log('AI:DB', `Minimal update also failed: ${ue2.message}`);
          result.errorCode = 'DB_UPDATE_FAILED';
          result.errorDetail = `Both update attempts failed: ${ue.message} / ${ue2.message}`;
          result.durationMs = Date.now() - startMs;
          result.notificationUpdated = false;
          return result;
        }
        dbg.log('AI:DB', 'Minimal update succeeded (without label/extra_line)');
      } else {
        dbg.log('AI:DB', 'Full update succeeded');
      }

      result.success = true;
      result.notificationUpdated = true;
      result.durationMs = Date.now() - startMs;
      dbg.log('AI:SUCCESS', `Notification upgraded for "${taskName}" in ${result.durationMs}ms`);
    } else {
      result.errorCode = 'NO_NOTIFICATION_FOUND';
      result.errorDetail = `No notification found for task_id="${taskId}" to upgrade`;
      result.durationMs = Date.now() - startMs;
      result.notificationUpdated = false;
      dbg.log('AI:WARN', result.errorDetail);
    }

    return result;
  } catch (err: unknown) {
    const elapsed = Date.now() - startMs;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    result.errorCode = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    result.errorDetail = `${msg}${stack ? `\n${stack}` : ''}`;
    result.durationMs = elapsed;

    dbg.log('AI:EXCEPTION', `AI upgrade failed after ${elapsed}ms`, {
      isTimeout,
      errorName: err instanceof Error ? err.name : '(not Error)',
      errorMessage: msg,
      stack: stack?.slice(0, 500),
    });

    await insertNotification(
      `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
      `${isTimeout ? 'Timeout (>15s)' : msg.slice(0, 100)}. Kode: ${result.errorCode}`.slice(0, 160),
      taskId, undefined, undefined, 'warning',
    );
    return result;
  } finally {
    clearTimeout(timer);
  }
}

// ── Background helpers ──

async function deleteEasyCronJob(easycronId: string): Promise<void> {
  if (!process.env.EASYCRON_API_KEY) {
    log('EASYCRON', `No API key, skipping delete for job ${easycronId}`);
    return;
  }
  try {
    const body = new URLSearchParams();
    body.append('token', process.env.EASYCRON_API_KEY);
    body.append('cron_job_id', easycronId);
    const res = await fetch('https://www.easycron.com/rest/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    log('EASYCRON', `Delete job ${easycronId}: HTTP ${res.status}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('EASYCRON', `Failed to delete job ${easycronId}: ${msg}`);
  }
}

// ── Main handler ──

export async function GET(request: NextRequest) {
  const handlerStart = Date.now();
  const dbg = createDebugLog();
  const taskId = request.nextUrl.searchParams.get('id');
  const taskName = request.nextUrl.searchParams.get('task');

  dbg.log('TRIGGER', `Handler start — id="${taskId}" name="${taskName}" url="${request.nextUrl.pathname}${request.nextUrl.search}"`);

  if (!taskId && !taskName) {
    return NextResponse.json({ error: 'Missing id or task parameter' }, { status: 400 });
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — Fast path (must complete < 2s)
  // Fetch task → insert notification → mark completed → return
  // ═══════════════════════════════════════════════════════════

  // ── STEP 1: Fetch task ──
  let query = supabase.from('scheduled_tasks').select('*');
  if (taskId) {
    query = query.eq('id', taskId);
  } else {
    query = query.eq('name', taskName!);
  }
  const { data: task, error: taskErr } = await query.single();

  if (taskErr || !task) {
    dbg.log('ERROR', `Task not found: ${taskErr?.message || 'no rows'}`);
    return NextResponse.json({ error: 'Task not found', debug: dbg.entries }, { status: 404 });
  }

  if (task.status === 'completed') {
    dbg.log('SKIP', `Task "${task.name}" already completed`);
    return NextResponse.json({ status: 'skipped', reason: 'completed', debug: dbg.entries });
  }

  dbg.log('EXEC', `Task found: "${task.name}" status=${task.status} run_once=${task.run_once} id=${task.id}`);

  // ── STEP 2: Create notification IMMEDIATELY (static content) ──
  const title = `⏰ ${task.name}`.slice(0, 60);
  const message = String(task.prompt).slice(0, 500);

  dbg.log('NOTIFY', `Inserting static notification: title="${title}" message_len=${message.length}`);
  const inserted = await insertNotification(title, message, task.id);

  if (!inserted) {
    dbg.log('FATAL', `All notification insert attempts failed for "${task.name}"`);
    return NextResponse.json({ status: 'error', error: 'notification insert failed', debug: dbg.entries }, { status: 500 });
  }

  dbg.log('OK', `Notification created for "${task.name}"`);

  // ── STEP 3: Mark task completed (if run_once) ──
  let completed = false;
  if (task.run_once) {
    const { error: upErr } = await supabase
      .from('scheduled_tasks')
      .update({ status: 'completed' })
      .eq('id', task.id);

    completed = !upErr;
    if (upErr) dbg.log('ERROR', `Failed to mark completed: ${upErr.message}`);
    else dbg.log('OK', 'Task marked as completed');
  }

  const phase1Ms = Date.now() - handlerStart;
  dbg.log('PHASE1', `Completed in ${phase1Ms}ms — notification=${inserted} completed=${completed}`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — AI upgrade + EasyCron cleanup (awaited)
  // AI upgrade uses openai/gpt-oss-120b via openrouter-paid, routed to Groq.
  // Flat 300 max_tokens. AbortController timeout is 15s.
  // Promise.allSettled ensures both run even if one fails.
  // ═══════════════════════════════════════════════════════════

  dbg.log('PHASE2', 'Starting AI upgrade + EasyCron cleanup');

  const phase2Results = await Promise.allSettled([
    tryAiUpgrade(task.id, task.name, task.prompt, dbg),
    task.run_once && task.easycron_id
      ? deleteEasyCronJob(task.easycron_id)
      : Promise.resolve(),
  ]);

  const aiSettled = phase2Results[0];
  let aiResult: AiUpgradeResult | null = null;
  if (aiSettled.status === 'fulfilled') {
    aiResult = aiSettled.value;
  } else {
    dbg.log('PHASE2', `AI upgrade Promise rejected: ${aiSettled.reason}`);
  }

  const totalMs = Date.now() - handlerStart;
  dbg.log('DONE', `Total handler time: ${totalMs}ms (phase1=${phase1Ms}ms phase2=${totalMs - phase1Ms}ms)`);

  // ── Return response with full debug info ──
  return NextResponse.json({
    status: 'ok',
    task: task.name,
    task_id: task.id,
    notification_created: true,
    run_once: task.run_once,
    completed,
    phase1_ms: phase1Ms,
    total_ms: totalMs,
    executed_at: new Date().toISOString(),
    ai_upgrade: aiResult ? {
      success: aiResult.success,
      error_code: aiResult.errorCode || null,
      error_detail: aiResult.errorDetail?.slice(0, 300) || null,
      duration_ms: aiResult.durationMs,
      model_used: aiResult.model || null,
      provider_used: aiResult.providerUsed || null,
      raw_response_preview: aiResult.rawResponse?.slice(0, 200) || null,
      notification_updated: aiResult.notificationUpdated ?? null,
    } : { success: false, error_code: 'PROMISE_REJECTED', error_detail: String(aiSettled.status === 'rejected' ? aiSettled.reason : 'unknown') },
    debug_log: dbg.entries,
  });
}
