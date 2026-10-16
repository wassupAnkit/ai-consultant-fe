import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";

/** Thumbs up / down on an assistant answer → backend `POST /v1/feedback`. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { requestId?: string; traceId?: string; sessionId?: string; score?: number; comment?: string } | null;
  if (!body || (!body.requestId && !body.traceId)) {
    return Response.json({ error: { code: "validation_error", message: "requestId or traceId is required" } }, { status: 400 });
  }
  if (typeof body.score !== "number" || body.score < -1 || body.score > 1) {
    return Response.json({ error: { code: "validation_error", message: "score must be a number in [-1, 1]" } }, { status: 400 });
  }
  return proxyJson(req, "/v1/feedback", {
    method: "POST",
    body: {
      requestId: body.requestId,
      traceId: body.traceId,
      sessionId: body.sessionId,
      score: body.score,
      comment: typeof body.comment === "string" ? body.comment.slice(0, 2_000) : undefined,
    },
  });
}
