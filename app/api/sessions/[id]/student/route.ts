import { NextRequest } from "next/server";
import { isUuid, proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The guided session's student, read live from the CRM as the signed-in consultant. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: { code: "validation_error", message: "session id must be a UUID" } }, { status: 400 });
  return proxyJson(req, `/v1/sessions/${id}/student`);
}
