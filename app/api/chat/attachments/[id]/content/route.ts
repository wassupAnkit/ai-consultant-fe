import { NextRequest } from "next/server";
import { isUuid, proxyRaw } from "@/lib/edge/server";
import { ATTACHMENT_TYPES } from "@/lib/edge/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * The attached file itself, for the preview opened from a chat chip (owner only; 404 for anyone
 * else's). Served from this app's own origin, so the type is pinned to the ones Edge accepts:
 * anything else is sent as a download, never rendered, so a stored file can't run as a page here.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: { code: "validation_error", message: "attachment id must be a UUID" } }, { status: 400 });
  const res = await proxyRaw(req, `/v1/chat/attachments/${id}/content`);
  if (!res.ok) return res;
  const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(type)) {
    const headers = new Headers(res.headers);
    headers.set("content-type", "application/octet-stream");
    headers.set("content-disposition", "attachment");
    return new Response(res.body, { status: res.status, headers });
  }
  return res;
}
