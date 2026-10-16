import { NextRequest } from "next/server";
import { proxyRaw } from "@/lib/edge/server";
import { ATTACHMENT_MAX_BYTES } from "@/lib/edge/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Room for the multipart envelope (boundaries, part headers, `sessionId`) around a 10 MB file. */
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * Upload one student document: multipart `file` (+ optional `sessionId`), streamed unchanged to
 * the backend's `POST /v1/chat/attachments`, which answers `201 { attachment }`, 413 too large,
 * 415 wrong type. The body is never buffered here; an obviously oversized request is refused
 * from its `content-length` before any of it is read.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return Response.json({ error: { code: "validation_error", message: "Upload a file as multipart/form-data." } }, { status: 400 });
  }
  const length = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(length) && length > ATTACHMENT_MAX_BYTES + MULTIPART_OVERHEAD) {
    return Response.json({ error: { code: "payload_too_large", message: "Too large: the limit is 10 MB." } }, { status: 413 });
  }
  if (!req.body) return Response.json({ error: { code: "validation_error", message: "file is required" } }, { status: 400 });
  return proxyRaw(req, "/v1/chat/attachments", { method: "POST", body: req.body, contentType });
}
