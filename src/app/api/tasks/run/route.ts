import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getNextRunAt } from '@/lib/cron-utils';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/tasks/run
 *
 * VPS cron worker endpoint. Called every 30–60 seconds by an external VPS.
 * Selects due tasks, claims them atomically, executes the AI workflow,
 * updates statuses, and inserts logs into scheduler_logs.
 *
 * Authentication: requires CRON_SECRET via query param `key` or header `x-cron-secret`.
 *
 * Safe to call repeatedly — concurrent calls cannot execute the same task twice
 * thanks to the atomic status update (pending → running WHERE status = 'pending').
 */
export async function GET(request: NextRequest) {
  // ── Auth: allow requests that provide the correct CRON_SECRET ──
  const keyParam = request.nextUrl.searchParams.get('key') || '';
  const headerSecret = request.headers.get('x-cron-secret') || '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const secretBuf = Buffer.from(cronSecret);
  const keyMatch =
    keyParam.length === cronSecret.length &&
    timingSafeEqual(Buffer.from(keyParam), secretBuf);
  const headerMatch =
    headerSecret.length === cronSecret.length &&
    timingSafeEqual(Buffer.from(headerSecret), secretBuf);

  if (!keyMatch && !headerMatch) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const correlationId = logger.createCorrelationId();
  const start = Date.now();
  logger.scheduler('VPS worker triggered', undefined, correlationId);

  const now = new Date().toISOString();

  // ── Step 1: Fetch due tasks ──
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
      duration_ms: Date.now() - start,
    });
  }

  logger.scheduler(`Found ${dueTasks.length} due task(s)`, { count: dueTasks.length }, correlationId);

  // ── Step 2: Atomically claim tasks (pending → running) ──
  const taskIds = dueTasks.map((t) => t.id);
  const { data: claimed, error: claimErr } = await supabase
    .from('scheduled_tasks')
    .update({ status: 'running' })
    .in('id', taskIds)
    .eq('status', 'pending')
    .select();

  if (claimErr) {
    logger.error('SCHEDULER', 'Error claiming tasks', {
      code: 'TASK_CLAIM_ERROR',
      error: claimErr.message,
      correlationId,
    });
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({
      status: 'ok',
      message: 'Tasks already claimed by another worker.',
      ran: 0,
      duration_ms: Date.now() - start,
    });
  }

  logger.scheduler(`Claimed ${claimed.length} task(s)`, { claimed: claimed.length }, correlationId);

  // ── Step 3: Execute each claimed task ──
  const results: Array<{
    task_id: string;
    task_name: string;
    status: string;
    duration_ms: number;
  }> = [];

  for (const task of claimed) {
    const taskStart = Date.now();

    try {
      logger.scheduler(`Executing task: ${task.name}`, { task_id: task.id }, correlationId);

      // Trigger scheduler endpoint (notification creation + AI upgrade in one flow)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nimbus-brain.vercel.app';
      try {
        const schedulerRes = await fetch(`${siteUrl}/api/scheduler?id=${task.id}`);
        if (!schedulerRes.ok) {
          logger.warn('SCHEDULER', `AI upgrade returned ${schedulerRes.status} for "${task.name}"`, undefined, correlationId);
        }
      } catch (aiErr) {
        // AI upgrade is best-effort; notification was already created
        logger.warn('SCHEDULER', `AI upgrade failed for "${task.name}": ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`, undefined, correlationId);
      }

      // Determine next status
      if (task.run_once) {
        // One-time task: mark as done
        await supabase
          .from('scheduled_tasks')
          .update({ status: 'done' })
          .eq('id', task.id);
      } else {
        // Recurring task: compute next run_at and reset to pending
        const nextRunAt = getNextRunAt(task.cron_expression);
        await supabase
          .from('scheduled_tasks')
          .update({
            status: 'pending',
            run_at: nextRunAt,
          })
          .eq('id', task.id);
      }

      // Insert scheduler log
      const taskDuration = Date.now() - taskStart;
      await supabase.from('scheduler_logs').insert({
        task_id: task.id,
        task_name: task.name,
        status: 'done',
        message: `Task "${task.name}" executed successfully`,
        duration_ms: taskDuration,
      });

      results.push({
        task_id: task.id,
        task_name: task.name,
        status: 'done',
        duration_ms: taskDuration,
      });

      logger.scheduler(`Task "${task.name}" completed`, { task_id: task.id, duration_ms: taskDuration }, correlationId);
    } catch (err) {
      const taskDuration = Date.now() - taskStart;
      const errMsg = err instanceof Error ? err.message : String(err);

      // Mark as failed
      await supabase
        .from('scheduled_tasks')
        .update({ status: 'failed' })
        .eq('id', task.id);

      // Insert failure log
      await supabase.from('scheduler_logs').insert({
        task_id: task.id,
        task_name: task.name,
        status: 'failed',
        message: `Error: ${errMsg}`.slice(0, 1000),
        duration_ms: taskDuration,
      });

      results.push({
        task_id: task.id,
        task_name: task.name,
        status: 'failed',
        duration_ms: taskDuration,
      });

      logger.error('SCHEDULER', `Task "${task.name}" failed: ${errMsg}`, {
        code: 'TASK_EXEC_ERROR',
        error: errMsg,
        correlationId,
      });
    }
  }

  const totalMs = Date.now() - start;
  logger.scheduler(`Worker run completed: ${results.length} task(s)`, { results: results.length, duration_ms: totalMs }, correlationId);

  return NextResponse.json({
    status: 'ok',
    ran: results.length,
    results,
    duration_ms: totalMs,
  });
}
