import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CRM contacts the signed-in consultant may see (the backend searches the CRM as them). */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return Response.json({ error: { code: "validation_error", message: "q must be 2-100 characters" } }, { status: 400 });
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const limit = Number.isInteger(raw) ? Math.min(25, Math.max(1, raw)) : 10;
  return proxyJson(req, `/v1/crm/contacts?q=${encodeURIComponent(q)}&limit=${limit}`);
}
