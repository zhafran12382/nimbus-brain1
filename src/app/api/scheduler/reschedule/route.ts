import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduler/reschedule
 *
 * Reschedules a task by updating its cron expression and
 * creating/editing the EasyCron job so it fires at the new time.
 *
 * Body: { task_id: string, date: "YYYY-MM-DD", time: "HH:MM" }
 */
export async function POST(request: NextRequest) {
  const correlationId = logger.createCorrelationId();
  const start = Date.now();
  const body = await request.json();
  const { task_id, date, time } = body as { task_id?: string; date?: string; time?: string };

  logger.scheduler('Reschedule request received', { task_id, date, time }, correlationId);

  if (!task_id || !date || !time) {
    return NextResponse.json({ error: 'Missing task_id, date, or time' }, { status: 400 });
  }

  // Parse date and time
  const [, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if (
    [month, day, hour, minute].some((v) => v == null || isNaN(v)) ||
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    return NextResponse.json({ error: 'Invalid date or time values' }, { status: 400 });
  }

  // Cron fires at this exact minute/hour/day/month. Since run_once=true,
  // the scheduler marks the task completed after first trigger and deletes the EasyCron job.
  const cronExpression = `${minute} ${hour} ${day} ${month} *`;
  logger.scheduler('Parsed cron expression', { task_id, cronExpression }, correlationId);

  // Fetch existing task
  const { data: task, error: taskErr } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('id', task_id)
    .single();

  if (taskErr || !task) {
    logger.error('SCHEDULER', 'Task not found', { code: 'TASK_NOT_FOUND', error: taskErr?.message, correlationId });
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nimbus-brain.vercel.app';
  const schedulerUrl = `${siteUrl}/api/scheduler?id=${task.id}`;

  let newEasycronId = task.easycron_id;

  if (task.easycron_id) {
    logger.scheduler('Editing existing EasyCron job', { easycron_id: task.easycron_id, cronExpression }, correlationId);
    try {
      const params = new URLSearchParams();
      params.append('token', process.env.EASYCRON_API_KEY || '');
      params.append('cron_job_id', task.easycron_id);
      params.append('cron_expression', cronExpression);
      params.append('url', schedulerUrl);

      const res = await fetch('https://www.easycron.com/rest/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await res.json();
      if (data.status !== 'success') {
        logger.error('SCHEDULER', 'EasyCron edit failed', { code: 'EASYCRON_EDIT_FAIL', data: { response: data }, correlationId });
        // If edit failed (job might have been deleted), create a new one
        newEasycronId = null;
      } else {
        logger.scheduler('EasyCron edit succeeded', { easycron_id: task.easycron_id }, correlationId);
      }
    } catch (err: unknown) {
      logger.error('SCHEDULER', 'EasyCron edit request failed', { code: 'EASYCRON_EDIT_ERROR', error: err instanceof Error ? err : String(err), correlationId });
      newEasycronId = null;
    }
  }

  if (!newEasycronId) {
    logger.scheduler('Creating new EasyCron job', { task_id: task.id, cronExpression }, correlationId);
    try {
      const params = new URLSearchParams();
      params.append('token', process.env.EASYCRON_API_KEY || '');
      params.append('url', schedulerUrl);
      params.append('cron_expression', cronExpression);

      const res = await fetch('https://www.easycron.com/rest/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await res.json();

      if (data.status === 'success' && data.cron_job_id) {
        newEasycronId = String(data.cron_job_id);
        logger.scheduler('EasyCron job created', { easycron_id: newEasycronId }, correlationId);
      } else {
        logger.error('SCHEDULER', 'EasyCron create failed', { code: 'EASYCRON_CREATE_FAIL', data: { response: data }, correlationId });
        return NextResponse.json(
          { error: `EasyCron error: ${data.error || data.message || 'unknown'}` },
          { status: 502 },
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('SCHEDULER', 'EasyCron create request failed', { code: 'EASYCRON_CREATE_ERROR', error: err instanceof Error ? err : msg, correlationId });
      return NextResponse.json({ error: `EasyCron unreachable: ${msg}` }, { status: 502 });
    }
  }

  // Update task in database
  const { error: updateErr } = await supabase
    .from('scheduled_tasks')
    .update({
      cron_expression: cronExpression,
      status: 'active',
      run_once: true,
      easycron_id: newEasycronId,
    })
    .eq('id', task.id);

  if (updateErr) {
    logger.error('SCHEDULER', 'Failed to update task in DB', { code: 'DB_UPDATE_FAIL', error: updateErr.message, correlationId });
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }

  logger.scheduler('Task rescheduled successfully', { task_id: task.id, task_name: task.name, cronExpression, easycron_id: newEasycronId, durationMs: Date.now() - start }, correlationId);

  return NextResponse.json({
    status: 'ok',
    task_id: task.id,
    cron_expression: cronExpression,
    easycron_id: newEasycronId,
  });
}
