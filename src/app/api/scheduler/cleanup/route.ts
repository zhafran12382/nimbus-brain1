import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SCHEDULER] [CLEANUP] [${tag}]`, ...args);
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  if (tag === 'ERROR') {
    logger.error('SCHEDULER', `[CLEANUP] [${tag}] ${msg}`, { code: `CLEANUP_${tag}`, error: msg });
  } else {
    logger.debug('SCHEDULER', `[CLEANUP] [${tag}] ${msg}`);
  }
}

/**
 * GET /api/scheduler/cleanup
 *
 * Recovery endpoint for stuck tasks.
 * Finds all tasks with status='active', run_once=true, and created_at > 1 hour ago.
 * Marks them as completed and inserts a notification if one doesn't exist.
 *
 * Can be called manually or by a separate cron job to recover from timeout failures.
 */
export async function GET() {
  const startMs = Date.now();
  const STUCK_TASK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  const oneHourAgo = new Date(Date.now() - STUCK_TASK_THRESHOLD_MS).toISOString();

  log('START', `Looking for stuck tasks (running status + created before ${oneHourAgo})`);

  // Find stuck tasks: running + created more than 1 hour ago (likely stuck)
  const { data: stuckTasks, error: fetchErr } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('status', 'running')
    .lt('created_at', oneHourAgo);

  if (fetchErr) {
    log('ERROR', `Failed to fetch stuck tasks: ${fetchErr.message}`);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!stuckTasks || stuckTasks.length === 0) {
    log('OK', 'No stuck tasks found');
    return NextResponse.json({
      status: 'ok',
      message: 'No stuck tasks found',
      cleaned: 0,
      duration_ms: Date.now() - startMs,
    });
  }

  log('FOUND', `${stuckTasks.length} stuck task(s)`);

  let cleaned = 0;
  const results: Array<{ task_id: string; name: string; completed: boolean; notification: boolean }> = [];

  for (const task of stuckTasks) {
    // Mark task as failed (stuck tasks are failures)
    const { error: updateErr } = await supabase
      .from('scheduled_tasks')
      .update({ status: 'failed' })
      .eq('id', task.id);

    if (updateErr) {
      log('ERROR', `Failed to mark task "${task.name}" (${task.id}) as failed: ${updateErr.message}`);
      results.push({ task_id: task.id, name: task.name, completed: false, notification: false });
      continue;
    }

    // Check if a notification already exists for this task
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('task_id', task.id)
      .limit(1)
      .single();

    let notifCreated = false;
    if (!existingNotif) {
      // Insert a recovery notification
      const title = `⏰ ${task.name}`.slice(0, 60);
      const message = String(task.prompt).slice(0, 160);

      const { error: insertErr } = await supabase.from('notifications').insert({
        title,
        message,
        type: 'info',
        task_id: task.id,
      });

      if (insertErr) {
        log('ERROR', `Failed to insert recovery notification for "${task.name}": ${insertErr.message}`);
        // Try minimal insert without task_id
        const { error: insertErr2 } = await supabase.from('notifications').insert({
          title,
          message,
          type: 'info',
        });
        notifCreated = !insertErr2;
        if (insertErr2) {
          log('ERROR', `Minimal notification insert also failed: ${insertErr2.message}`);
        }
      } else {
        notifCreated = true;
      }
    } else {
      log('SKIP', `Notification already exists for task "${task.name}"`);
      notifCreated = true; // Already existed
    }

    cleaned++;
    results.push({ task_id: task.id, name: task.name, completed: true, notification: notifCreated });
    log('CLEANED', `Task "${task.name}" (${task.id}) — completed=true notification=${notifCreated}`);
  }

  const durationMs = Date.now() - startMs;
  log('DONE', `Cleaned ${cleaned}/${stuckTasks.length} tasks in ${durationMs}ms`);

  return NextResponse.json({
    status: 'ok',
    cleaned,
    total_stuck: stuckTasks.length,
    results,
    duration_ms: durationMs,
  });
}
