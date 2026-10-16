import { NextRequest } from "next/server";
import { isUuid, proxyJson } from "@/lib/edge/server";
import { parseDecisionBody } from "@/lib/edge/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function invalid(message: string): Response {
  return Response.json({ error: { code: "validation_error", message } }, { status: 400 });
}

function badId(): Response {
  return invalid("proposal id must be a UUID");
}

/**
 * Approve or reject a CRM write proposal. Proxies to the backend's
 * `POST /v1/crm/writes/:id/decision`, which returns the updated `CrmWriteProposalView`: 200
 * once decided, 404 for a proposal that doesn't exist or belongs to another actor, 409 (with
 * the current view) when it is no longer pending. `proxyJson` relays all three unchanged.
 * `edits` (approve only, a flat object of field -> value) carries the values the counsellor
 * changed on the card; the backend checks the keys against the proposal and previews again.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return badId();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return invalid("body must be JSON");
  }
  const parsed = parseDecisionBody(raw);
  if (!parsed.ok) return invalid(parsed.message);

  return proxyJson(req, `/v1/crm/writes/${id}/decision`, { method: "POST", body: parsed.value });
}
