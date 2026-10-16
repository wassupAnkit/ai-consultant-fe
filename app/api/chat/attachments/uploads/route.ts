import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const invalid = (message: string) => Response.json({ error: { code: "validation_error", message } }, { status: 400 });

/**
 * Direct upload, step 1: ask the backend for a presigned S3 POST for one file
 * (`POST /v1/chat/attachments/uploads`). Only this small JSON request crosses the load balancer;
 * the file itself goes from the browser to S3. 503 `direct_upload_disabled` means no bucket is
 * configured, and the client falls back to the multipart route.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return invalid("body must be JSON");
  }
  const b = raw as { fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown; sessionId?: unknown };
  if (typeof b?.fileName !== "string" || typeof b.mimeType !== "string" || typeof b.sizeBytes !== "number") {
    return invalid("fileName, mimeType and sizeBytes are required");
  }
  const body = { fileName: b.fileName, mimeType: b.mimeType, sizeBytes: b.sizeBytes, ...(typeof b.sessionId === "string" ? { sessionId: b.sessionId } : {}) };
  return proxyJson(req, "/v1/chat/attachments/uploads", { method: "POST", body });
}
