import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, buildExpectedSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password?.trim() ?? "";
  const envUsername = process.env.USERNAME?.trim() ?? "";
  const envPassword = process.env.PASSWORD?.trim() ?? "";

  if (!envUsername || !envPassword) {
    return NextResponse.json({ error: "Auth environment variables are not configured." }, { status: 500 });
  }

  if (username !== envUsername || password !== envPassword) {
    return NextResponse.json({ error: "Username or password is invalid." }, { status: 401 });
  }

  const token = await buildExpectedSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unable to create session." }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
