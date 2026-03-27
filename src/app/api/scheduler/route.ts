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

  log('SCHEDULER', `Executing task: "${task.name}" — prompt: "${task.prompt}"`);

  // Send notification about the executed task
  await supabase.from('notifications').insert({
    title: `⏰ Task: ${task.name}`,
    message: task.prompt,
    type: 'info',
  });

  log('SCHEDULER', `Task "${task.name}" executed, notification sent.`);

  return NextResponse.json({
    status: 'ok',
    task: task.name,
    prompt: task.prompt,
    executed_at: new Date().toISOString(),
  });
}
