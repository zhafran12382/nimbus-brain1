export const AUTH_COOKIE_NAME = "nimbus_auth_session";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build deterministic session token from env credentials.
 * We never store raw username/password in cookies.
 */
export async function buildExpectedSessionToken(): Promise<string | null> {
  const username = process.env.USERNAME?.trim();
  const password = process.env.PASSWORD?.trim();
  if (!username || !password) return null;
  return sha256Hex(`${username}:${password}:nimbus-auth-v1`);
}
