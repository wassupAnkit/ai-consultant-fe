import { NextRequest } from "next/server";
import { env } from "@/config/env";
import { authMode, isSecureRequest, sessionCookieHeader } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Exchange a Google ID token (from Google Identity Services) for an Edge session cookie. */
export async function POST(req: NextRequest) {
  if (authMode() !== "google") return Response.json({ error: "Google sign-in is not enabled" }, { status: 404 });
  const { credential } = (await req.json().catch(() => ({}))) as { credential?: string };
  if (!credential) return Response.json({ error: "credential is required" }, { status: 400 });

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.EDGE_API_KEY) headers["x-api-key"] = env.EDGE_API_KEY;
  const upstream = await fetch(`${env.EDGE_API_URL}/auth/google`, { method: "POST", headers, body: JSON.stringify({ credential }) });
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return Response.json({ error: body?.error?.message ?? "Sign-in failed", code: body?.error?.code }, { status: upstream.status });
  }
  const { token, user, expiresIn } = body as { token: string; user: unknown; expiresIn: number };
  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(token, expiresIn, isSecureRequest(req)) },
  });
}
