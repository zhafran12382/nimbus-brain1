import { NextRequest, NextResponse } from 'next/server';

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const [encoded, hmac] = token.split('.');
    if (!encoded || !hmac) return false;

    const payload = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));

    // Use Web Crypto API (available in Edge Runtime)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedHmac = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hmac !== expectedHmac) return false;

    const parsed = JSON.parse(payload);
    if (parsed.exp && Date.now() > parsed.exp) return false;

    return true;
  } catch {
    return false;
  }
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.PASSWORD || 'nimbus-brain-default-secret-change-me';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth API routes and login page through without auth
  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('nimbus-session')?.value;
  const secret = getSessionSecret();

  if (!token || !(await verifySessionToken(token, secret))) {
    // For API routes, return 401
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login.' },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
