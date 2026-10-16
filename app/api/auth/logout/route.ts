import { NextRequest } from "next/server";
import { clearSessionCookieHeader, isSecureRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": clearSessionCookieHeader(isSecureRequest(req)) },
  });
}
