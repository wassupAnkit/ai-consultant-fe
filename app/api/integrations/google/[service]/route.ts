import { NextRequest } from "next/server";
import { INTEGRATION_SERVICES, isIntegrationService } from "@/lib/edge/integrations";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ service: string }> };

/** Disconnect one Google service (Gmail, Drive, Calendar or Docs & Sheets). Proxies to `DELETE /v1/integrations/google/:service`, which returns every service's status. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { service } = await params;
  if (!isIntegrationService(service)) {
    return Response.json({ error: { code: "validation_error", message: `service must be one of ${INTEGRATION_SERVICES.join(", ")}` } }, { status: 400 });
  }
  return proxyJson(req, `/v1/integrations/google/${service}`, { method: "DELETE" });
}
