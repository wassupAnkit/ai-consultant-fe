import { NextRequest } from "next/server";
import { isUuid, proxyJson } from "@/lib/edge/server";
import { isJourneyStepKey, STEP_STATUSES } from "@/lib/edge/journey";
import type { GuidePatch, StepStatus } from "@/lib/edge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function invalid(message: string): Response {
  return Response.json({ error: { code: "validation_error", message } }, { status: 400 });
}

/**
 * Move a guided session's journey (current step, step statuses, dismiss a suggestion) or
 * convert a normal chat into a guided one. Only the known fields are forwarded.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return invalid("session id must be a UUID");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return invalid("body must be JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return invalid("body must be a JSON object");
  const input = raw as Record<string, unknown>;
  const patch: GuidePatch = {};

  if (input.currentStep !== undefined) {
    if (!isJourneyStepKey(input.currentStep)) return invalid("currentStep is not a journey step");
    patch.currentStep = input.currentStep;
  }
  if (input.stepStatus !== undefined) {
    if (typeof input.stepStatus !== "object" || input.stepStatus === null) return invalid("stepStatus must be an object");
    const out: GuidePatch["stepStatus"] = {};
    for (const [k, v] of Object.entries(input.stepStatus)) {
      if (!isJourneyStepKey(k) || !STEP_STATUSES.includes(v as StepStatus)) return invalid("stepStatus has an unknown step or status");
      out[k] = v as StepStatus;
    }
    patch.stepStatus = out;
  }
  if (input.dismissSuggestion !== undefined) {
    if (typeof input.dismissSuggestion !== "boolean") return invalid("dismissSuggestion must be a boolean");
    patch.dismissSuggestion = input.dismissSuggestion;
  }
  if (input.convert !== undefined) {
    const c = input.convert as { contactId?: unknown; step?: unknown } | null;
    if (!c || typeof c.contactId !== "string" || !isUuid(c.contactId)) return invalid("convert.contactId must be a UUID");
    if (c.step !== undefined && !isJourneyStepKey(c.step)) return invalid("convert.step is not a journey step");
    patch.convert = { contactId: c.contactId, ...(c.step ? { step: c.step } : {}) };
  }
  if (!Object.keys(patch).length) return invalid("nothing to change");
  return proxyJson(req, `/v1/sessions/${id}/guide`, { method: "PATCH", body: patch });
}
