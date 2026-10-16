import { NextRequest } from "next/server";
import { z } from "zod";
import { INTEGRATION_SERVICES } from "@/lib/edge/integrations";
import type { IntegrationService } from "@/lib/edge/types";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  services: z
    .array(z.enum(INTEGRATION_SERVICES as [IntegrationService, ...IntegrationService[]]))
    .min(1)
    .max(INTEGRATION_SERVICES.length)
    .transform((s) => [...new Set(s)]),
  // Same-origin paths only; the callback checks again before redirecting.
  returnTo: z
    .string()
    .max(512)
    .regex(/^\/(?![/\\])[^\u0000-\u001f\u007f]*$/)
    .optional(),
});

/**
 * Start Google's consent flow for one or more of Gmail, Drive, Calendar and Docs & Sheets. Proxies to
 * `POST /v1/integrations/google/connect`, which answers `{ url }` (the consent screen the
 * browser is sent to) or 503 when this deployment has the integration switched off.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const returnTo = parsed.error.issues.some((i) => i.path[0] === "returnTo");
    const message = returnTo ? "returnTo must be a path on this site" : `services must list one or more of ${INTEGRATION_SERVICES.map((s) => `"${s}"`).join(", ")}`;
    return Response.json({ error: { code: "validation_error", message } }, { status: 400 });
  }
  return proxyJson(req, "/v1/integrations/google/connect", { method: "POST", body: parsed.data });
}
