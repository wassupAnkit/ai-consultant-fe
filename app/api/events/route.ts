import { NextRequest } from "next/server";
import { env } from "@/config/env";
import { backendHeaders, getCaller } from "@/lib/auth/server";

export const runtime = "nodejs";

/**
 * Forwards browser UI events (see lib/analytics.ts) to the Edge backend's
 * `POST /v1/events`. Telemetry is best-effort: the browser always gets 202 and
 * the real client's user agent / IP are relayed so the backend can record them.
 */
export async function POST(req: NextRequest) {
  const accepted = (n: number) => Response.json({ accepted: n }, { status: 202 });
  const body = (await req.json().catch(() => null)) as { events?: unknown[] } | null;
  if (!body || !Array.isArray(body.events) || body.events.length === 0) return accepted(0);

  const caller = await getCaller();
  if (!caller) return accepted(0);

  const headers: Record<string, string> = backendHeaders(caller);
  const ua = req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) headers["x-forwarded-for"] = fwd;

  try {
    const upstream = await fetch(`${env.EDGE_API_URL}/v1/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({ events: body.events.slice(0, 50) }),
      cache: "no-store",
    });
    if (!upstream.ok) return accepted(0);
    const data = (await upstream.json().catch(() => ({}))) as { accepted?: number };
    return accepted(data.accepted ?? 0);
  } catch {
    return accepted(0);
  }
}
