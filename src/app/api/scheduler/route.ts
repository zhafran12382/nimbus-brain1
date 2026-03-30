import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getProviderConfig } from '@/lib/models';
import type { ProviderId } from '@/types';

// Hardcoded AI model for notification upgrade — always use this model
const AI_UPGRADE_MODEL = 'openai/gpt-oss-120b';
const AI_UPGRADE_PROVIDER: ProviderId = 'openrouter';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SCHEDULER] [${tag}]`, ...args);
}

const NOTIFICATION_SYSTEM_PROMPT = `Generate a short notification reminder in Indonesian.
Context: User created a scheduled task earlier. Now it's time to remind them.
Output ONLY valid JSON: {"title":"...","short_label":"...","message":"...","extra_line":"..."}
Rules: title max 60 chars, short_label max 40 chars, message max 160 chars referencing user intent, extra_line max 120 chars optional reinforcement.
Do not mention AI, system, scheduling, tokens, or tools. Keep natural and short. Output ONLY JSON.`;

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

async function tryAiUpgrade(
  taskId: string,
  taskName: string,
  prompt: string,
): Promise<void> {
  const startMs = Date.now();
  const provider = getProviderConfig(AI_UPGRADE_PROVIDER);
  if (!provider) {
    log('AI', `No provider config for "${AI_UPGRADE_PROVIDER}", skipping AI upgrade`);
    await insertNotification(
      `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
      `Provider "${AI_UPGRADE_PROVIDER}" tidak ditemukan. Kode: PROVIDER_NOT_FOUND`,
      taskId, undefined, undefined, 'warning',
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    log('AI', `Starting AI upgrade for "${taskName}" model=${AI_UPGRADE_MODEL} provider=${AI_UPGRADE_PROVIDER}`);

    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: provider.getHeaders(),
      body: JSON.stringify({
        model: AI_UPGRADE_MODEL,
        messages: [
          { role: 'system', content: NOTIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: `Task: "${taskName}"\nUser request: "${prompt}"\n\nGenerate JSON.` },
        ],
        temperature: 0.7,
        max_tokens: 300,
        provider: { require_parameters: true },
        route: 'fallback',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      log('AI', `API returned ${res.status} for task "${taskName}" (${Date.now() - startMs}ms) body=${body.slice(0, 300)}`);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `API mengembalikan error HTTP ${res.status}. Kode: HTTP_${res.status}`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return;
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      log('AI', `Empty AI response for task "${taskName}" (${Date.now() - startMs}ms) data=${JSON.stringify(data).slice(0, 300)}`);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `Respons AI kosong atau tidak valid. Kode: EMPTY_RESPONSE`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return;
    }

    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const fb = cleaned.indexOf('{');
    const lb = cleaned.lastIndexOf('}');
    if (fb === -1 || lb === -1) {
      log('AI', `No JSON found in AI response for task "${taskName}"`);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `Respons AI tidak mengandung JSON valid. Kode: INVALID_JSON`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return;
    }

    const parsed = JSON.parse(cleaned.substring(fb, lb + 1));
    if (!parsed.title || !parsed.message) {
      log('AI', `Parsed JSON missing title/message for task "${taskName}"`);
      await insertNotification(
        `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
        `JSON dari AI tidak memiliki field title/message. Kode: MISSING_FIELDS`.slice(0, 160),
        taskId, undefined, undefined, 'warning',
      );
      return;
    }

    // Find the most recent notification for this task and update it
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Try full update
      const { error: ue } = await supabase.from('notifications').update({
        title: String(parsed.title).slice(0, 60),
        message: String(parsed.message).slice(0, 160),
        label: String(parsed.short_label || '').slice(0, 40) || null,
        extra_line: String(parsed.extra_line || '').slice(0, 120) || null,
      }).eq('id', existing.id);

      if (ue) {
        log('AI', `Failed to update notification with label/extra_line fields: ${ue.message}, trying minimal update`);
        // Fallback: update without label/extra_line
        const { error: ue2 } = await supabase.from('notifications').update({
          title: String(parsed.title).slice(0, 60),
          message: String(parsed.message).slice(0, 160),
        }).eq('id', existing.id);
        if (ue2) {
          log('AI', `Minimal update also failed: ${ue2.message}`);
        }
      }
      log('AI', `Notification upgraded for "${taskName}" (${Date.now() - startMs}ms)`);
    } else {
      log('AI', `No existing notification found for task ${taskId} to upgrade`);
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - startMs;
    const msg = err instanceof Error ? err.message : String(err);
    log('AI', `AI upgrade failed for "${taskName}" after ${elapsed}ms: ${msg}`);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const errorCode = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    await insertNotification(
      `⚠️ AI upgrade gagal — ${taskName}`.slice(0, 60),
      `${isTimeout ? 'Request timeout (>15s)' : msg.slice(0, 100)}. Kode: ${errorCode}`.slice(0, 160),
      taskId, undefined, undefined, 'warning',
    );
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
  const taskId = request.nextUrl.searchParams.get('id');
  const taskName = request.nextUrl.searchParams.get('task');

  if (!taskId && !taskName) {
    return NextResponse.json({ error: 'Missing id or task parameter' }, { status: 400 });
  }

  log('TRIGGER', `id="${taskId}" name="${taskName}"`);

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
    log('ERROR', `Task not found: ${taskErr?.message || 'no rows'}`);
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (task.status === 'completed') {
    log('SKIP', `Task "${task.name}" already completed`);
    return NextResponse.json({ status: 'skipped', reason: 'completed' });
  }

  log('EXEC', `"${task.name}" status=${task.status} run_once=${task.run_once}`);

  // ── STEP 2: Create notification IMMEDIATELY (static content) ──
  const title = `⏰ ${task.name}`.slice(0, 60);
  const message = String(task.prompt).slice(0, 160);

  const inserted = await insertNotification(title, message, task.id);

  if (!inserted) {
    log('FATAL', `All notification insert attempts failed for "${task.name}"`);
    return NextResponse.json({ status: 'error', error: 'notification insert failed' }, { status: 500 });
  }

  log('OK', `Notification created for "${task.name}"`);

  // ── STEP 3: Mark task completed (if run_once) ──
  let completed = false;
  if (task.run_once) {
    const { error: upErr } = await supabase
      .from('scheduled_tasks')
      .update({ status: 'completed' })
      .eq('id', task.id);

    completed = !upErr;
    if (upErr) log('ERROR', `Failed to mark completed: ${upErr.message}`);
  }

  const phase1Ms = Date.now() - handlerStart;
  log('PHASE1', `Completed in ${phase1Ms}ms — notification=${inserted} completed=${completed}`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — AI upgrade + EasyCron cleanup (awaited before response)
  // AI upgrade uses hardcoded openai/gpt-oss-120b via openrouter.
  // Both are time-bounded (AI aborts at 15s) so this won't cause timeout.
  // Using Promise.allSettled ensures both run even if one throws.
  // ═══════════════════════════════════════════════════════════

  await Promise.allSettled([
    tryAiUpgrade(task.id, task.name, task.prompt),
    task.run_once && task.easycron_id
      ? deleteEasyCronJob(task.easycron_id)
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    status: 'ok',
    task: task.name,
    task_id: task.id,
    notification_created: true,
    run_once: task.run_once,
    completed,
    phase1_ms: phase1Ms,
    executed_at: new Date().toISOString(),
  });
}
