import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RESCHEDULE] [${tag}]`, ...args);
}

/**
 * POST /api/scheduler/reschedule
 *
 * Reschedules a task by updating its cron expression and
 * creating/editing the EasyCron job so it fires at the new time.
 *
 * Body: { task_id: string, date: "YYYY-MM-DD", time: "HH:MM" }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { task_id, date, time } = body as { task_id?: string; date?: string; time?: string };

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
  log('PARSE', `task_id=${task_id} date=${date} time=${time} cron=${cronExpression}`);

  // Fetch existing task
  const { data: task, error: taskErr } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('id', task_id)
    .single();

  if (taskErr || !task) {
    log('ERROR', `Task not found: ${taskErr?.message || 'no rows'}`);
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nimbus-brain.vercel.app';
  const schedulerUrl = `${siteUrl}/api/scheduler?id=${task.id}`;

  let newEasycronId = task.easycron_id;

  if (task.easycron_id) {
    // Edit existing EasyCron job
    log('EASYCRON', `Editing existing job ${task.easycron_id} with cron=${cronExpression}`);
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
        log('EASYCRON', `Edit failed: ${JSON.stringify(data)}`);
        // If edit failed (job might have been deleted), create a new one
        newEasycronId = null;
      } else {
        log('EASYCRON', `Edit succeeded for job ${task.easycron_id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('EASYCRON', `Edit request failed: ${msg}`);
      newEasycronId = null;
    }
  }

  if (!newEasycronId) {
    // Create new EasyCron job
    log('EASYCRON', `Creating new job for task ${task.id} with cron=${cronExpression}`);
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
        log('EASYCRON', `Created new job ${newEasycronId}`);
      } else {
        log('EASYCRON', `Create failed: ${JSON.stringify(data)}`);
        return NextResponse.json(
          { error: `EasyCron error: ${data.error || data.message || 'unknown'}` },
          { status: 502 },
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('EASYCRON', `Create request failed: ${msg}`);
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
    log('ERROR', `Failed to update task: ${updateErr.message}`);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }

  log('OK', `Task "${task.name}" rescheduled to ${cronExpression} (easycron=${newEasycronId})`);

  return NextResponse.json({
    status: 'ok',
    task_id: task.id,
    cron_expression: cronExpression,
    easycron_id: newEasycronId,
  });
}
