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
 * Recovery endpoint for stuck tasks + auto-delete old notifications.
 * 
 * 1. Finds all tasks with status='active', run_once=true, and created_at > 1 hour ago.
 *    Marks them as completed and inserts a notification if one doesn't exist.
 * 2. Deletes notifications older than 7 days.
 *
 * Can be called manually or by a separate cron job.
 */
export async function GET() {
  const startMs = Date.now();
  const STUCK_TASK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  const oneHourAgo = new Date(Date.now() - STUCK_TASK_THRESHOLD_MS).toISOString();

  log('START', `Looking for stuck tasks (run_once + active + created before ${oneHourAgo})`);

  // ── Phase A: Clean up stuck tasks ──

  // Find stuck tasks: active + run_once + created more than 1 hour ago
  const { data: stuckTasks, error: fetchErr } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('status', 'active')
    .eq('run_once', true)
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
    // Mark task as completed
    const { error: updateErr } = await supabase
      .from('scheduled_tasks')
      .update({ status: 'completed' })
      .eq('id', task.id);

    if (updateErr) {
      log('ERROR', `Failed to mark task "${task.name}" (${task.id}) as completed: ${updateErr.message}`);
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

    // Try to delete EasyCron job if exists
    if (task.easycron_id && process.env.EASYCRON_API_KEY) {
      try {
        const body = new URLSearchParams();
        body.append('token', process.env.EASYCRON_API_KEY);
        body.append('cron_job_id', task.easycron_id);
        await fetch('https://www.easycron.com/rest/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        log('EASYCRON', `Deleted orphaned job ${task.easycron_id} for task "${task.name}"`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log('EASYCRON', `Failed to delete job ${task.easycron_id}: ${msg}`);
      }
    }

    cleaned++;
    results.push({ task_id: task.id, name: task.name, completed: true, notification: notifCreated });
    log('CLEANED', `Task "${task.name}" (${task.id}) — completed=true notification=${notifCreated}`);
  }

  const durationMs = Date.now() - startMs;
  log('DONE', `Cleaned ${cleaned}/${stuckTasks.length} tasks in ${durationMs}ms`);

  // ── Phase B: Auto-delete old notifications (older than 7 days) ──
  // Configurable via NOTIFICATION_RETENTION_DAYS env var, defaults to 7
  const NOTIFICATION_RETENTION_DAYS = parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '7', 10);
  const retentionCutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  log('CLEANUP', `Deleting notifications older than ${NOTIFICATION_RETENTION_DAYS} days (before ${retentionCutoff})`);

  const { data: deletedNotifications, error: deleteErr } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', retentionCutoff)
    .select('id');

  const deletedCount = deletedNotifications?.length ?? 0;
  if (deleteErr) {
    log('ERROR', `Failed to delete old notifications: ${deleteErr.message}`);
  } else {
    log('CLEANUP', `Deleted ${deletedCount} notification(s) older than ${NOTIFICATION_RETENTION_DAYS} days`);
  }

  const totalDurationMs = Date.now() - startMs;
  log('DONE', `Total cleanup completed in ${totalDurationMs}ms`);

  return NextResponse.json({
    status: 'ok',
    cleaned,
    total_stuck: stuckTasks.length,
    results,
    notifications_deleted: deletedCount,
    notification_retention_days: NOTIFICATION_RETENTION_DAYS,
    duration_ms: totalDurationMs,
  });
}
