import { NextRequest } from "next/server";
import { isUuid, proxyJson } from "@/lib/edge/server";
import { isJourneyStepKey } from "@/lib/edge/journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in counsellor's conversations, newest first. */
export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isInteger(raw) ? Math.min(100, Math.max(1, raw)) : 50;
  return proxyJson(req, `/v1/sessions?limit=${limit}`);
}

/** Start a guided session about one CRM student: `{ guided: { contactId, step? } }`. */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: { code: "validation_error", message: "body must be JSON" } }, { status: 400 });
  }
  const guided = (raw as { guided?: { contactId?: unknown; step?: unknown } } | null)?.guided;
  if (!guided || typeof guided.contactId !== "string" || !isUuid(guided.contactId)) {
    return Response.json({ error: { code: "validation_error", message: "guided.contactId must be a UUID" } }, { status: 400 });
  }
  if (guided.step !== undefined && !isJourneyStepKey(guided.step)) {
    return Response.json({ error: { code: "validation_error", message: "guided.step is not a journey step" } }, { status: 400 });
  }
  return proxyJson(req, "/v1/sessions", { method: "POST", body: { guided: { contactId: guided.contactId, ...(guided.step ? { step: guided.step } : {}) } } });
}
