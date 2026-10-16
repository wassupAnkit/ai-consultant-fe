import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in consultant's Gmail and Drive connections, proxied to `GET /v1/integrations`. */
export async function GET(req: NextRequest) {
  return proxyJson(req, "/v1/integrations");
}
