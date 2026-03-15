export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {};

  // Check Supabase env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  checks.supabase = {
    status: supabaseUrl && supabaseKey ? 'ok' : 'missing',
    detail: `URL: ${supabaseUrl ? 'set' : 'missing'}, Key: ${supabaseKey ? 'set' : 'missing'}`,
  };

  // Check Maia env vars
  const maiaUrl = process.env.MAIA_BASE_URL;
  const maiaKey = process.env.MAIA_API_KEY;
  checks.maia = {
    status: maiaUrl && maiaKey ? 'ok' : 'missing',
    detail: `URL: ${maiaUrl ? 'set' : 'missing'}, Key: ${maiaKey ? 'set' : 'missing'}`,
  };

  // Check Tavily env var
  const tavilyKey = process.env.TAVILY_API_KEY;
  checks.tavily = {
    status: tavilyKey ? 'ok' : 'not_set',
    detail: tavilyKey ? 'set (will use Tavily for web search)' : 'not set (will fallback to DuckDuckGo)',
  };

  // Test Maia API connectivity
  if (maiaUrl && maiaKey) {
    try {
      const res = await fetch(`${maiaUrl}/models`, {
        headers: { Authorization: `Bearer ${maiaKey}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.maia_connection = {
        status: res.ok ? 'ok' : 'error',
        detail: res.ok ? 'connected' : `HTTP ${res.status}`,
      };
    } catch (e) {
      checks.maia_connection = {
        status: 'error',
        detail: e instanceof Error ? e.message : 'connection failed',
      };
    }
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok' || c.status === 'not_set');

  return Response.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
}
