import { NextRequest } from "next/server";
import { env } from "@/config/env";
import { backendHeaders, getCaller } from "@/lib/auth/server";
import { isUuid, unauthorized } from "@/lib/edge/server";
import { parseAttachmentIds } from "@/lib/edge/validation";

/**
 * Streams one counsellor-mode chat turn from the Edge backend as
 * newline-delimited JSON: {"event":"meta"|"intent"|"token"|"done"|"error","data":{...}}.
 * Identity: Edge session cookie (Google mode) forwarded as Bearer, or the
 * anonymous browser id (open mode); the server API key is always attached.
 */
export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 8_000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { message?: string; sessionId?: string; newSession?: boolean; deepThink?: unknown; regenerate?: unknown; metadata?: unknown; attachments?: unknown };
  // Browser context recorded with the turn (activity log); never trusted for anything else.
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : undefined;
  const message = body.message?.trim();
  if (!message) return Response.json({ error: { code: "validation_error", message: "message is required" } }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: { code: "validation_error", message: `message must be at most ${MAX_MESSAGE_CHARS} characters` } }, { status: 400 });
  }
  if (body.sessionId !== undefined && !isUuid(body.sessionId)) {
    return Response.json({ error: { code: "validation_error", message: "sessionId must be a UUID" } }, { status: 400 });
  }
  // Student documents uploaded first through /api/chat/attachments; the backend checks ownership.
  const attachments = parseAttachmentIds(body.attachments);
  if (!attachments.ok) return Response.json({ error: { code: "validation_error", message: attachments.message } }, { status: 400 });

  const caller = await getCaller();
  if (!caller) return unauthorized();

  const headers: Record<string, string> = { ...backendHeaders(caller), accept: "application/x-ndjson" };
  const requestId = req.headers.get("x-request-id");
  if (requestId) headers["x-request-id"] = requestId;
  // Relay the real client's user agent and IP so the backend's activity log sees the browser, not this proxy.
  const ua = req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) headers["x-forwarded-for"] = fwd;

  let upstream: Response;
  try {
    upstream = await fetch(`${env.EDGE_API_URL}/v1/chat/stream?format=ndjson`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, sessionId: body.sessionId, newSession: body.newSession ?? undefined, deepThink: body.deepThink === true || undefined, regenerate: body.regenerate === true || undefined, mode: "counsellor", metadata, attachments: attachments.value }),
      signal: req.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return new Response(null, { status: 499 });
    return ndjsonError(502, "upstream_unreachable", "The Edge backend could not be reached.");
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    let message = text.slice(0, 500);
    let code = `upstream_${upstream.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
      if (parsed.error?.code) code = parsed.error.code;
    } catch {
      /* not JSON */
    }
    return ndjsonError(
      upstream.status === 401 || upstream.status === 403 || upstream.status === 429 ? upstream.status : 502,
      code,
      message,
      upstream.headers.get("retry-after"),
    );
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": upstream.headers.get("x-request-id") ?? "",
    },
  });
}

function ndjsonError(status: number, code: string, message: string, retryAfter?: string | null): Response {
  return new Response(JSON.stringify({ event: "error", data: { code, message } }) + "\n", {
    status,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      // Without this the client can only say "wait a few seconds" on a 429, even when the
      // backend told us exactly how long.
      ...(retryAfter ? { "retry-after": retryAfter } : {}),
    },
  });
}
