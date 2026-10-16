/**
 * Edge session handling for the frontend (server and edge runtimes).
 *
 * Google sign-in is the only way in: users authenticate with their work
 * Google account, the backend verifies the ID token and issues an HS256
 * session token which we keep in an HttpOnly cookie and verify here with the
 * shared SESSION_SECRET. There is no anonymous fallback — if the deployment
 * is missing NEXT_PUBLIC_GOOGLE_CLIENT_ID (or SESSION_SECRET at runtime),
 * sign-in and every protected route fail closed instead of granting access.
 */
export const SESSION_COOKIE = "edge_session";

export type AuthMode = "google" | "unconfigured";

/** "unconfigured" means Google sign-in has not been set up for this deployment; never a bypass. */
export function authMode(): AuthMode {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? "google" : "unconfigured";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  exp: number;
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Verify an Edge session token (HS256, issued by the backend). Returns null when invalid or expired. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts as [string, string, string];
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(h))) as { alg?: string };
    if (header.alg !== "HS256") return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(s), new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(b64urlDecode(b))) as { iss?: string; sub?: string; email?: string; name?: string | null; picture?: string | null; exp?: number };
    if (c.iss !== "edge" || !c.email || typeof c.exp !== "number" || c.exp * 1000 < Date.now()) return null;
    return { id: c.sub ?? c.email, email: c.email, name: c.name ?? null, picture: c.picture ?? null, exp: c.exp };
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string, maxAgeSeconds: number, secure: boolean): string {
  return [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`, secure ? "Secure" : ""].filter(Boolean).join("; ");
}

export function clearSessionCookieHeader(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", secure ? "Secure" : ""].filter(Boolean).join("; ");
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return proto === "https";
}
