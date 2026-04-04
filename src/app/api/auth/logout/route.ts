import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST() {
  const correlationId = logger.createCorrelationId();
  logger.auth('Logout requested', undefined, correlationId);

  const response = NextResponse.json({ success: true });
  response.cookies.set('nimbus-session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  logger.auth('Logout succeeded, session cookie cleared', undefined, correlationId);
  return response;
}
