import { NextRequest } from "next/server";
import { proxyJson } from "@/lib/edge/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The guided-session journey steps (labels, goals, checklists, the CRM fields each needs). */
export async function GET(req: NextRequest) {
  return proxyJson(req, "/v1/journey");
}
