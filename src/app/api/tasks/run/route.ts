import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const now = new Date();

  const { data: dueTasks, error } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true });

  if (error) {
    console.error('[CRON] Error fetching tasks:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueTasks || dueTasks.length === 0) {
    return NextResponse.json({ message: 'No tasks due.', ran: 0 });
  }

  let ranCount = 0;
  for (const task of dueTasks) {
    console.log(`[CRON] Running task: ${task.name} (${task.id})`);

    await supabase.from('notifications').insert({
      title: `Task Dijalankan: ${task.name}`,
      message: `Prompt: "${task.prompt}" telah dieksekusi sesuai jadwal.`,
      type: 'info',
    });

    const updateData: Record<string, unknown> = {
      last_run_at: now.toISOString(),
    };

    if (task.repeat === 'none') {
      updateData.status = 'completed';
      updateData.next_run_at = null;
    } else {
      const nextRun = new Date(task.next_run_at || task.schedule_time);

      while (nextRun <= now) {
        if (task.repeat === 'daily') nextRun.setDate(nextRun.getDate() + 1);
        else if (task.repeat === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
        else if (task.repeat === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
      }
      updateData.next_run_at = nextRun.toISOString();
    }

    await supabase
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', task.id);

    ranCount++;
  }

  console.log(`[CRON] Completed: ${ranCount} tasks ran.`);
  return NextResponse.json({ message: `Ran ${ranCount} tasks.`, ran: ranCount });
}
