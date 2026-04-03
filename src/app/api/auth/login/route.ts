import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Simple session-based auth using signed cookies.
 * Credentials are read from environment variables USERNAME and PASSWORD.
 */

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.PASSWORD || 'nimbus-brain-default-secret-change-me';
}

function createSessionToken(username: string): string {
  const payload = JSON.stringify({ username, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }); // 7 days
  const secret = getSessionSecret();
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${hmac}`;
}

export async function POST(req: NextRequest) {
  const correlationId = logger.createCorrelationId();
  const start = Date.now();

  try {
    const { username, password } = await req.json();

    const expectedUsername = process.env.USERNAME;
    const expectedPassword = process.env.PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      logger.error('AUTH', 'Auth env vars not configured', {
        code: 'AUTH_CONFIG_ERROR',
        correlationId,
      });
      return NextResponse.json(
        { error: 'Server authentication not configured. Set USERNAME and PASSWORD environment variables.' },
        { status: 500 }
      );
    }

    // Trim to handle potential whitespace in env vars
    if (username.trim() !== expectedUsername.trim() || password !== expectedPassword) {
      logger.warn('AUTH', `Login failed: invalid credentials for user "${username?.trim()}"`, { attempted_user: username?.trim() }, correlationId);
      return NextResponse.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const token = createSessionToken(username.trim());

    const response = NextResponse.json({ success: true });
    response.cookies.set('nimbus-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    logger.auth(`Login successful for user "${username.trim()}"`, { duration_ms: Date.now() - start }, correlationId);
    return response;
  } catch (err) {
    logger.error('AUTH', 'Login request error', {
      code: 'LOGIN_ERROR',
      error: err instanceof Error ? err : String(err),
      correlationId,
      durationMs: Date.now() - start,
    });
    return NextResponse.json(
      { error: 'Invalid request.' },
      { status: 400 }
    );
  }
}
