import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function log(tag: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}]`, ...args);
}

export async function GET(request: NextRequest) {
  const taskName = request.nextUrl.searchParams.get('task');

  if (!taskName) {
    return NextResponse.json({ error: 'Missing task parameter' }, { status: 400 });
  }

  log('SCHEDULER', `Received trigger for task: "${taskName}"`);

  // Find matching task in database
  const { data: task, error } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('name', taskName)
    .eq('status', 'active')
    .single();

  if (error || !task) {
    log('SCHEDULER', `Task not found or inactive: "${taskName}"`);
    return NextResponse.json({ error: `Task "${taskName}" not found or inactive` }, { status: 404 });
  }

  log('SCHEDULER', `Executing task: "${task.name}" — prompt: "${task.prompt}" — run_once: ${task.run_once}`);

  // Create notification linked to task_id (with fallback if task_id column doesn't exist)
  let notifError: { message: string } | null = null;
  const { error: err1 } = await supabase.from('notifications').insert({
    title: `⏰ Task: ${task.name}`,
    message: task.prompt,
    type: 'info',
    task_id: task.id,
  });
  if (err1) {
    log('SCHEDULER', `Insert with task_id failed (${err1.message}), retrying without task_id...`);
    const { error: err2 } = await supabase.from('notifications').insert({
      title: `⏰ Task: ${task.name}`,
      message: task.prompt,
      type: 'info',
    });
    notifError = err2;
  }

  if (notifError) {
    log('SCHEDULER', `Failed to create notification: ${notifError.message}`);
  } else {
    log('SCHEDULER', `Notification created for task "${task.name}" (task_id: ${task.id})`);
  }

  // Handle one-time tasks: mark completed + delete EasyCron job
  let cleanedUp = false;
  if (task.run_once) {
    log('SCHEDULER', `One-time task "${task.name}" — marking completed and cleaning up EasyCron`);

    // 1. Mark task as completed
    await supabase
      .from('scheduled_tasks')
      .update({ status: 'completed' })
      .eq('id', task.id);

    // 2. Delete EasyCron job if exists
    if (task.easycron_id) {
      try {
        const body = new URLSearchParams();
        body.append('token', process.env.EASYCRON_API_KEY || '');
        body.append('cron_job_id', task.easycron_id);

        const easycronRes = await fetch('https://www.easycron.com/rest/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const easycronData = await easycronRes.json();
        if (easycronData.status === 'success') {
          log('SCHEDULER', `EasyCron job ${task.easycron_id} deleted`);
          cleanedUp = true;
        } else {
          log('SCHEDULER', `EasyCron delete failed: ${JSON.stringify(easycronData)}`);
        }
      } catch (err) {
        log('SCHEDULER', `EasyCron delete error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    } else {
      cleanedUp = true;
    }
  }

  return NextResponse.json({
    status: 'ok',
    task: task.name,
    task_id: task.id,
    prompt: task.prompt,
    run_once: task.run_once,
    completed: task.run_once,
    easycron_deleted: cleanedUp,
    notification_created: !notifError,
    executed_at: new Date().toISOString(),
  });
}
