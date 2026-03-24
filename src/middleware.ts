import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, buildExpectedSessionToken } from "@/lib/auth";

const AUTH_PAGES = ["/chat", "/expenses", "/targets", "/study", "/settings", "/api/chat"];

function requiresAuth(pathname: string): boolean {
  if (pathname === "/login") return false;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return false;
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/") return true;
  return AUTH_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const expectedToken = await buildExpectedSessionToken();
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(expectedToken && cookieToken && cookieToken === expectedToken);

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
