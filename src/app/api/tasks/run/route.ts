import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getProviderConfig } from '@/lib/models';
import { logger } from '@/lib/logger';
import type { ProviderId } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// AI upgrade config — same as scheduler/route.ts
const AI_UPGRADE_MODEL = 'openai/gpt-oss-120b';
const AI_UPGRADE_PROVIDER: ProviderId = 'openrouter-paid';
const AI_MAX_TOKENS = 300;

const SYSTEM_PROMPT = `Buat notifikasi pengingat dalam bahasa Indonesia yang natural dan menarik.
Output HANYA JSON valid: {"title":"judul (emoji + max 60 char)","short_label":"max 40 char","message":"isi notifikasi singkat dan jelas","extra_line":"opsional, reinforcement singkat"}
Aturan: title harus pakai emoji relevan, message singkat dan to-the-point. JANGAN sebut AI/sistem/token. Output HANYA JSON.`;

const MAX_NOTIFICATION_TITLE = 60;
const MAX_NOTIFICATION_MESSAGE = 500;
const MAX_NOTIFICATION_LABEL = 40;
const MAX_NOTIFICATION_EXTRA = 120;
const MAX_ORIGINAL_PROMPT = 2000;

// ── Helpers ──

async function insertNotification(
  title: string,
  message: string,
  taskId?: string,
  label?: string,
  extraLine?: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
): Promise<boolean> {
  const { error: e1 } = await supabase.from('notifications').insert({
    title, message, type,
    task_id: taskId || null,
    label: label || null,
    extra_line: extraLine || null,
  });
  if (!e1) return true;

  // Fallback: without label/extra_line
  const { error: e2 } = await supabase.from('notifications').insert({
    title, message, type,
    task_id: taskId || null,
  });
  if (!e2) return true;

  // Minimal fallback
  const { error: e3 } = await supabase.from('notifications').insert({
    title, message, type,
  });
  return !e3;
}

async function insertSchedulerLog(
  taskId: string,
  taskName: string,
  status: 'done' | 'failed',
  durationMs: number,
  detail?: string,
): Promise<void> {
  try {
    await supabase.from('scheduler_logs').insert({
      task_id: taskId,
      task_name: taskName,
      status,
      duration_ms: durationMs,
      detail: detail?.slice(0, 2000) || null,
      executed_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('SCHEDULER', 'Failed to insert scheduler log', {
      code: 'LOG_INSERT_FAILED',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function tryAiUpgrade(
  taskId: string,
  taskName: string,
  prompt: string,
): Promise<{ success: boolean; isTruncated?: boolean }> {
  const provider = getProviderConfig(AI_UPGRADE_PROVIDER);
  if (!provider) return { success: false };

  const headers = provider.getHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
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

    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!res.ok) return { success: false };

    const data = await res.json();
    const choices = data.choices as Array<{ message?: { content?: string }; finish_reason?: string }> | undefined;
    const firstChoice = choices?.[0];
    const isTruncated = firstChoice?.finish_reason === 'length';
    const raw = firstChoice?.message?.content?.trim();
    if (!raw) return { success: false };

    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const fb = cleaned.indexOf('{');
    const lb = cleaned.lastIndexOf('}');
    if (fb === -1 || lb === -1) return { success: false };

    const parsed = JSON.parse(cleaned.substring(fb, lb + 1));
    if (!parsed.title || !parsed.message) return { success: false };

    // Find the notification for this task and upgrade it
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      const updatePayload = {
        title: String(parsed.title).slice(0, MAX_NOTIFICATION_TITLE),
        message: String(parsed.message).slice(0, MAX_NOTIFICATION_MESSAGE),
        label: String(parsed.short_label || '').slice(0, MAX_NOTIFICATION_LABEL) || null,
        extra_line: String(parsed.extra_line || '').slice(0, MAX_NOTIFICATION_EXTRA) || null,
        is_truncated: isTruncated,
        original_prompt: prompt.slice(0, MAX_ORIGINAL_PROMPT) || null,
      };

      const { error: ue } = await supabase.from('notifications').update(updatePayload).eq('id', existing.id);
      if (ue) {
        // Fallback without is_truncated/original_prompt
        await supabase.from('notifications').update({
          title: updatePayload.title,
          message: updatePayload.message,
          label: updatePayload.label,
          extra_line: updatePayload.extra_line,
        }).eq('id', existing.id);
      }
    }

    return { success: true, isTruncated };
  } catch {
    return { success: false };
  } finally {
    clearTimeout(timer);
  }
}

// ── Main handler ──

/**
 * GET /api/tasks/run
 *
 * Called by VPS worker every 30–60 seconds.
 * Selects due tasks (run_at <= now, status = 'pending'),
 * atomically marks them as 'running' to prevent duplicate execution,
 * executes the AI workflow, and marks them as 'done' or 'failed'.
 * Safe to call repeatedly — concurrency-safe via atomic status update.
 */
export async function GET() {
  const correlationId = logger.createCorrelationId();
  const start = Date.now();
  logger.scheduler('Task run triggered by VPS worker', undefined, correlationId);

  const now = new Date().toISOString();

  // Step 1: Select due tasks (pending + run_at <= now)
  const { data: dueTasks, error: fetchErr } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', now)
    .order('run_at', { ascending: true });

  if (fetchErr) {
    logger.error('SCHEDULER', 'Error fetching due tasks', {
      code: 'TASK_FETCH_ERROR',
      error: fetchErr.message,
      correlationId,
    });
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!dueTasks || dueTasks.length === 0) {
    return NextResponse.json({
      status: 'ok',
      message: 'No tasks due.',
      ran: 0,
      checked_at: now,
    });
  }

  const taskIds = dueTasks.map(t => t.id);

  // Step 2: Atomically mark as 'running' (concurrency safety)
  // Only updates tasks that are still 'pending' — prevents duplicate execution
  const { data: claimed, error: claimErr } = await supabase
    .from('scheduled_tasks')
    .update({ status: 'running' })
    .in('id', taskIds)
    .eq('status', 'pending')
    .select('*');

  if (claimErr) {
    logger.error('SCHEDULER', 'Error claiming tasks', {
      code: 'TASK_CLAIM_ERROR',
      error: claimErr.message,
      correlationId,
    });
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  if (!claimed || claimed.length === 0) {
    // All tasks were already claimed by another worker call
    return NextResponse.json({
      status: 'ok',
      message: 'All due tasks already claimed.',
      ran: 0,
      checked_at: now,
    });
  }

  logger.scheduler(`Claimed ${claimed.length} task(s) for execution`, {
    task_ids: claimed.map(t => t.id),
  }, correlationId);

  // Step 3: Execute each task
  const results: Array<{
    task_id: string;
    task_name: string;
    status: 'done' | 'failed';
    duration_ms: number;
    ai_upgraded: boolean;
  }> = [];

  for (const task of claimed) {
    const taskStart = Date.now();
    let finalStatus: 'done' | 'failed' = 'done';
    let aiUpgraded = false;
    let detail = '';

    try {
      // Insert static notification immediately
      const title = `⏰ ${task.name}`.slice(0, 60);
      const message = String(task.prompt).slice(0, 500);
      const inserted = await insertNotification(title, message, task.id);

      if (!inserted) {
        finalStatus = 'failed';
        detail = 'Notification insert failed';
      } else {
        // Try AI upgrade in background
        const aiResult = await tryAiUpgrade(task.id, task.name, task.prompt);
        aiUpgraded = aiResult.success;
      }
    } catch (err) {
      finalStatus = 'failed';
      detail = err instanceof Error ? err.message : String(err);
      logger.error('SCHEDULER', `Task execution failed: ${task.name}`, {
        code: 'TASK_EXEC_ERROR',
        error: detail,
        correlationId,
      });
    }

    const taskDuration = Date.now() - taskStart;

    // Step 4: Update task status to done or failed
    if (task.run_once || finalStatus === 'done') {
      await supabase
        .from('scheduled_tasks')
        .update({ status: finalStatus })
        .eq('id', task.id);
    } else {
      // For recurring tasks that failed, reset to pending so they can retry
      await supabase
        .from('scheduled_tasks')
        .update({ status: 'pending' })
        .eq('id', task.id);
    }

    // Step 5: Insert scheduler log
    await insertSchedulerLog(task.id, task.name, finalStatus, taskDuration, detail || undefined);

    results.push({
      task_id: task.id,
      task_name: task.name,
      status: finalStatus,
      duration_ms: taskDuration,
      ai_upgraded: aiUpgraded,
    });
  }

  const totalMs = Date.now() - start;
  logger.scheduler(`Task run completed: ${results.length} tasks in ${totalMs}ms`, {
    results: results.map(r => ({ id: r.task_id, status: r.status })),
    correlationId,
  });

  return NextResponse.json({
    status: 'ok',
    ran: results.length,
    results,
    total_ms: totalMs,
    checked_at: now,
  });
}
