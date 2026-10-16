import { env } from "@/config/env";
import { backendHeaders, getCaller } from "@/lib/auth/server";

/**
 * Server-side helper for the /api proxy routes. The browser never talks to the
 * Edge backend directly: each route handler resolves the caller from the
 * HttpOnly session cookie (or the anonymous id in open mode), attaches the
 * server API key + bearer token and forwards the request.
 */
export const UNAUTHENTICATED = "Sign in with your work Google account to use Edge.";

export function unauthorized(): Response {
  return Response.json({ error: { code: "unauthorized", message: UNAUTHENTICATED } }, { status: 401 });
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Forward a JSON request to the backend and relay status, body and request id.
 * Upstream error envelopes (`{error:{code,message}}`) pass through unchanged so
 * the client can show `error.message`.
 */
export async function proxyJson(
  req: Request,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const caller = await getCaller();
  if (!caller) return unauthorized();
  const headers: Record<string, string> = backendHeaders(caller);
  const requestId = req.headers.get("x-request-id");
  if (requestId) headers["x-request-id"] = requestId;

  let upstream: Response;
  try {
    upstream = await fetch(`${env.EDGE_API_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: req.signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return new Response(null, { status: 499 });
    return Response.json({ error: { code: "upstream_unreachable", message: "The Edge backend could not be reached." } }, { status: 502 });
  }

  const text = await upstream.text();
  const responseHeaders: Record<string, string> = { "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8" };
  const upstreamRequestId = upstream.headers.get("x-request-id");
  if (upstreamRequestId) responseHeaders["x-request-id"] = upstreamRequestId;
  return new Response(text, { status: upstream.status, headers: responseHeaders });
}

/** Response headers worth relaying from a raw passthrough (file bytes, upload results). */
const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-disposition", "etag", "last-modified", "x-request-id"];

/**
 * Forward a request whose body is not JSON (a multipart upload) or whose response is not JSON
 * (a file's bytes), streaming both ways instead of buffering: an upload is up to 10 MB and a
 * preview is the same file back. Auth is the same as `proxyJson`; only `content-type` changes
 * (a multipart body must keep its own boundary). Responses are never cached by the browser or
 * a proxy: they are one consultant's student documents.
 */
export async function proxyRaw(
  req: Request,
  path: string,
  init: { method?: string; body?: ReadableStream<Uint8Array> | null; contentType?: string | null } = {},
): Promise<Response> {
  const caller = await getCaller();
  if (!caller) return unauthorized();
  const headers: Record<string, string> = backendHeaders(caller);
  delete headers["content-type"];
  if (init.contentType) headers["content-type"] = init.contentType;
  const length = req.headers.get("content-length");
  if (init.body && length) headers["content-length"] = length;
  const requestId = req.headers.get("x-request-id");
  if (requestId) headers["x-request-id"] = requestId;

  let upstream: Response;
  try {
    upstream = await fetch(`${env.EDGE_API_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body ?? undefined,
      signal: req.signal,
      cache: "no-store",
      // Node's fetch refuses a streamed request body without this.
      ...(init.body ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch (err) {
    if ((err as Error).name === "AbortError") return new Response(null, { status: 499 });
    return Response.json({ error: { code: "upstream_unreachable", message: "The Edge backend could not be reached." } }, { status: 502 });
  }

  const responseHeaders = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
