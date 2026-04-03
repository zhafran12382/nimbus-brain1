import { NextRequest, NextResponse } from 'next/server';
import { queryLogsAsync, getLogStatsAsync, clearLogsAsync, isSupabaseAvailable, type LogQuery } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/logs - Query logs with filters (async, tries Supabase first)
 * Query params: level, component, correlationId, search, startTime, endTime, limit, offset
 * 
 * GET /api/logs?stats=true - Get log statistics
 * GET /api/logs?stats=true&startTime=...&endTime=... - Stats with time filter
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Stats mode
  if (params.get('stats') === 'true') {
    const stats = await getLogStatsAsync(
      params.get('startTime') || undefined,
      params.get('endTime') || undefined,
    );
    return NextResponse.json(stats);
  }

  // Query mode
  const query: LogQuery = {};
  const level = params.get('level');
  const component = params.get('component');
  if (level) query.level = level as LogQuery['level'];
  if (component) query.component = component as LogQuery['component'];
  if (params.get('correlationId')) query.correlationId = params.get('correlationId')!;
  if (params.get('search')) query.search = params.get('search')!;
  if (params.get('startTime')) query.startTime = params.get('startTime')!;
  if (params.get('endTime')) query.endTime = params.get('endTime')!;
  if (params.get('limit')) query.limit = parseInt(params.get('limit')!, 10);
  if (params.get('offset')) query.offset = parseInt(params.get('offset')!, 10);

  const result = await queryLogsAsync(query);
  return NextResponse.json({
    ...result,
    supabaseAvailable: isSupabaseAvailable(),
  });
}

/**
 * DELETE /api/logs - Clear all logs (memory + Supabase)
 */
export async function DELETE() {
  await clearLogsAsync();
  return NextResponse.json({ success: true, message: 'Logs cleared' });
}
