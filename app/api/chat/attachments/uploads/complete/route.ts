import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct upload, step 3: after the browser has posted the file to S3, the backend reads it,
 * stores it like any upload and answers `201 { attachment }` (`POST /v1/chat/attachments/uploads/complete`).
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: { code: "validation_error", message: "body must be JSON" } }, { status: 400 });
  }
  const ticket = (raw as { ticket?: unknown })?.ticket;
  if (typeof ticket !== "string" || !ticket) return Response.json({ error: { code: "validation_error", message: "ticket is required" } }, { status: 400 });
  return proxyJson(req, "/v1/chat/attachments/uploads/complete", { method: "POST", body: { ticket } });
}
