import { NextRequest } from "next/server";
import { z } from "zod";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  query: z.string().trim().min(2).max(1_000),
  k: z.number().int().min(1).max(20).optional(),
  countries: z.array(z.string().min(1).max(40)).max(6).optional(),
  docTypes: z.array(z.string().min(1).max(40)).max(10).optional(),
});

/** Direct knowledge-base search (no LLM turn), proxied to the backend. */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "validation_error", message: "Enter at least two characters to search." } }, { status: 400 });
  }
  return proxyJson(req, "/v1/knowledge/search", { method: "POST", body: parsed.data });
}
