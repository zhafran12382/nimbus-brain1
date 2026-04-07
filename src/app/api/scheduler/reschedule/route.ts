import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduler/reschedule
 *
 * Reschedules a task by updating its cron expression and
 * computing the new run_at timestamp.
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
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if (
    [month, day, hour, minute].some((v) => v == null || isNaN(v)) ||
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    return NextResponse.json({ error: 'Invalid date or time values' }, { status: 400 });
  }

  // Cron fires at this exact minute/hour/day/month. Since run_once=true,
  // the task will be marked as done after execution.
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

  // Compute run_at from the specific date/time
  const runAt = new Date(year, month - 1, day, hour, minute).toISOString();

  // Update task in database
  const { error: updateErr } = await supabase
    .from('scheduled_tasks')
    .update({
      cron_expression: cronExpression,
      status: 'pending',
      run_once: true,
      run_at: runAt,
    })
    .eq('id', task.id);

  if (updateErr) {
    logger.error('SCHEDULER', 'Failed to update task in DB', { code: 'DB_UPDATE_FAIL', error: updateErr.message, correlationId });
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }

  logger.scheduler('Task rescheduled successfully', { task_id: task.id, task_name: task.name, cronExpression, run_at: runAt, durationMs: Date.now() - start }, correlationId);

  return NextResponse.json({
    status: 'ok',
    task_id: task.id,
    cron_expression: cronExpression,
    run_at: runAt,
  });
}
