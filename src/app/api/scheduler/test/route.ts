import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/scheduler/test
 *
 * Manual test endpoint to verify the notification pipeline works.
 * Creates a test notification directly in the database.
 *
 * Usage: visit /api/scheduler/test in the browser.
 * If it returns { inserted: true }, the pipeline is working.
 * Check your notification bell — you should see the test notification.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: Full insert (all columns)
  const { error: e1 } = await supabase.from('notifications').insert({
    title: '🧪 Test notifikasi',
    message: 'Ini test — kalau kamu lihat ini, notification pipeline berfungsi!',
    label: 'Test',
    extra_line: 'Pipeline OK.',
    type: 'info',
  });
  results.full_insert = e1 ? { error: e1.message } : { ok: true };

  // Test 2: Insert without label/extra_line
  if (e1) {
    const { error: e2 } = await supabase.from('notifications').insert({
      title: '🧪 Test notifikasi',
      message: 'Ini test — kalau kamu lihat ini, notification pipeline berfungsi!',
      type: 'info',
    });
    results.minimal_insert = e2 ? { error: e2.message } : { ok: true };
  }

  // Test 3: Check if scheduled_tasks table has expected columns
  const { data: tasks, error: taskErr } = await supabase
    .from('scheduled_tasks')
    .select('id, name, status, model_used, provider_used, run_once')
    .limit(3);
  results.scheduled_tasks = taskErr ? { error: taskErr.message } : { count: tasks?.length ?? 0, sample: tasks };

  // Test 4: Check notification count
  const { count, error: countErr } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true });
  results.notifications_count = countErr ? { error: countErr.message } : { count };

  // Test 5: Check NEXT_PUBLIC_SITE_URL
  results.site_url = process.env.NEXT_PUBLIC_SITE_URL || '(not set — using fallback)';

  const inserted = !e1 || !results.minimal_insert || (results.minimal_insert as { ok?: boolean }).ok;

  return NextResponse.json({
    status: inserted ? 'ok' : 'error',
    message: inserted
      ? 'Test notification created! Check your notification bell.'
      : 'Failed to insert notification. Check errors below.',
    results,
    timestamp: new Date().toISOString(),
  });
}
