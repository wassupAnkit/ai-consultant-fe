import { NextRequest } from "next/server";
import { isUuid, proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Title bounds mirror the backend's `PATCH /v1/sessions/:id` contract. */
const TITLE_MAX = 120;

function invalid(message: string): Response {
  return Response.json({ error: { code: "validation_error", message } }, { status: 400 });
}

function badId(): Response {
  return invalid("session id must be a UUID");
}

/** Conversation history (owner-scoped; 404 for anyone else's session). */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return badId();
  return proxyJson(req, `/v1/sessions/${id}`);
}

/** Rename (`title`) and/or pin (`pinned`) a conversation; returns the updated session. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return badId();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return invalid("body must be JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return invalid("body must be a JSON object");

  const input = raw as { title?: unknown; pinned?: unknown };
  const patch: { title?: string; pinned?: boolean } = {};
  if (input.title !== undefined) {
    if (typeof input.title !== "string") return invalid("title must be a string");
    const title = input.title.trim();
    if (!title || title.length > TITLE_MAX) return invalid(`title must be 1-${TITLE_MAX} characters`);
    patch.title = title;
  }
  if (input.pinned !== undefined) {
    if (typeof input.pinned !== "boolean") return invalid("pinned must be a boolean");
    patch.pinned = input.pinned;
  }
  if (patch.title === undefined && patch.pinned === undefined) return invalid("title or pinned is required");

  return proxyJson(req, `/v1/sessions/${id}`, { method: "PATCH", body: patch });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return badId();
  return proxyJson(req, `/v1/sessions/${id}`, { method: "DELETE" });
}
