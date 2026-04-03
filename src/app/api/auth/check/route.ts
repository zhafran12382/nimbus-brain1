import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.PASSWORD || 'nimbus-brain-default-secret-change-me';
}

function verifySessionToken(token: string): { username: string } | null {
  try {
    const [encoded, hmac] = token.split('.');
    if (!encoded || !hmac) return null;

    const payload = Buffer.from(encoded, 'base64url').toString('utf-8');
    const secret = getSessionSecret();
    const expectedHmac = createHmac('sha256', secret).update(payload).digest('hex');

    if (hmac !== expectedHmac) return null;

    const parsed = JSON.parse(payload);
    if (parsed.exp && Date.now() > parsed.exp) return null;

    return { username: parsed.username };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const correlationId = logger.createCorrelationId();
  logger.auth('Session check started', undefined, correlationId);

  const token = req.cookies.get('nimbus-session')?.value;

  if (!token) {
    logger.auth('Session check failed: no token', undefined, correlationId);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    logger.auth('Session check failed: invalid token', undefined, correlationId);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  logger.auth('Session check succeeded', { username: session.username }, correlationId);
  return NextResponse.json({ authenticated: true, username: session.username });
}
