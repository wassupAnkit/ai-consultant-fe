import { NextResponse } from "next/server";
import { isSecureRequest, sessionCookieHeader } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Local development only: signs an Edge session for `EDGE_DEV_LOGIN_EMAIL` and sends the
 * browser to /chat, so the UI can be checked without a Google OAuth client for localhost.
 *
 * Fails closed three ways: it 404s unless NODE_ENV is "development", unless that email is
 * set, and unless SESSION_SECRET is set. The backend still sees the same identity headers as
 * a real sign-in (`x-user-id` = this email), so every request is scoped as that person.
 */
export async function GET(req: Request) {
  const email = process.env.EDGE_DEV_LOGIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "development" || !email || !secret) return new NextResponse("Not found", { status: 404 });

  const ttl = 12 * 3600;
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ iss: "edge", sub: `dev-${email}`, email, name: process.env.EDGE_DEV_LOGIN_NAME ?? null, picture: null, exp: Math.floor(Date.now() / 1000) + ttl });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`))).toString("base64url");

  const res = NextResponse.redirect(new URL("/chat", req.url), 303);
  res.headers.set("set-cookie", sessionCookieHeader(`${header}.${body}.${sig}`, ttl, isSecureRequest(req)));
  return res;
}
